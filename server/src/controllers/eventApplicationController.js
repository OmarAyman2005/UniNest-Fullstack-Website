// server/src/controllers/eventApplicationController.js
import mongoose from "mongoose";
import path from "path";
import fs from "fs/promises";

import BoothNumber from "../models/BoothNumber.js";
import { EventApplication } from "../models/EventApplication.js";
import { Event } from "../models/Event.js";
import User from "../models/User.js";
import { createEventApplicationSchema, updateEventApplicationSchema, loyaltyProgramApplicationSchema } from "../validators/eventApplicationValidation.js";
import { boothReserveSchema } from "../validators/boothNumberValidation.js";
import crypto from "crypto";
import { sendEmail } from "../utils/sendEmail.js";
import { CLIENT_URL } from "../config/env.js";
import PDFDocument from "pdfkit";

import { sendApplicationStatusEmail } from "../utils/applicationNotificationEmail.js";
import { createAndSendInvoiceForApplication } from "../utils/paymentsV.js";
import { Payment } from "../models/PaymentV.js"; // ✅ NEW
import { Notification } from "../models/Notification.js";
import { pushNotification } from "./notifications.controller.js";

const UPLOAD_DIR = path.join(process.cwd(), "uploads", "ids");
(async () => { try { await fs.mkdir(UPLOAD_DIR, { recursive: true }); } catch (_) {} })();
import Wallet from "../models/Wallet.js";

/* ------------------------- GET /api/applications/:id ------------------------ */
export const getApplicationById = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ status: "error", message: "Invalid application id" });
    }

    const hasRef =
      EventApplication.schema.path("eventId")?.options?.ref === "Event" ||
      EventApplication.schema.path("event")?.options?.ref === "Event";

    const query = EventApplication.findById(id);
    if (hasRef) {
      if (EventApplication.schema.path("eventId")) query.populate("eventId");
      if (EventApplication.schema.path("event"))   query.populate("event");
    }

    let app = await query.lean();
    if (!app) return res.status(404).json({ status: "error", message: "Application not found" });

    let eventDoc = null;
    if (app.event) eventDoc = app.event;
    else if (app.eventId && typeof app.eventId === "object" && app.eventId !== null) eventDoc = app.eventId;
    else if (app.eventId && mongoose.Types.ObjectId.isValid(app.eventId)) eventDoc = await Event.findById(app.eventId).lean();

    const eventIdStr =
      app.event?._id ? String(app.event._id)
      : (typeof app.eventId === "object" && app.eventId !== null) ? String(app.eventId._id)
      : app.eventId ? String(app.eventId) : null;

    const { event, eventId, ...rest } = app;
    return res.json({ status: "success", data: { ...rest, eventId: eventIdStr, event: eventDoc || null } });
  } catch (err) {
    console.error("Error fetching application:", err);
    return res.status(500).json({ status: "error", message: err.message });
  }
};

