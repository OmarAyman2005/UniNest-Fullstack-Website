import mongoose from "mongoose";
import ExcelJS from "exceljs";

import { EventRegister } from "../models/EventRegister.js";
import { Event } from "../models/Event.js";
import { EventApplication } from "../models/EventApplication.js"; // used for reports + export
import User from "../models/User.js";

const isObjectId = (v) => mongoose.Types.ObjectId.isValid(String(v));

/* ------------------------------------------------------------------ */
/* CREATE REGISTRATION (hard-enforces allowedRoles)                    */
/* ------------------------------------------------------------------ */
export const createRegistration = async (req, res) => {
  try {
    const userId = req.user?.id || req.user?._id;
    const { event: eventId, name, email, studentId, meta } = req.body || {};

    if (!userId || !isObjectId(userId)) {
      return res.status(401).json({ status: "error", message: "Authentication required" });
    }
    if (!eventId || !isObjectId(eventId)) {
      return res.status(400).json({ status: "error", message: "Invalid or missing event id" });
    }

    const event = await Event.findById(eventId).lean();
    if (!event) return res.status(404).json({ status: "error", message: "Event not found" });

    // HARD BLOCK when event has restrictions and viewer's role is missing/not allowed
    if (Array.isArray(event.allowedRoles) && event.allowedRoles.length > 0) {
      const viewerRole = String(req.user?.role || "").toLowerCase();
      const allowed = event.allowedRoles.map(r => String(r).toLowerCase());
      if (!viewerRole || !allowed.includes(viewerRole)) {
        return res.status(403).json({ status: "error", message: "You are not allowed to register to this event" });
      }
    }

    // prevent duplicate (index also enforces)
    const exists = await EventRegister.findOne({ event: eventId, user: userId });
    if (exists) {
      return res.status(409).json({ status: "error", message: "Already registered for this event" });
    }

    const reg = await EventRegister.create({
      event: eventId,
      user: userId,
      name,
      email,
      studentId,
      meta,
      modifiedBy: userId,
    });

    return res.status(201).json({ status: "success", data: reg });
  } catch (err) {
    if (err && err.code === 11000) {
      return res.status(409).json({ status: "error", message: "Already registered" });
    }
    return res.status(400).json({ status: "error", message: err.message || "Failed to register" });
  }
};

/* ------------------------------------------------------------------ */
export const getUserRegistrations = async (req, res) => {
  try {
    const userId = req.user?.id || req.user?._id || req.query.userId;
    if (!userId || !isObjectId(userId)) {
      return res.status(400).json({ status: "error", message: "Invalid user id" });
    }

    const regs = await EventRegister.find({ user: userId })
      .populate("event")
      .sort({ createdAt: -1 });

    return res.status(200).json({ status: "success", count: regs.length, data: regs });
  } catch (err) {
    return res.status(500).json({ status: "error", message: err.message });
  }
};

/* ------------------------------------------------------------------ */
export const getRegistrationsByEvent = async (req, res) => {
  try {
    const { eventId } = req.params;
    if (!eventId || !isObjectId(eventId)) {
      return res.status(400).json({ status: "error", message: "Invalid event id" });
    }

    const regs = await EventRegister.find({ event: eventId })
      .populate("user")
      .sort({ createdAt: -1 });

    return res.status(200).json({ status: "success", count: regs.length, data: regs });
  } catch (err) {
    return res.status(500).json({ status: "error", message: err.message });
  }
};

/* ------------------------------------------------------------------ */
export const deleteRegistration = async (req, res) => {
  try {
    const userId = req.user?.id || req.user?._id;
    const { id } = req.params;
    if (!id || !isObjectId(id)) return res.status(400).json({ status: "error", message: "Invalid id" });

    const reg = await EventRegister.findById(id);
    if (!reg) return res.status(404).json({ status: "error", message: "Registration not found" });

    const isOwner = userId && String(reg.user) === String(userId);
    const isAdmin = req.user?.role === "admin" || req.user?.role === "event_office";
    if (!isOwner && !isAdmin) return res.status(403).json({ status: "error", message: "Forbidden" });

    await EventRegister.findByIdAndDelete(id);
    return res.status(200).json({ status: "success", message: "Registration removed" });
  } catch (err) {
    return res.status(500).json({ status: "error", message: err.message });
  }
};

/* -------------------- REPORTS (#52–#56) — EventApplication -------------------- */

const peopleCountExpr = {
  $cond: [
    { $gt: [{ $size: { $ifNull: ["$participants", []] } }, 0] },
    { $size: { $ifNull: ["$participants", []] } },
    1,
  ],
};

