import mongoose from 'mongoose';
import { Event } from '../models/Event.js';
import { buildEventQueryOptions } from '../utils/eventFilters.js';
import WorkshopRequest from '../models/WorkshopRequests.js';
import { EventRegister } from "../models/EventRegister.js";
import { EventApplication } from "../models/EventApplication.js";
import { sendEmail } from "../utils/sendEmail.js";
import User from '../models/User.js';
import { autoArchiveEvents } from "../utils/archiveEvents.js";
import { buildRegistrationsWorkbook } from "../utils/xlsx.js";
import { makeEventVisitorQR } from "../utils/qrcode.js";
import { notifyNewEventToRoles } from "../utils/scheduler.js"; // ← NEW

const isObjectId = (v) => mongoose.Types.ObjectId.isValid(String(v));
const REGISTRANT_ROLES = ["student", "staff", "ta", "professor", "vendor"];

/* =========================
   LIST / VIEW
========================= */
export const getAllEvents = async (req, res) => {
  try {
    const { filter, pagination, sort } = buildEventQueryOptions(req.query);

    const includeArchived = String(req.query.includeArchived || "false").toLowerCase() === "true";
    if (!includeArchived) filter.isArchived = { $ne: true };

    const userRole = req.user?.role ? String(req.user.role) : null;
    const isPrivileged = userRole === "admin" || userRole === "event_office";

    if (!userRole) {
      filter.$or = [{ allowedRoles: { $exists: false } }, { allowedRoles: { $size: 0 } }];
    } else if (!isPrivileged) {
      filter.$or = [
        { allowedRoles: { $exists: false } },
        { allowedRoles: { $size: 0 } },
        { allowedRoles: userRole },
        { allowedRoles: { $in: [userRole] } },
      ];
    }

    const [events, total] = await Promise.all([
      Event.find(filter).sort(sort).skip(pagination.skip).limit(pagination.limit),
      Event.countDocuments(filter),
    ]);

    return res.status(200).json({
      status: "success",
      page: pagination.page,
      totalPages: Math.ceil(total / pagination.limit),
      totalEvents: total,
      count: events.length,
      data: events,
    });
  } catch (error) {
    return res.status(500).json({ status: "error", message: error.message });
  }
};

export const getEventById = async (req, res) => {
  try {
    const { id } = req.params;
    if (!isObjectId(id)) return res.status(400).json({ status: "error", message: "Invalid event id" });

    const event = await Event.findById(id);
    if (!event) return res.status(404).json({ status: "error", message: "Event not found" });

    const userRole = req.user?.role ? String(req.user.role) : null;
    const isPrivileged = userRole === "admin" || userRole === "event_office";

    if (!isPrivileged && Array.isArray(event.allowedRoles) && event.allowedRoles.length > 0) {
      if (!userRole || !event.allowedRoles.includes(userRole)) {
        return res.status(403).json({ status: "error", message: "Not allowed to view this event" });
      }
    }

    return res.status(200).json({ status: "success", data: event });
  } catch (error) {
    return res.status(500).json({ status: "error", message: "Failed to fetch event", details: error.message });
  }
};

/* =========================
   CREATE / DELETE
========================= */
export const createEvent = async (req, res) => {
  try {
    const {
      name,
      startDateTime,
      endDateTime,
      location,
      description,
      registrationDeadline,
      eventType,
      allowedRoles,
      externalVisitorsEnabled,
      ticketPrice,
    } = req.body || {};

    if (!name || !startDateTime || !endDateTime || !location || !description || !registrationDeadline || !eventType) {
      return res.status(400).json({ status: "error", message: "Missing required fields." });
    }

    const createdBy = req.user?.id || req.user?._id || req.body?.createdBy || null;
    if (!createdBy || !isObjectId(createdBy)) {
      return res.status(400).json({ status: "error", message: "createdBy is required and must be a valid user id" });
    }

    let cleanAllowed = [];
    if (Array.isArray(allowedRoles)) {
      cleanAllowed = allowedRoles
        .map((r) => String(r || "").toLowerCase().trim())
        .filter((r) => REGISTRANT_ROLES.includes(r));
    }

    const event = await Event.create({
      name,
      startDateTime,
      endDateTime,
      location,
      description,
      registrationDeadline,
      eventType,
      createdBy,
      allowedRoles: cleanAllowed,
      externalVisitorsEnabled: !!externalVisitorsEnabled,
      ticketPrice: typeof ticketPrice === "number" ? ticketPrice : undefined,
    });

    // ← NEW: Notify all non-admin roles that a new event was added
    notifyNewEventToRoles(event).catch((e) =>
      console.warn("[createEvent] notifyNewEventToRoles error:", e?.message)
    );

    return res.status(201).json({ status: "success", data: event });
  } catch (error) {
    return res.status(400).json({ status: "error", message: error.message });
  }
};