/* ----------------------- POST /api/applications ----------------------------- */
export const createApplication = async (req, res) => {
  try {
    const isBoothPlat =
      (typeof req.body.boothNumber === "string" && req.body.boothNumber.trim() !== "") || !!req.body.startDate;

    const { value, error } = (isBoothPlat ? boothReserveSchema : createEventApplicationSchema)
      .validate(req.body, { abortEarly: false, stripUnknown: true });
    if (error) return res.status(400).json({ status: "error", message: error.message });

    const ev = await Event.findById(value.eventId).lean();
    if (!ev) return res.status(404).json({ status: "error", message: "Event not found" });

    // build applicantName from user
    let applicantName = "";
    if (value.userId) {
      const u = await User.findById(value.userId, { fullName: 1, firstName: 1, lastName: 1, email: 1 }).lean();
      applicantName =
        (u?.fullName && String(u.fullName).trim()) ||
        ([u?.firstName, u?.lastName].filter(Boolean).join(" ").trim()) ||
        (u?.email || "");
    }
    if (!applicantName) {
      applicantName =
        (value.applicantName && String(value.applicantName).trim()) ||
        ((Array.isArray(value.participants) && value.participants[0]?.name) ? String(value.participants[0].name).trim() : "");
    }
    if (applicantName) value.applicantName = applicantName;

    if (isBoothPlat) {
      const weeks = Number(value.durationWeeks ?? value.setupDurationWeeks);
      if (!weeks || weeks < 1 || weeks > 4) {
        return res.status(400).json({ status: "error", message: "Invalid duration (weeks)." });
      }

      const reservationStart = new Date(value.startDate);
      if (isNaN(reservationStart.getTime())) {
        return res.status(400).json({ status: "error", message: "startDate is invalid." });
      }

      const reservationEnd = new Date(reservationStart);
      reservationEnd.setUTCDate(reservationEnd.getUTCDate() + weeks * 7 - 1);

      if (ev.endDateTime) {
        const eventEnd = new Date(ev.endDateTime);
        if (reservationEnd > eventEnd) {
          return res.status(400).json({ status: "error", message: "Requested range extends beyond the event end date." });
        }
      }

      const boothKey = String(value.boothNumber).trim().toUpperCase();

      const overlapExists = await EventApplication.exists({
        eventId: value.eventId,
        boothNumber: boothKey,
        status: { $in: ["pending", "accepted"] },
        reservationStart: { $lte: reservationEnd },
        reservationEnd:   { $gte: reservationStart },
      });

      // If overlap detected, only warn — still create the application.
      let overlapWarning = null;
      if (overlapExists) {
        overlapWarning = "Booth reservation window overlaps an existing reservation.";
        console.warn(`[Booth Reservation] overlap detected for event ${value.eventId} booth ${boothKey}`);
      }

      const doc = await EventApplication.create({
        ...value,
        boothNumber: boothKey,
        setupDurationWeeks: weeks,
        reservationStart,
        reservationEnd,
      });

      // Persist the warning into the application's notes so staff can see it in the DB
      if (overlapWarning) {
        try {
          doc.notes = doc.notes ? `${doc.notes}\n[WARN] ${overlapWarning}` : `[WARN] ${overlapWarning}`;
          await doc.save();
        } catch (noteErr) {
          console.error('Failed to persist overlap warning on application notes:', noteErr);
        }
      }
      
      // Notify event_office and admin users about the new booth reservation
      try {
        const adminUsers = await User.find({ role: { $in: ['event_office', 'admin'] } }).select('_id role').lean();
        console.log(`[Booth Reservation] Notifying ${adminUsers.length} admin/event_office users about new reservation`);
        
        if (adminUsers.length > 0) {
          const eventName = ev?.name || 'an event';
          const applicantDisplayName = applicantName || 'A vendor';
          
          const notificationPromises = adminUsers.map(user => {
            console.log(`[Booth Reservation] Sending notification to user ${user._id} with role ${user.role}`);
            return pushNotification({
              user: user._id,
              title: 'New Booth Reservation',
              body: `${applicantDisplayName} has submitted a booth reservation for "${eventName}" (Booth #${boothKey}).`,
              meta: {
                kind: 'booth_reservation_new',
                applicationId: doc._id,
                eventId: value.eventId,
                userId: value.userId,
                boothNumber: boothKey,
                timestamp: Date.now(),
              },
            });
          });
          await Promise.allSettled(notificationPromises);
        }
      } catch (notifErr) {
        console.error('Failed to send booth reservation notifications:', notifErr);
        // Don't fail the reservation if notification fails
      }
      
      return res.status(201).json({ status: "success", data: doc });
    }

    // Bazaar branch
    if (value.durationWeeks && !value.setupDurationWeeks) value.setupDurationWeeks = value.durationWeeks;
    const doc = await EventApplication.create({ ...value });
    
    // Notify event_office and admin users about the new vendor application
    try {
      const adminUsers = await User.find({ role: { $in: ['event_office', 'admin'] } }).select('_id role').lean();
      console.log(`[Vendor Application] Notifying ${adminUsers.length} admin/event_office users about new application`);
      
      if (adminUsers.length > 0) {
        const eventName = ev?.name || 'an event';
        const applicantDisplayName = applicantName || 'A vendor';
        
        const notificationPromises = adminUsers.map(user => {
          console.log(`[Vendor Application] Sending notification to user ${user._id} with role ${user.role}`);
          return pushNotification({
            user: user._id,
            title: 'New Vendor Application',
            body: `${applicantDisplayName} has submitted a new vendor application for "${eventName}".`,
            meta: {
              kind: 'vendor_application_new',
              applicationId: doc._id,
              eventId: value.eventId,
              userId: value.userId,
              timestamp: Date.now(),
            },
          });
        });
        await Promise.allSettled(notificationPromises);
      }
    } catch (notifErr) {
      console.error('Failed to send vendor application notifications:', notifErr);
      // Don't fail the application creation if notification fails
    }
    
    return res.status(201).json({ status: "success", data: doc });
  } catch (err) {
    if (err?.code === 11000) return res.status(409).json({ status: "error", message: "Duplicate key." });
    return res.status(500).json({ status: "error", message: err.message });
  }
};

