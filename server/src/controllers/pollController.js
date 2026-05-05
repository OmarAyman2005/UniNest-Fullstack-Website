// server/src/controllers/pollController.js
import mongoose from "mongoose";
import { Poll } from "../models/Poll.js";
import { EventApplication } from "../models/EventApplication.js";
import { Event } from "../models/Event.js";

const { Types } = mongoose;

/* ------------------------ helpers: role checks ------------------------ */

function normRole(user) {
  return String(user?.role || "").toLowerCase();
}

function isAdminOrEventOffice(user) {
  const r = normRole(user);
  return r === "admin" || r === "event_office";
}

// For requirement 83 later: who can vote
function isAcademicVoter(user) {
  const r = normRole(user);
  return ["student", "staff", "ta", "professor"].includes(r);
}

/* ------------------------ helpers: date / clash logic ----------------- */

function toDate(d) {
  if (!d) return null;
  const x = new Date(d);
  return Number.isNaN(x.getTime()) ? null : x;
}

// true if [s1,e1] overlaps [s2,e2]
function rangesOverlap(s1, e1, s2, e2) {
  if (!s1 || !e1 || !s2 || !e2) return false;
  return s1 <= e2 && s2 <= e1;
}

/**
 * Given an array of accepted applications for one event, returns
 * ONLY those that are in a clash group:
 *  - same boothNumber (case-insensitive, trimmed)
 *  - AND overlapping reservation window.
 */
function findClashingApplications(apps) {
  const byBooth = new Map();

  for (const a of apps) {
    const key = String(a.boothNumber || "").trim().toUpperCase();
    if (!key) continue;

    const start = toDate(a.reservationStart);
    const end = toDate(a.reservationEnd);
    if (!start || !end) continue;

    if (!byBooth.has(key)) byBooth.set(key, []);
    byBooth.get(key).push({ ...a, _start: start, _end: end });
  }

  const clashingIds = new Set();

  for (const [, group] of byBooth.entries()) {
    if (group.length < 2) continue;

    // sort by start date to speed up overlap detection
    group.sort((a, b) => a._start - b._start);

    for (let i = 0; i < group.length; i++) {
      for (let j = i + 1; j < group.length; j++) {
        // early exit if next starts after current ends
        if (group[j]._start > group[i]._end) break;

        if (rangesOverlap(group[i]._start, group[i]._end, group[j]._start, group[j]._end)) {
          clashingIds.add(String(group[i]._id));
          clashingIds.add(String(group[j]._id));
        }
      }
    }
  }

  return apps.filter((a) => clashingIds.has(String(a._id)));
}

/* ------------------- GET /api/polls/eligible-vendors ------------------
 * Returns ONLY accepted BOOTH vendors for a given eventId
 * that are in a CLASH:
 *   - same boothNumber
 *   - overlapping reservation window.
 * Used by Events Office to build a poll.
 * ---------------------------------------------------------------------- */
export const listEligibleVendors = async (req, res) => {
  try {
    if (!req.user || !isAdminOrEventOffice(req.user)) {
      return res
        .status(403)
        .json({ status: "error", message: "Only Events Office/Admin can access this." });
    }

    const { eventId } = req.query;
    if (!eventId || !Types.ObjectId.isValid(eventId)) {
      return res
        .status(400)
        .json({ status: "error", message: "Valid eventId is required." });
    }

    const event = await Event.findById(eventId, {
      name: 1,
      title: 1,
      eventType: 1,
    }).lean();
    if (!event) {
      return res
        .status(404)
        .json({ status: "error", message: "Event not found." });
    }

    // All accepted applications for this event that have a boothNumber
    const appsRaw = await EventApplication.find(
      {
        eventId: new Types.ObjectId(eventId),
        status: "accepted",
        boothNumber: { $ne: null },
      },
      {
        _id: 1,
        userId: 1,
        applicantName: 1,
        boothNumber: 1,
        reservationStart: 1,
        reservationEnd: 1,
      }
    )
      .sort({ createdAt: -1 })
      .lean();

    // Filter down to ONLY clashing applications
    const clashing = findClashingApplications(appsRaw);

    const data = clashing.map((a) => ({
      applicationId: a._id,
      vendorId: a.userId,
      vendorName: a.applicantName || "Vendor",
      boothNumber: a.boothNumber || "",
      reservationStart: a.reservationStart || null,
      reservationEnd: a.reservationEnd || null,
    }));

    return res.json({
      status: "success",
      event: {
        id: event._id,
        name: event.name || event.title || "",
        eventType: event.eventType || "",
      },
      count: data.length,
      data,
    });
  } catch (err) {
    console.error("listEligibleVendors error:", err);
    return res
      .status(500)
      .json({ status: "error", message: err.message || "Server error" });
  }
};