export const deleteEvent = async (req, res) => {
  try {
    const { id } = req.params;
    if (!isObjectId(id)) return res.status(400).json({ status: "error", message: "Invalid event id" });

    // Prefer checking EventApplication records (applications/vendors/registrations)
    const appCount = await EventApplication.countDocuments({ eventId: id });
    if (appCount > 0) {
      return res
        .status(409)
        .json({ status: "error", message: "Cannot delete event: there are registrations for this event" });
    }

    const event = await Event.findByIdAndDelete(id);
    if (!event) return res.status(404).json({ status: "error", message: "Event not found" });

    try {
      const { EventApplication } = await import("../models/EventApplication.js");
      await EventApplication.deleteMany({ eventId: event._id });
    } catch (e) {
      console.warn("[deleteEvent] EventApplication cleanup skipped:", e?.message);
    }

    try {
      if (String(event.eventType).toLowerCase() === "workshop") {
        await WorkshopRequest.deleteMany({ workshop: event._id });
      }
    } catch (e) {
      console.warn("[deleteEvent] WorkshopRequest cleanup skipped:", e?.message);
    }

    return res
      .status(200)
      .json({ status: "success", message: `Event '${event.name}' and its related data were deleted.` });
  } catch (error) {
    return res.status(500).json({ status: "error", message: "Failed to delete event", details: error.message });
  }
};

export const addRating = async (req, res) => {
  try {
    const { id: eventId } = req.params;
    const { score, comment } = req.body || {};
    const userId = req.body.user;

    if (!mongoose.Types.ObjectId.isValid(eventId)) {
      return res.status(400).json({ status: 'error', message: 'Invalid event id' });
    }
    if (!userId || !mongoose.Types.ObjectId.isValid(String(userId))) {
      return res.status(401).json({ status: 'error', message: 'Missing or invalid user id' });
    }

    const s = Number(score);
    if (!Number.isFinite(s) || s < 1 || s > 5) {
      return res.status(400).json({ status: 'error', message: 'Score must be a number between 1 and 5' });
    }

    const event = await Event.findById(eventId);
    if (!event) return res.status(404).json({ status: 'error', message: 'Event not found' });

    const endVal = event.endDateTime || event.endDate || event.end || null;
    if (!endVal) {
      return res.status(403).json({ status: 'error', message: 'Cannot rate event: event has no end date' });
    }
    const endDate = new Date(endVal);
    if (isNaN(endDate.getTime())) {
      return res.status(403).json({ status: 'error', message: 'Cannot rate event: invalid event end date' });
    }
    const now = new Date();
    if (now <= endDate) {
      return res.status(403).json({ status: 'error', message: 'Cannot rate event before it ends' });
    }

    const attended = await EventApplication.exists({ userId: String(userId), eventId: String(eventId) });
    if (!attended) {
      return res.status(403).json({ status: 'error', message: 'Cannot rate event: user did not attend or is not registered' });
    }

    // prevent duplicate rating by same user
    const existing = (event.ratings || []).find((r) => String(r.user) === String(userId));
    if (existing) {
      return res.status(409).json({ status: 'error', message: 'User already rated this event. Use edit API.' });
    }

    const newRating = { user: userId, score: s, comment: comment || '' };
    event.ratings.push(newRating);
    event.updateRatingSummary();
    await event.save();

    const summary = { average: event.averageRating, count: event.ratings.length };
    return res.status(201).json({ status: 'success', data: { rating: event.ratings[event.ratings.length - 1], summary } });
  } catch (error) {
    console.error('addRating error:', error);
    return res.status(500).json({ status: 'error', message: 'Failed to add rating', details: error.message });
  }
};