/* ----------------------- GET /api/applications ------------------------------ */
export const listApplications = async (req, res) => {
  try {
    const { eventId, userId, status, eventType } = req.query;
    const filter = {};
    if (eventId) filter.eventId = eventId;
    if (userId)  filter.userId  = userId;
    if (status)  filter.status  = status;

    // If eventType is provided, allow comma-separated values and filter applications
    // by resolving Event IDs whose Event.eventType matches any of the requested types.
    if (eventType) {
      const parts = String(eventType)
        .split(",")
        .map((s) => String(s || "").trim())
        .filter(Boolean);
      if (parts.length > 0) {
        // Normalize known special casing (e.g. loyaltyProgram)
        const normalized = parts.map((p) => {
          const low = p.toLowerCase();
          return low === "loyaltyprogram" ? "loyaltyProgram" : low;
        });

        // If an explicit eventId was provided, ensure that that event matches one of the types
        if (filter.eventId) {
          // fetch the event and check its type
          if (mongoose.Types.ObjectId.isValid(String(filter.eventId))) {
            const ev = await Event.findById(filter.eventId, { eventType: 1 }).lean();
            if (!ev) {
              return res.json({ status: "success", count: 0, data: [] });
            }
            const evType = String(ev.eventType || "");
            // match when normalized includes evType
            if (!normalized.includes(evType) && !normalized.includes(evType.toLowerCase())) {
              return res.json({ status: "success", count: 0, data: [] });
            }
            // else keep existing filter.eventId
          } else {
            // invalid eventId format — return empty
            return res.json({ status: "success", count: 0, data: [] });
          }
        } else {
          // find events matching the requested eventType(s)
          const evs = await Event.find({ eventType: { $in: normalized } }, { _id: 1 }).lean();
          const evIds = evs.map((e) => String(e._id));
          if (evIds.length === 0) {
            return res.json({ status: "success", count: 0, data: [] });
          }
          filter.eventId = { $in: evIds };
        }
      }
    }

    const apps = await EventApplication.find(filter).sort({ createdAt: -1 }).lean();
    return res.json({ status: "success", count: apps.length, data: apps });
  } catch (err) {
    return res.status(500).json({ status: "error", message: err.message });
  }
};

/* --------------------- PATCH /api/applications/:id -------------------------- */
export const updateApplication = async (req, res) => {
  try {
    const { value, error } = updateEventApplicationSchema.validate(req.body, { abortEarly: false, stripUnknown: true });
    if (error) return res.status(400).json({ status: "error", message: error.message });

    if (!value.applicantName && Array.isArray(value.participants) && value.participants.length > 0) {
      const firstP = value.participants[0];
      if (firstP?.name) value.applicantName = String(firstP.name).trim();
    }

    const app = await EventApplication.findByIdAndUpdate(req.params.id, { ...value }, { new: true, runValidators: true });
    if (!app) return res.status(404).json({ status: "error", message: "Application not found" });

    return res.json({ status: "success", data: app });
  } catch (err) {
    return res.status(500).json({ status: "error", message: err.message });
  }
};

/* --------------------- DELETE /api/applications/:id ------------------------- */
export const deleteApplication = async (req, res) => {
  try {
    const app = await EventApplication.findByIdAndDelete(req.params.id);
    if (!app) return res.status(404).json({ status: "error", message: "Application not found" });

    return res.json({ status: "success", message: "Application deleted", id: req.params.id });
  } catch (err) {
    return res.status(500).json({ status: "error", message: err.message });
  }
};

/* ---------------- internal status transition helper ------------------------ */
/* ---------------- internal status transition helper ------------------------ */
/* ---------------- internal status transition helper ------------------------ */
async function setStatusOrFail(id, nextStatus, { reason } = {}) {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    const err = new Error("Invalid application id");
    err.status = 400;
    throw err;
  }

  const app = await EventApplication.findById(id);
  if (!app) {
    const err = new Error("Application not found");
    err.status = 404;
    throw err;
  }

  // ── Status transition rules ──────────────────────────────────────────────
  if (nextStatus === "cancelled") {
    // UPDATED LOGIC:
    // Allow cancelling if Pending OR Accepted.
    // (We rely on cancelApplication to check if payment exists for accepted apps)
    
    const isPending = app.status === "pending";
    const isAccepted = app.status === "accepted";

    if (!isPending && !isAccepted) {
      const err = new Error(
        `Cannot change status from '${app.status}' to '${nextStatus}'. ` +
        `Only 'pending' or 'accepted' applications can be cancelled.`
      );
      err.status = 409;
      throw err;
    }
  } else {
    // For accept / reject (nextStatus !== "cancelled")
    // Only pending can transition to accepted/rejected
    if (app.status !== "pending") {
      const err = new Error(
        `Cannot change status from '${app.status}' to '${nextStatus}'. Only 'pending' can transition.`
      );
      err.status = 409;
      throw err;
    }
  }

  // Requirement: on accept, each participant must have at least one ID file
  if (nextStatus === "accepted") {
    const participants = app.participants || [];
    for (let i = 0; i < participants.length; i++) {
      if (!participants[i].idDocs || participants[i].idDocs.length === 0) {
        const err = new Error(`Participant #${i + 1} is missing an ID file.`);
        err.status = 422;
        throw err;
      }
    }
  }

  app.status = nextStatus;

  if (reason) {
    app.notes = app.notes
      ? `${app.notes}\n[${nextStatus.toUpperCase()}] ${reason}`
      : `[${nextStatus.toUpperCase()}] ${reason}`;
  }

  await app.save();
  return app;
}