export const getAttendeesReport = async (req, res) => {
  try {
    const { eventName, eventType, from, to } = req.query;

    const match = { status: { $regex: /^(accepted|approved|registered)$/i } };
    if (from || to) {
      match.createdAt = {};
      if (from) match.createdAt.$gte = new Date(from);
      if (to) match.createdAt.$lte = new Date(to);
    }

    const pipeline = [
      { $match: match },
      {
        $lookup: {
          from: "events",
          localField: "eventId",
          foreignField: "_id",
          as: "event",
        },
      },
      { $unwind: "$event" },
    ];

    if (eventType) pipeline.push({ $match: { "event.eventType": eventType } });
    if (eventName) pipeline.push({ $match: { "event.name": { $regex: eventName, $options: "i" } } });

    if (from || to) {
      const dMatch = {};
      if (from) dMatch.$gte = new Date(from);
      if (to) dMatch.$lte = new Date(to);
      pipeline.push({ $match: { "event.startDateTime": dMatch } });
    }

    pipeline.push({ $addFields: { peopleCount: peopleCountExpr } });

    pipeline.push({
      $group: {
        _id: "$event._id",
        eventName: { $first: "$event.name" },
        eventType: { $first: "$event.eventType" },
        count: { $sum: "$peopleCount" },
      },
    });

    const data = await EventApplication.aggregate(pipeline);
    return res.status(200).json({ status: "success", data });
  } catch (e) {
    return res.status(500).json({ status: "error", message: e?.message });
  }
};

export const getSalesReport = async (req, res) => {
  try {
    const { eventType, from, to, sort = "desc" } = req.query;

    const match = { status: { $regex: /^(accepted|approved|registered)$/i } };
    if (from || to) {
      match.createdAt = {};
      if (from) match.createdAt.$gte = new Date(from);
      if (to) match.createdAt.$lte = new Date(to);
    }

    const pipeline = [
      { $match: match },
      {
        $lookup: {
          from: "events",
          localField: "eventId",
          foreignField: "_id",
          as: "event",
        },
      },
      { $unwind: "$event" },
    ];

    if (eventType) pipeline.push({ $match: { "event.eventType": eventType } });

    if (from || to) {
      const dMatch = {};
      if (from) dMatch.$gte = new Date(from);
      if (to) dMatch.$lte = new Date(to);
      pipeline.push({ $match: { "event.startDateTime": dMatch } });
    }

    pipeline.push({ $addFields: { peopleCount: peopleCountExpr } });

    pipeline.push({
      $group: {
        _id: "$event._id",
        eventName: { $first: "$event.name" },
        eventType: { $first: "$event.eventType" },
        registrations: { $sum: "$peopleCount" },
        revenue: {
          $sum: {
            $ifNull: [
              "$amountPaid",
              { $multiply: [{ $ifNull: ["$event.ticketPrice", 0] }, "$peopleCount"] },
            ],
          },
        },
      },
    });

    pipeline.push({ $sort: { revenue: sort === "asc" ? 1 : -1 } });

    const data = await EventApplication.aggregate(pipeline);
    return res.status(200).json({ status: "success", data });
  } catch (e) {
    return res.status(500).json({ status: "error", message: e?.message });
  }
};

/* -------------------- EXPORT XLSX (#49) — EventApplication -------------------- */
export const exportRegistrationsXlsx = async (req, res) => {
  try {
    const { id } = req.params;
    if (!isObjectId(id)) {
      return res.status(400).json({ status: "error", message: "Invalid event id" });
    }

    const ev = await Event.findById(id).lean();
    if (!ev) return res.status(404).json({ status: "error", message: "Event not found" });

    const type = String(ev.eventType || ev.type || "").toLowerCase();
    if (type === "conference") {
      return res.status(403).json({ status: "error", message: "Export not allowed for conferences" });
    }

    const ALLOWED = ["accepted", "approved", "registered"];

    const apps = await EventApplication.find({
      eventId: id,
      status: { $in: ALLOWED },
    })
      .populate("userId", "fullName email studentId")
      .sort({ createdAt: 1 })
      .lean();

    const rows = [];
    for (const a of apps) {
      const participants = Array.isArray(a.participants) ? a.participants : [];
      if (participants.length > 0) {
        for (const p of participants) {
          const name = (typeof p === "string" ? p : p?.name) || a.userId?.fullName || "";
          const email = (typeof p === "string" ? "" : p?.email) || a.userId?.email || "";
          const studentId = (typeof p === "string" ? "" : p?.studentId) || a.userId?.studentId || "";
          rows.push({
            name,
            email,
            studentId,
            createdAt: a.createdAt ? new Date(a.createdAt) : null,
          });
        }
      } else {
        rows.push({
          name: a.userId?.fullName || "",
          email: a.userId?.email || "",
          studentId: a.userId?.studentId || "",
          createdAt: a.createdAt ? new Date(a.createdAt) : null,
        });
      }
    }

    const wb = new ExcelJS.Workbook();
    wb.creator = "ACLians Internship System";
    wb.created = new Date();

    const ws = wb.addWorksheet("Registrations");
    ws.columns = [
      { header: "Name", key: "name", width: 32 },
      { header: "Email", key: "email", width: 36 },
      { header: "Student ID", key: "studentId", width: 16 },
      { header: "Registered At", key: "createdAt", width: 24 },
    ];
    ws.getRow(1).font = { bold: true };

    rows.forEach((r) =>
      ws.addRow({
        name: r.name || "",
        email: r.email || "",
        studentId: r.studentId || "",
        createdAt: r.createdAt ? r.createdAt.toLocaleString() : "",
      })
    );

    const safeName = (ev.name || "event").replace(/[^\w\-]+/g, "_");
    const filename = `registrations_${safeName}_${String(ev._id).slice(-6)}.xlsx`;

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);

    await wb.xlsx.write(res);
    res.end();
  } catch (e) {
    console.error("[export-registrations]", e);
    return res
      .status(500)
      .json({ status: "error", message: e.message || "Failed to export registrations" });
  }
};