export const editRating = async (req, res) => {
  try {
    const { id: eventId, ratingId } = req.params;
    const { score, comment } = req.body || {};
    const userId = req.body.user;

    if (!mongoose.Types.ObjectId.isValid(eventId) || !mongoose.Types.ObjectId.isValid(ratingId)) {
      return res.status(400).json({ status: 'error', message: 'Invalid event or rating id' });
    }
    if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(401).json({ status: 'error', message: 'Missing or invalid user id' });
    }

    const event = await Event.findById(eventId);
    if (!event) return res.status(404).json({ status: 'error', message: 'Event not found' });

    const rating = (event.ratings || []).id(ratingId);
    if (!rating) return res.status(404).json({ status: 'error', message: 'Rating not found' });

    // allow edit only by owner of rating or admin (if req.user.role present and equals 'admin')
    if (String(rating.user) !== String(userId) && !(req.user && req.user.role === 'admin')) {
      return res.status(403).json({ status: 'error', message: 'Not authorized to edit this rating' });
    }

    if (score != null) {
      const s = Number(score);
      if (!Number.isFinite(s) || s < 1 || s > 5) {
        return res.status(400).json({ status: 'error', message: 'Score must be a number between 1 and 5' });
      }
      rating.score = s;
    }
    if (comment != null) rating.comment = comment;

    event.updateRatingSummary();
    await event.save();
    const summary = { average: event.averageRating, count: event.ratings.length };
    return res.status(200).json({ status: 'success', data: { rating, summary } });
  } catch (error) {
    console.error('editRating error:', error);
    return res.status(500).json({ status: 'error', message: 'Failed to edit rating', details: error.message });
  }
};

export const removeRating = async (req, res) => {
  try {
    const { id: eventId, ratingId } = req.params;
    const userId = req.body.user;

    if (!mongoose.Types.ObjectId.isValid(eventId) || !mongoose.Types.ObjectId.isValid(ratingId)) {
      return res.status(400).json({ status: 'error', message: 'Invalid event or rating id' });
    }
    if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(401).json({ status: 'error', message: 'Missing or invalid user id' });
    }

    const event = await Event.findById(eventId);
    if (!event) return res.status(404).json({ status: 'error', message: 'Event not found' });

    // ratings might be plain objects (not mongoose subdocs) so don't rely on .id()/.remove()
    const ratings = Array.isArray(event.ratings) ? event.ratings : [];
    const idx = ratings.findIndex((r) => String(r._id || r.id) === String(ratingId));
    if (idx === -1) return res.status(404).json({ status: 'error', message: 'Rating not found' });

    const rating = ratings[idx];

    if (String(rating.user) !== String(userId) && !(req.user && req.user.role === 'admin')) {
      return res.status(403).json({ status: 'error', message: 'Not authorized to remove this rating' });
    }

    // remove the rating entry and persist
    ratings.splice(idx, 1);
    event.ratings = ratings;
    if (typeof event.updateRatingSummary === 'function') event.updateRatingSummary();
    await event.save();

    const summary = { average: event.averageRating, count: event.ratings.length };
    return res.status(200).json({ status: 'success', message: 'Rating removed', summary });
  } catch (error) {
    console.error('removeRating error:', error);
    return res.status(500).json({ status: 'error', message: 'Failed to remove rating', details: error.message });
  }
};