/* -------------------- POST /api/applications/:id/accept --------------------- */
export const acceptApplication = async (req, res) => {
  try {
    const { id } = req.params;
    const app = await setStatusOrFail(id, "accepted", { reason: req.body?.reason });

    // 1) Send status email (non-blocking)
    sendApplicationStatusEmail(app, req.user).catch(console.error);

    // 2) Create + send Stripe invoice with 3-day due date (non-blocking)
    createAndSendInvoiceForApplication(app)
      .then(({ hostedUrl }) => {
        if (hostedUrl) console.log("[stripe] hosted_invoice_url:", hostedUrl);
      })
      .catch(err => console.error("createAndSendInvoiceForApplication error:", err));

    return res.json({ status: "success", data: app });
  } catch (err) {
    console.error("acceptApplication error:", err);
    return res.status(err.status || 500).json({ status: "error", message: err.message });
  }
};

/* -------------------- POST /api/applications/:id/reject --------------------- */
export const rejectApplication = async (req, res) => {
  try {
    const { id } = req.params;
    const app = await setStatusOrFail(id, "rejected", { reason: req.body?.reason || "Rejected by staff." });
    sendApplicationStatusEmail(app, req.user).catch(console.error);
    return res.json({ status: "success", data: app });
  } catch (err) {
    console.error("rejectApplication error:", err);
    return res.status(err.status || 500).json({ status: "error", message: err.message });
  }
};

/* -------------------- POST /api/applications/:id/cancel --------------------- */
export const cancelApplication = async (req, res) => {
  try {
    const { id } = req.params;

    // ✅ New rule: vendor can cancel ONLY if there is NO paid payment
    const paidPayment = await Payment.findOne({
      applicationId: id,
      status: "paid",
    }).lean();

    if (paidPayment) {
      return res.status(409).json({
        status: "error",
        message: "You cannot cancel this application because payment has already been completed.",
      });
    }

    const app = await setStatusOrFail(id, "cancelled", {
      reason: req.body?.reason || "Cancelled by applicant.",
    });

    sendApplicationStatusEmail(app, req.user).catch(console.error);
    return res.json({ status: "success", data: app });
  } catch (err) {
    console.error("cancelApplication error:", err);
    return res.status(err.status || 500).json({ status: "error", message: err.message });
  }
};

/* -------------------- POST /api/applications/:id/cancelEvent --------------------- */
export const cancelEvent = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ status: "error", message: "Invalid application id" });
    }

    const app = await EventApplication.findById(id).lean();
    if (!app) return res.status(404).json({ status: "error", message: "Application not found" });

    const appDoc = await EventApplication.findById(id);
    if (!appDoc) return res.status(404).json({ status: "error", message: "Application not found" });

    // Determine userId from application
    const userId = appDoc.userId || null;
    if (!userId) return res.status(400).json({ status: "error", message: "User id not available for refund" });

    // We are already sure the user paid before registering — use the Event price as refund amount
    const ev = await Event.findById(appDoc.eventId).lean();
    if (!ev) return res.status(404).json({ status: "error", message: "Event not found; cannot determine refund amount" });

    // Cancellation policy: only allow cancellation if there are at least 2 weeks until event start
    const startVal = ev.startDateTime || ev.startDate || ev.start || null;
    if (!startVal) {
      return res.status(400).json({ status: "error", message: "Event has no start date; cannot determine cancellation period" });
    }
    const startDate = new Date(startVal);
    if (isNaN(startDate.getTime())) {
      return res.status(400).json({ status: "error", message: "Invalid event start date; cannot determine cancellation period" });
    }
    const now = new Date();
    const msUntilStart = startDate.getTime() - now.getTime();
    const TWO_WEEKS_MS = 14 * 24 * 60 * 60 * 1000;
    if (msUntilStart < TWO_WEEKS_MS) {
      return res.status(409).json({ status: "error", message: "Cannot cancel within 2 weeks of event start" });
    }

    const amount = Number(ev.price ?? 0);
    if (!Number.isFinite(amount) || amount <= 0) {
      return res.status(400).json({ status: "error", message: "Event has no valid price to refund" });
    }

    // ensure wallet exists or create one
    let wallet = await Wallet.findByUserId(String(userId));
    if (!wallet && typeof Wallet.ensureForUser === "function") {
      // try to create/ensure wallet
      try {
        wallet = await Wallet.ensureForUser(String(userId));
      } catch (e) {
        // ignore, will error below if still not found
      }
    }
    if (!wallet) return res.status(404).json({ status: "error", message: "Wallet not found for user; cannot refund" });

    // Credit the wallet
    try {
      await wallet.credit(amount);
    } catch (err) {
      console.error("wallet.credit failed:", err);
      return res.status(500).json({ status: "error", message: "Failed to credit wallet" });
    }

    // mark application payment as refunded
    try {
      appDoc.payment = appDoc.payment || {};
      appDoc.payment.status = "refunded";
      appDoc.payment.refundedAt = new Date();
      await appDoc.save();
    } catch (err) {
      console.error("mark application payment refunded failed:", err);
      // continue but warn
    }

    // Update application status directly (skip setStatusOrFail as requested)
    let updatedApp;
    try {
      const noteReason = req.body?.reason || "Cancelled and refunded to wallet";
      appDoc.status = "cancelled";
      appDoc.notes = appDoc.notes ? `${appDoc.notes}\n[CANCELLED] ${noteReason}` : `[CANCELLED] ${noteReason}`;
      await appDoc.save();
      updatedApp = appDoc;
    } catch (err) {
      console.error("failed to update application status directly:", err);
      return res.status(500).json({ status: "error", message: "Failed to cancel application" });
    }

    // return refreshed wallet balance
    const refreshed = await Wallet.findByUserId(String(userId));

    return res.json({ status: "success", message: "Application cancelled and refunded to wallet", refunded: amount, wallet: refreshed });
  } catch (err) {
    console.error("cancelEvent error:", err);
    return res.status(500).json({ status: "error", message: err.message });
  }
};