/* -------------------------- POST /api/polls ---------------------------
 * Create a new poll for a given eventId from selected applications.
 * body: { eventId, title?, description?, applicationIds: [] }
 * Only admin/event_office.
 *
 * NEW LOGIC:
 *   - All selected applications must:
 *       • belong to this eventId
 *       • be accepted
 *       • have a boothNumber
 *       • share the SAME boothNumber
 *       • have OVERLAPPING reservation windows (i.e., there is a time clash)
 * ---------------------------------------------------------------------- */
export const createPoll = async (req, res) => {
  try {
    if (!req.user || !isAdminOrEventOffice(req.user)) {
      return res
        .status(403)
        .json({ status: "error", message: "Only Events Office/Admin can create polls." });
    }

    const { eventId, title, description, applicationIds } = req.body || {};

    if (!eventId || !Types.ObjectId.isValid(eventId)) {
      return res
        .status(400)
        .json({ status: "error", message: "Valid eventId is required." });
    }

    if (!Array.isArray(applicationIds) || applicationIds.length < 2) {
      return res.status(400).json({
        status: "error",
        message: "Select at least two applications to create a poll.",
      });
    }

    const event = await Event.findById(eventId, {
      name: 1,
      title: 1,
      eventType: 1,
    }).lean();
    if (!event) {
      return res
        .status(404)
        .json({ status: "error", message: "Event not found." });
    }

    const appObjectIds = applicationIds
      .filter((id) => Types.ObjectId.isValid(id))
      .map((id) => new Types.ObjectId(id));

    if (appObjectIds.length < 2) {
      return res.status(400).json({
        status: "error",
        message: "applicationIds must contain valid MongoDB ObjectIds.",
      });
    }

    // Only accepted applications for this event with booths
    const apps = await EventApplication.find(
      {
        _id: { $in: appObjectIds },
        eventId: new Types.ObjectId(eventId),
        status: "accepted",
        boothNumber: { $ne: null },
      },
      {
        _id: 1,
        userId: 1,
        applicantName: 1,
        boothNumber: 1,
        reservationStart: 1,
        reservationEnd: 1,
      }
    ).lean();

    if (apps.length < 2) {
      return res.status(400).json({
        status: "error",
        message:
          "Not enough valid accepted booth applications found for this event.",
      });
    }

    // Ensure SAME boothNumber across all selected apps
    const boothSet = new Set(
      apps.map((a) => String(a.boothNumber || "").trim().toUpperCase())
    );
    if (boothSet.size !== 1) {
      return res.status(400).json({
        status: "error",
        message:
          "Selected applications must be for the SAME booth number in order to create a poll.",
      });
    }

    // Ensure reservation windows overlap (there is a clash)
    const withDates = apps.map((a) => ({
      ...a,
      _start: toDate(a.reservationStart),
      _end: toDate(a.reservationEnd),
    }));

    if (withDates.some((a) => !a._start || !a._end)) {
      return res.status(400).json({
        status: "error",
        message:
          "All selected applications must have a reservationStart and reservationEnd.",
      });
    }

    let hasOverlap = false;
    for (let i = 0; i < withDates.length; i++) {
      for (let j = i + 1; j < withDates.length; j++) {
        if (
          rangesOverlap(
            withDates[i]._start,
            withDates[i]._end,
            withDates[j]._start,
            withDates[j]._end
          )
        ) {
          hasOverlap = true;
          break;
        }
      }
      if (hasOverlap) break;
    }

    if (!hasOverlap) {
      return res.status(400).json({
        status: "error",
        message:
          "Selected applications do not have overlapping reservation windows; there is no clash to resolve.",
      });
    }

    const options = apps.map((a) => ({
      applicationId: a._id,
      vendorId: a.userId,
      vendorName: a.applicantName || "Vendor",
      boothNumber: a.boothNumber || "",
    }));

    const poll = await Poll.create({
      eventId: new Types.ObjectId(eventId),
      title: (title && String(title).trim()) || "Vendor Poll",
      description: (description && String(description).trim()) || "",
      createdBy: req.user._id,
      options,
      votes: [],
      isOpen: true,
    });

    return res
      .status(201)
      .json({ status: "success", data: poll.toResponse(req.user._id) });
  } catch (err) {
    console.error("createPoll error:", err);
    return res
      .status(500)
      .json({ status: "error", message: err.message || "Server error" });
  }
};