export const removeRatingComment = async (req, res) => {
  try {
    const { id: eventId, ratingId } = req.params;

    // only admins allowed to remove a comment
    if (!(req.body.role === "admin")) {
      return res.status(403).json({ status: "error", message: "Not authorized" });
    }

    if (!mongoose.Types.ObjectId.isValid(eventId) || !mongoose.Types.ObjectId.isValid(ratingId)) {
      return res.status(400).json({ status: "error", message: "Invalid event or rating id" });
    }

    const event = await Event.findById(eventId);
    if (!event) return res.status(404).json({ status: "error", message: "Event not found" });

    const ratings = Array.isArray(event.ratings) ? event.ratings : [];
    const idx = ratings.findIndex((r) => String(r._id || r.id) === String(ratingId));
    if (idx === -1) return res.status(404).json({ status: "error", message: "Rating not found" });

    const rating = ratings[idx];
    const previousComment = rating.comment || "";

    if (!previousComment) {
      return res.status(400).json({ status: "error", message: "Rating has no comment to remove" });
    }

    // clear the comment
    rating.comment = "";
    
    event.ratings = ratings;
    if (typeof event.updateRatingSummary === "function") event.updateRatingSummary();
    await event.save();

    try {
      const userId = rating.user;
      console.log("Preparing to send comment removal email to user:", { userId });
      let user = null;
      if (userId) {
        user = await User.findById(userId).select("email fullName");
        console.log("Fetched user for email notification:", { userId, user });
      }

      const recipientEmail = user?.email || null;
      const recipientName = user?.fullName || "User";

      if (recipientEmail) {
        const mailSubject = `Comment removed from your rating on "${event.name || event.title || 'an event'}"`;
        const mailText = [
          `Hello ${recipientName},`,
          "",
          `An administrator has removed the comment you left on the event "${event.name || event.title || 'Event'}".`,
          "",
          "Original comment:",
          `"${previousComment}"`,
          "",
          "If you have questions, please contact support.",
          "",
          "Regards,",
          "Event Team",
        ].join("\n");

        const mailHtml = `
          <div style="font-family:Arial,sans-serif;line-height:1.6;color:#222">
            <h3>Comment removed from your rating</h3>
            <p>Hello ${recipientName},</p>
            <p>An administrator has removed the comment you left on the event "<strong>${event.name || event.title || "Event"}</strong>".</p>
            <p><strong>Original comment:</strong></p>
            <blockquote style="background:#f7f7f7;padding:12px;border-radius:6px;">${previousComment}</blockquote>
            <p>If you have questions, please contact support.</p>
            <p>Regards,<br/>Event Team</p>
          </div>
        `;

        // sendEmail handles transport configuration; errors will be caught below
        await sendEmail({ to: recipientEmail, subject: mailSubject, text: mailText, html: mailHtml });
      } else {
        console.log("Comment removed but no recipient email:", { userId });
      }
    } catch (mailErr) {
      console.error("Failed to send moderation email via sendEmail helper:", mailErr);
      // do not fail the main operation if email sending fails
    }

    return res.status(200).json({ status: "success", message: "Comment removed", rating, summary: { average: event.averageRating, count: event.ratings.length } });
  } catch (error) {
    console.error("removeRatingComment error:", error);
    return res.status(500).json({ status: "error", message: "Failed to remove comment", details: error.message });
  }
};
/* =========================
   ARCHIVE
========================= */
export const archivePastNow = async (_req, res) => {
  try {
    const result = await autoArchiveEvents();
    return res.status(200).json({ status: "success", ...result });
  } catch (e) {
    return res.status(500).json({ status: "error", message: e?.message || "Failed to archive" });
  }
};

/* =========================
   EXPORT REGISTRATIONS
========================= */
export const exportEventRegistrationsXlsx = async (req, res) => {
  try {
    const { id } = req.params;
    if (!isObjectId(id)) return res.status(400).json({ status: "error", message: "Invalid event id" });

    const event = await Event.findById(id);
    if (!event) return res.status(404).json({ status: "error", message: "Event not found" });
    if (String(event.eventType).toLowerCase() === "conference") {
      return res.status(400).json({ status: "error", message: "Export not allowed for conferences" });
    }

    // Prefer EventApplication records for exports (applications may contain participants)
    const ALLOWED = ["accepted", "approved", "registered"];
    const apps = await EventApplication.find({ eventId: id, status: { $in: ALLOWED } })
      .populate("userId", "fullName email studentId")
      .sort({ createdAt: 1 })
      .lean();

    // normalize to shape expected by buildRegistrationsWorkbook
    const regs = [];
    for (const a of apps) {
      const user = a.userId || {};
      const participants = Array.isArray(a.participants) ? a.participants : [];
      if (participants.length > 0) {
        for (const p of participants) {
          regs.push({
            name: p?.name || user.fullName || a.applicantName || "",
            email: p?.email || user.email || "",
            studentId: p?.studentId || a.gucID || user.studentId || "",
            status: a.status || "",
            createdAt: a.createdAt || null,
          });
        }
      } else {
        regs.push({
          name: user.fullName || a.applicantName || "",
          email: user.email || "",
          studentId: a.gucID || user.studentId || "",
          status: a.status || "",
          createdAt: a.createdAt || null,
        });
      }
    }

    const buffer = await buildRegistrationsWorkbook(event, regs);

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${event.name.replace(/\s+/g, "_")}_registrations.xlsx"`
    );

    return res.status(200).send(buffer);
  } catch (e) {
    return res.status(500).json({ status: "error", message: e?.message || "Failed to export" });
  }
};