/* -------------- GET /api/applications/by-booth?eventId&boothNumber --------- */
export const getApplicationsByEventAndBooth = async (req, res) => {
  try {
    const { eventId, boothNumber } = req.query;

    if (!eventId || !mongoose.Types.ObjectId.isValid(eventId))
      return res.status(400).json({ status: "error", message: "Invalid or missing eventId" });
    if (!boothNumber)
      return res.status(400).json({ status: "error", message: "Missing boothNumber" });

    const eventIdObj = new mongoose.Types.ObjectId(eventId);
    const boothKey = String(boothNumber).trim().toUpperCase();
    const ACTIVE = ["pending", "accepted"];

    const boothDoc = await BoothNumber.findOne({ boothNumber: boothKey }).lean();

    const proj = {
      _id: 1, userId: 1, eventId: 1, boothNumber: 1, status: 1,
      setupDurationWeeks: 1, reservationStart: 1, reservationEnd: 1,
      createdAt: 1, updatedAt: 1, applicantName: 1,
    };

    const appsThisEventRaw = await EventApplication
      .find({ eventId: eventIdObj, boothNumber: boothKey, status: { $in: ACTIVE } }, proj)
      .sort({ createdAt: -1 }).lean();

    const applications = appsThisEventRaw.map(a => ({ ...a, start: a.reservationStart ?? null, end: a.reservationEnd ?? null }));

    const appsOtherEventsRaw = await EventApplication
      .find({ boothNumber: boothKey, eventId: { $ne: eventIdObj }, status: { $in: ACTIVE } }, proj)
      .sort({ createdAt: -1 }).lean();

    const boothLinkedApplications = appsOtherEventsRaw.map(a => ({
      ...a, start: a.reservationStart ?? null, end: a.reservationEnd ?? null, _fromBoothLink: true,
    }));

    const reservations = applications
      .filter(a => a.reservationStart && a.reservationEnd)
      .map(a => ({ applicationId: a._id, status: a.status, start: a.reservationStart, end: a.reservationEnd, userId: a.userId, applicantName: a.applicantName ?? null }));

    return res.json({
      status: "success",
      count: applications.length,
      data: { applications, boothLinkedApplications, reservations, booth: boothDoc || null },
    });
  } catch (err) {
    return res.status(500).json({ status: "error", message: err.message });
  }
};