/* --------------------------- GET /api/polls ---------------------------
 * List polls.
 * - Admin / Events Office:
 *    • can list ALL polls (optionally filtered by eventId)
 * - Students / Staff / TA / Professors:
 *    • can list only OPEN polls (optionally filtered by eventId)
 * ---------------------------------------------------------------------- */
export const listPolls = async (req, res) => {
  try {
    if (!req.user) {
      return res
        .status(401)
        .json({ status: "error", message: "Authentication required." });
    }

    const { eventId } = req.query;
    const isAdminEO = isAdminOrEventOffice(req.user);
    const isAcademic = isAcademicVoter(req.user);

    // Only Admin/EO or academic roles may see polls
    if (!isAdminEO && !isAcademic) {
      return res.status(403).json({
        status: "error",
        message:
          "Only Events Office/Admin or academic users (students, staff, TA, professors) can view polls.",
      });
    }

    const filter = {};

    if (eventId && Types.ObjectId.isValid(eventId)) {
      filter.eventId = new Types.ObjectId(eventId);
    }

    // Non-admin users should only see OPEN polls
    if (!isAdminEO) {
      filter.isOpen = true;
    }

    const polls = await Poll.find(filter).sort({ createdAt: -1 });

    // For academics we want "isMyChoice" info; for admin it's harmless as well
    const userId = req.user?._id || null;
    const mapped = polls.map((doc) => doc.toResponse(userId));

    return res.json({
      status: "success",
      count: mapped.length,
      data: mapped,
    });
  } catch (err) {
    console.error("listPolls error:", err);
    return res
      .status(500)
      .json({ status: "error", message: err.message || "Server error" });
  }
};

/* ------------------------ GET /api/polls/:id ---------------------------
 * Get a single poll. Anyone can view (optional auth),
 * but response includes "isMyChoice" if logged in.
 * ---------------------------------------------------------------------- */
export const getPollById = async (req, res) => {
  try {
    const { id } = req.params;
    if (!Types.ObjectId.isValid(id)) {
      return res
        .status(400)
        .json({ status: "error", message: "Invalid poll id." });
    }

    const poll = await Poll.findById(id);
    if (!poll) {
      return res
        .status(404)
        .json({ status: "error", message: "Poll not found." });
    }

    const userId = req.user?._id || null;
    return res.json({
      status: "success",
      data: poll.toResponse(userId),
    });
  } catch (err) {
    console.error("getPollById error:", err);
    return res
      .status(500)
      .json({ status: "error", message: err.message || "Server error" });
  }
};

/* ---------------------- POST /api/polls/:id/vote -----------------------
 * Student/Staff/TA/Professor vote for one vendor option.
 * Body: { optionId }
 * One vote per user per poll (later votes overwrite earlier).
 * ---------------------------------------------------------------------- */