/* =========================
   EXTERNAL VISITOR QR
========================= */
export const generateExternalVisitorQR = async (req, res) => {
  try {
    const { id } = req.params;
    const { name = "Visitor", email = "" } = req.query;

    if (!isObjectId(id)) return res.status(400).json({ status: "error", message: "Invalid event id" });
    const event = await Event.findById(id);
    if (!event) return res.status(404).json({ status: "error", message: "Event not found" });

    const isBazaar = String(event.eventType).toLowerCase() === "bazaar";
    const isBooth = String(event.eventType).toLowerCase() === "booth";
    const isCareerFair = /career\s*fair/i.test(String(event.name || ""));
    if (!(event.externalVisitorsEnabled && (isBazaar || isBooth || isCareerFair))) {
      return res
        .status(400)
        .json({ status: "error", message: "External visitors not enabled for this event" });
    }

    const dataUrl = await makeEventVisitorQR({
      eventId: String(event._id),
      eventName: event.name,
      type: event.eventType,
      name,
      email,
    });

    return res.status(200).json({ status: "success", dataUrl });
  } catch (e) {
    return res.status(500).json({ status: "error", message: e?.message || "Failed to generate QR" });
  }
};

/* =========================
   ACCESS CONTROLS
========================= */

// GET /:id/access  ← NEW (what the UI needed)
export const getAccess = async (req, res) => {
  try {
    const { id } = req.params;
    if (!isObjectId(id)) return res.status(400).json({ status: "error", message: "Invalid event id" });

    const ev = await Event.findById(id).lean();
    if (!ev) return res.status(404).json({ status: "error", message: "Event not found" });

    return res.json({
      status: "success",
      data: {
        _id: ev._id,
        name: ev.name,
        eventType: ev.eventType,
        allowedRoles: Array.isArray(ev.allowedRoles) ? ev.allowedRoles : [],
        externalVisitorsEnabled: !!ev.externalVisitorsEnabled,
      },
    });
  } catch (e) {
    return res.status(500).json({ status: "error", message: e?.message || "Failed to fetch access settings" });
  }
};

// PATCH /:id/allowed-roles  (legacy)
export const setAllowedRoles = async (req, res) => {
  try {
    const { id } = req.params;
    let { roles } = req.body || {};

    if (!isObjectId(id)) return res.status(400).json({ status: "error", message: "Invalid event id" });

    if (!Array.isArray(roles)) roles = [];
    roles = roles
      .map((r) => String(r || "").toLowerCase().trim())
      .filter((r) => REGISTRANT_ROLES.includes(r));

    const ev = await Event.findByIdAndUpdate(
      id,
      { $set: { allowedRoles: roles } },
      { new: true, runValidators: true }
    ).lean();

    if (!ev) return res.status(404).json({ status: "error", message: "Event not found" });

    return res.json({
      status: "success",
      data: {
        _id: ev._id,
        name: ev.name,
        eventType: ev.eventType,
        allowedRoles: ev.allowedRoles || [],
        externalVisitorsEnabled: !!ev.externalVisitorsEnabled,
      },
    });
  } catch (e) {
    return res.status(500).json({ status: "error", message: e?.message || "Failed to set allowed roles" });
  }
};

// PUT /:id/access
export const setAccess = async (req, res) => {
  try {
    const { id } = req.params;
    let { allowedRoles, externalVisitorsEnabled } = req.body || {};

    if (!isObjectId(id)) return res.status(400).json({ status: "error", message: "Invalid event id" });

    if (!Array.isArray(allowedRoles)) allowedRoles = [];
    allowedRoles = allowedRoles
      .map((r) => String(r || "").toLowerCase().trim())
      .filter((r) => REGISTRANT_ROLES.includes(r));

    const update = {
      $set: {
        allowedRoles,
        ...(typeof externalVisitorsEnabled === "boolean"
          ? { externalVisitorsEnabled }
          : {}),
      },
    };

    const ev = await Event.findByIdAndUpdate(id, update, {
      new: true,
      runValidators: true,
    }).lean();

    if (!ev) return res.status(404).json({ status: "error", message: "Event not found" });

    return res.json({
      status: "success",
      data: {
        _id: ev._id,
        name: ev.name,
        eventType: ev.eventType,
        allowedRoles: ev.allowedRoles || [],
        externalVisitorsEnabled: !!ev.externalVisitorsEnabled,
      },
    });
  } catch (e) {
    return res.status(500).json({ status: "error", message: e?.message || "Failed to update access" });
  }
};