export const checkAttendance = async (req, res) => {
  try {
    const userId = (req.user && (req.user.id || req.user._id)) || req.query.userId || req.body?.userId;
    const eventId = req.query.eventId || req.body?.eventId || req.params?.eventId;

    if (!userId || !mongoose.Types.ObjectId.isValid(String(userId))) {
      return res.status(400).json({ status: "error", message: "Missing or invalid userId" });
    }
    if (!eventId || !mongoose.Types.ObjectId.isValid(String(eventId))) {
      return res.status(400).json({ status: "error", message: "Missing or invalid eventId" });
    }

    // load event to read end date
    const ev = await Event.findById(eventId).lean();
    if (!ev) return res.status(404).json({ status: "error", message: "Event not found" });

    const endVal = ev.endDateTime || ev.endDate || ev.end || null;
    if (!endVal) {
      // can't determine attendance without an end date
      return res.json({ status: "success", attended: false, reason: "event has no end date" });
    }

    const endDate = new Date(endVal);
    if (isNaN(endDate.getTime())) {
      return res.json({ status: "success", attended: false, reason: "invalid event end date" });
    }

    const now = new Date();
    if (now <= endDate) {
      // event not finished yet
      return res.json({ status: "success", attended: false, reason: "event has not ended yet" });
    }

    // check if a matching application exists
    const appExists = await EventApplication.exists({ userId: String(userId), eventId: String(eventId) });
    return res.json({ status: "success", attended: Boolean(appExists) });
  } catch (err) {
    console.error("checkAttendance error:", err);
    return res.status(500).json({ status: "error", message: err.message });
  }
};

/* --------- POST /api/applications/:id/participants/:index/id (multipart) ---- */
export const uploadParticipantId = async (req, res) => {
  try {
    const { id, index } = req.params;
    const idx = Number(index);
    if (!Number.isInteger(idx) || idx < 0) {
      return res.status(400).json({ status: "error", message: "Invalid participant index" });
    }

    const app = await EventApplication.findById(id);
    if (!app) return res.status(404).json({ status: "error", message: "Application not found" });
    if (!app.participants?.[idx]) return res.status(404).json({ status: "error", message: "Participant not found" });

    if (!req.file) return res.status(400).json({ status: "error", message: "Missing ID file" });

    const filename = `${id}_${idx}_${Date.now()}_${req.file.originalname}`;
    const filePath = path.join(UPLOAD_DIR, filename);
    await fs.writeFile(filePath, req.file.buffer);

    const doc = {
      file: { url: `/uploads/ids/${filename}`, key: filename, mime: req.file.mimetype, size: req.file.size },
      uploadedAt: new Date(),
      verification: { status: "pending" },
    };

    app.participants[idx].idDocs.push(doc);
    await app.save();

    return res.status(201).json({ status: "success", data: app.participants[idx].idDocs.slice(-1)[0] });
  } catch (err) {
    console.error("uploadParticipantId error:", err);
    return res.status(500).json({ status: "error", message: err.message });
  }
};