export const votePoll = async (req, res) => {
  try {
    if (!req.user) {
      return res
        .status(401)
        .json({ status: "error", message: "Authentication required to vote." });
    }

    if (!isAcademicVoter(req.user) && !isAdminOrEventOffice(req.user)) {
      // allow admin/EO to test if needed; main target is academic roles
      return res.status(403).json({
        status: "error",
        message: "Only Students/Staff/TA/Professors can vote in polls.",
      });
    }

    const { id } = req.params;
    const { optionId } = req.body || {};

    if (!Types.ObjectId.isValid(id) || !Types.ObjectId.isValid(optionId)) {
      return res.status(400).json({
        status: "error",
        message: "Invalid poll id or optionId.",
      });
    }

    const poll = await Poll.findById(id);
    if (!poll) {
      return res
        .status(404)
        .json({ status: "error", message: "Poll not found." });
    }

    if (!poll.isOpen) {
      return res
        .status(400)
        .json({ status: "error", message: "Poll is closed." });
    }

    const opt = poll.options.id(optionId);
    if (!opt) {
      return res
        .status(400)
        .json({ status: "error", message: "Option not found in this poll." });
    }

    const userIdStr = String(req.user._id);

    // Remove any previous vote from this user
    poll.votes = (poll.votes || []).filter(
      (v) => String(v.userId) !== userIdStr
    );

    // Add new vote
    poll.votes.push({
      userId: req.user._id,
      optionId: opt._id,
      createdAt: new Date(),
    });

    await poll.save();

    return res.json({
      status: "success",
      data: poll.toResponse(req.user._id),
    });
  } catch (err) {
    console.error("votePoll error:", err);
    return res
      .status(500)
      .json({ status: "error", message: err.message || "Server error" });
  }
};

/* ---------------------- PATCH /api/polls/:id ---------------------------
 * Update basic poll fields (title, description, isOpen).
 * Only Events Office / Admin.
 * ---------------------------------------------------------------------- */
export const updatePoll = async (req, res) => {
  try {
    if (!req.user || !isAdminOrEventOffice(req.user)) {
      return res.status(403).json({
        status: "error",
        message: "Only Events Office/Admin can update polls.",
      });
    }

    const { id } = req.params;
    if (!Types.ObjectId.isValid(id)) {
      return res
        .status(400)
        .json({ status: "error", message: "Invalid poll id." });
    }

    const poll = await Poll.findById(id);
    if (!poll) {
      return res
        .status(404)
        .json({ status: "error", message: "Poll not found." });
    }

    const { title, description, isOpen } = req.body || {};

    if (typeof title === "string") {
      const trimmed = title.trim();
      if (!trimmed) {
        return res.status(400).json({
          status: "error",
          message: "Title cannot be empty.",
        });
      }
      poll.title = trimmed;
    }

    if (typeof description === "string") {
      poll.description = description.trim();
    }

    if (typeof isOpen === "boolean") {
      poll.isOpen = isOpen;
    }

    await poll.save();

    return res.json({
      status: "success",
      data: poll.toResponse(req.user._id),
    });
  } catch (err) {
    console.error("updatePoll error:", err);
    return res
      .status(500)
      .json({ status: "error", message: err.message || "Server error" });
  }
};

/* ---------------------- DELETE /api/polls/:id --------------------------
 * Delete a poll completely.
 * Only Events Office / Admin.
 * ---------------------------------------------------------------------- */
export const deletePoll = async (req, res) => {
  try {
    if (!req.user || !isAdminOrEventOffice(req.user)) {
      return res.status(403).json({
        status: "error",
        message: "Only Events Office/Admin can delete polls.",
      });
    }

    const { id } = req.params;
    if (!Types.ObjectId.isValid(id)) {
      return res
        .status(400)
        .json({ status: "error", message: "Invalid poll id." });
    }

    const deleted = await Poll.findByIdAndDelete(id);
    if (!deleted) {
      return res
        .status(404)
        .json({ status: "error", message: "Poll not found." });
    }

    return res.json({
      status: "success",
      message: "Poll deleted successfully.",
    });
  } catch (err) {
    console.error("deletePoll error:", err);
    return res
      .status(500)
      .json({ status: "error", message: err.message || "Server error" });
  }
};