export const sendCertificate = async (req, res) => {
  try {
    const userId = (req.user && (req.user.id || req.user._id)) || req.body?.userId || req.query.userId;
    const eventId = req.body?.eventId || req.query?.eventId || req.params?.eventId;

    if (!userId || !mongoose.Types.ObjectId.isValid(String(userId))) {
      return res.status(400).json({ status: "error", message: "Missing or invalid userId" });
    }
    if (!eventId || !mongoose.Types.ObjectId.isValid(String(eventId))) {
      return res.status(400).json({ status: "error", message: "Missing or invalid eventId" });
    }

    const ev = await Event.findById(eventId).lean();
    if (!ev) return res.status(404).json({ status: "error", message: "Event not found" });

    const endVal = ev.endDateTime || ev.endDate || ev.end || null;
    if (!endVal) {
      return res.status(400).json({ status: "error", message: "Event has no end date" });
    }
    const endDate = new Date(endVal);
    if (isNaN(endDate.getTime())) {
      return res.status(400).json({ status: "error", message: "Invalid event end date" });
    }

    const now = new Date();
    if (now <= endDate) {
      return res.status(400).json({ status: "error", message: "Event has not ended yet" });
    }

    const appExists = await EventApplication.exists({ userId: String(userId), eventId: String(eventId) });
    if (!appExists) {
      return res.status(400).json({ status: "error", message: "User did not attend / no application found" });
    }

    // attach token to the application so the certificate can be verified / fetched later
    const token = crypto.randomBytes(24).toString("hex");
    const app = await EventApplication.findOneAndUpdate(
      { userId: String(userId), eventId: String(eventId) },
      { $set: { certificateToken: token, certificateIssuedAt: new Date() } },
      { new: true, upsert: false }
    );

    const user = await User.findById(userId).lean();
    const recipient = user?.email || req.body?.email;
    if (!recipient) {
      return res.status(400).json({ status: "error", message: "Recipient email not available" });
    }

    const certUrl = `${CLIENT_URL.replace(/\/$/, "")}/certificate?token=${encodeURIComponent(token)}`;

    const html = `
      <div style="font-family:Arial,sans-serif;line-height:1.5;color:#222">
        <h2 style="margin:0 0 8px">Your Certificate of Attendance</h2>
        <p>Dear ${user?.fullName || ""},</p>
        <p>Thank you for attending <strong>${ev.name || "the event"}</strong>. You can download or view your certificate using the link below:</p>
        <p>
          <a href="${certUrl}" style="background:#000;padding:10px 16px;border-radius:8px;color:#fff;text-decoration:none;display:inline-block">
            View / Download Certificate
          </a>
        </p>
        <p style="font-size:12px;color:#666">If the button doesn't work, copy & paste this link:</p>
        <p style="font-size:12px;color:#0066cc;word-break:break-all">${certUrl}</p>
        <p style="font-size:12px;color:#666">Issued: ${new Date().toISOString()}</p>
      </div>
    `;

    // generate PDF certificate and attach
    let attachments;
    try {
      const pdfBuffer = await new Promise((resolve, reject) => {
        try {
          const doc = new PDFDocument({ size: "A4", margin: 50 });
          const bufs = [];
          doc.on("data", (d) => bufs.push(d));
          doc.on("end", () => resolve(Buffer.concat(bufs)));

          // Simple, professional certificate layout
          doc.fillColor("#222");
          doc.fontSize(20).text("Certificate of Attendance", { align: "center" });
          doc.moveDown(1.5);
          doc.fontSize(12).text(`This is to certify that`, { align: "center" });
          doc.moveDown(0.5);
          doc.fontSize(16).font("Helvetica-Bold").text(`${user?.fullName || ""}`, { align: "center" });
          doc.moveDown(0.8);
          doc.fontSize(12).font("Helvetica").text(`has attended`, { align: "center" });
          doc.moveDown(0.6);
          doc.fontSize(14).font("Helvetica-Bold").text(`${ev.name || "the event"}`, { align: "center" });
          doc.moveDown(1.2);
          const dateStr = (ev.startDateTime || ev.startDate || ev.start) ? `${new Date(ev.startDateTime || ev.startDate || ev.start).toLocaleDateString()} - ${new Date(ev.endDateTime || ev.endDate || ev.end).toLocaleDateString()}` : `Issued: ${new Date().toLocaleDateString()}`;
          doc.fontSize(10).font("Helvetica").text(dateStr, { align: "center" });
          doc.moveDown(2);

          // Organizer / signature placeholder
          doc.fontSize(11).text(`Organizer: ${ev.createdBy || "GUC"}`, 80, doc.y, { align: "left" });
          doc.text(`Certificate ID: ${token}`, { align: "right" });

          doc.end();
        } catch (e) {
          reject(e);
        }
      });

      attachments = [
        {
          filename: `${(ev.name || "certificate").replace(/[^a-z0-9_\-\.]/gi, "_")}_certificate.pdf`,
          content: pdfBuffer,
          contentType: "application/pdf",
        },
      ];
    } catch (pdfErr) {
      console.error("PDF generation failed, sending email without attachment:", pdfErr);
      attachments = undefined;
    }

    try {
      await sendEmail({
        to: recipient,
        subject: `Certificate of Attendance — ${ev.name || "Event"}`,
        html,
        text: `View your certificate: ${certUrl}`,
        attachments,
      });
    } catch (mailErr) {
      console.error("sendCertificate email error:", mailErr);
      // continue, return success but indicate email failed
      return res.json({ status: "success", message: "Certificate generated but sending email failed", certificateUrl: certUrl });
    }

    return res.json({ status: "success", message: "Certificate sent", certificateUrl: certUrl });
  } catch (err) {
    console.error("sendCertificate error:", err);
    return res.status(500).json({ status: "error", message: err.message });
  }
};

/* ---- PATCH /api/applications/:id/participants/:index/id/meta (URL only) ---- */
export const attachParticipantIdMeta = async (req, res) => {
  try {
    const { id, index } = req.params;
    const idx = Number(index);
    if (!Number.isInteger(idx) || idx < 0)
      return res.status(400).json({ status: "error", message: "Invalid participant index" });

    const app = await EventApplication.findById(id);
    if (!app) return res.status(404).json({ status: "error", message: "Application not found" });
    if (!app.participants?.[idx]) return res.status(404).json({ status: "error", message: "Participant not found" });

    const { file } = req.body ?? {};
    if (!file?.url) return res.status(400).json({ status: "error", message: "file.url is required" });

    const doc = {
      file: {
        url: file.url,
        key: file.key || undefined,
        mime: file.mime || undefined,
        size: typeof file.size === "number" ? file.size : undefined,
      },
      uploadedAt: new Date(),
      verification: { status: "pending" },
    };

    app.participants[idx].idDocs.push(doc);
    await app.save();

    return res.status(201).json({ status: "success", data: app.participants[idx].idDocs.slice(-1)[0] });
  } catch (err) {
    console.error("attachParticipantIdMeta error:", err);
    return res.status(500).json({ status: "error", message: err.message });
  }
};

/* --- POST /api/applications/:id/participants/:index/id/:docId/verify -------- */
export const verifyParticipantId = async (req, res) => {
  try {
    const { id, index, docId } = req.params;
    const idx = Number(index);
    const app = await EventApplication.findById(id);
    if (!app) return res.status(404).json({ status: "error", message: "Application not found" });

    const p = app.participants?.[idx];
    if (!p) return res.status(404).json({ status: "error", message: "Participant not found" });

    const doc = p.idDocs.id(docId);
    if (!doc) return res.status(404).json({ status: "error", message: "ID document not found" });

    const { status = "verified", notes = "" } = req.body ?? {};
    if (!["pending", "verified", "rejected"].includes(status)) {
      return res.status(400).json({ status: "error", message: "Invalid verification status" });
    }

    doc.verification = { status, by: req.user?._id || null, at: new Date(), notes };
    await app.save();
    return res.json({ status: "success", data: doc });
  } catch (err) {
    console.error("verifyParticipantId error:", err);
    return res.status(500).json({ status: "error", message: err.message });
  }
};

/* -----------------------------------------------------------
 * POST /api/application/loyalty
 * Creates a Loyalty Program application (subdoc in EventApplication)
 * applicantName is ALWAYS the user's fullName from DB (via userId).
 * --------------------------------------------------------- */
export const createLoyaltyProgramApplication = async (req, res) => {
  try {
    // 1) Validate body
    const { value, error } = loyaltyProgramApplicationSchema.validate(req.body, {
      abortEarly: false,
      stripUnknown: true,
    });
    if (error) {
      return res
        .status(400)
        .json({ status: "error", message: error.message });
    }

    // 2) Ensure event exists and (optionally) is of the right type
    const ev = await Event.findById(value.eventId).lean();
    if (!ev) {
      return res
        .status(404)
        .json({ status: "error", message: "Event not found" });
    }
    const evType = String(ev.eventType || "").toLowerCase();
    if (evType && evType !== "loyaltyprogram") {
      return res.status(400).json({
        status: "error",
        message: `Event is '${ev.eventType}', not 'loyaltyProgram'.`,
      });
    }

    // 3) Resolve applicantName STRICTLY from user.fullName
    if (!value.userId || !mongoose.Types.ObjectId.isValid(value.userId)) {
      return res
        .status(400)
        .json({ status: "error", message: "Valid userId is required" });
    }

    const user = await User.findById(value.userId, { fullName: 1 }).lean();
    if (!user) {
      return res
        .status(404)
        .json({ status: "error", message: "User not found" });
    }

    const applicantName = (user.fullName || "").trim();
    if (!applicantName) {
      // Hard fail per requirement: must be the user's fullName
      return res.status(400).json({
        status: "error",
        message:
          "User fullName is required to submit a loyalty program application.",
      });
    }

    // 4) Build payload (ignore any applicantName from client; ignore participants’ names)
    const payload = {
      userId: value.userId,
      eventId: value.eventId,
      participants: Array.isArray(value.participants)
        ? value.participants
        : [],
      applicantName, // ← always from user.fullName
      status: "accepted",
      loyalty: {
        discountRate: value.loyalty.discountRate,
        promoCode: value.loyalty.promoCode,
        terms: value.loyalty.terms,
      },
      applicationKind: "loyaltyProgram",
    };

    const doc = await EventApplication.create(payload);

    // 5) 🔔 Notify Student/Staff/TA/Professor about the new loyalty partner
    try {
      const rolesToNotify = [
        "student",
        "staff",
        "ta",
        "teaching assistant",
        "professor",
      ];

      const campusUsers = await User.find(
        { role: { $in: rolesToNotify } },
        { _id: 1 }
      ).lean();

      if (campusUsers && campusUsers.length > 0) {
        const title = "Newly added partner in GUC loyalty program";
        const body = `${applicantName} has joined the GUC Loyalty Program for "${
          ev.name || "an event"
        }".`;

        const items = campusUsers.map((u) => ({
          user: u._id,
          title,
          body,
          meta: {
            kind: "loyaltyPartner",
            eventId: value.eventId,
            applicationId: doc._id,
          },
        }));

        // respect unique index (user + meta.eventId + meta.kind), skip duplicates
        await Notification.insertMany(items, { ordered: false });
      }
    } catch (notifyErr) {
      console.error(
        "createLoyaltyProgramApplication notification error:",
        notifyErr
      );
      // Do NOT fail the main request just because notifications failed
    }

    return res.status(201).json({ status: "success", data: doc });
  } catch (err) {
    if (err?.code === 11000) {
      return res
        .status(409)
        .json({ status: "error", message: "Duplicate key." });
    }
    console.error("createLoyaltyProgramApplication error:", err);
    return res
      .status(500)
      .json({ status: "error", message: err.message });
  }
};
