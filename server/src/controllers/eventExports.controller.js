import ExcelJS from "exceljs";
import QRCode from "qrcode";
import { makeEventVisitorQR } from "../utils/qrcode.js";
import mongoose from "mongoose";
import { Event } from "../models/Event.js";
import { EventRegister } from "../models/EventRegister.js";
import { EventApplication } from "../models/EventApplication.js";

const isId = (v) => mongoose.Types.ObjectId.isValid(String(v));
const CAIRO_TZ = "Africa/Cairo";
const fmtLocal = (d) =>
  d ? new Date(d).toLocaleString("en-GB", { timeZone: CAIRO_TZ }) : "";

function safeStringify(v) {
  try {
    if (v == null) return "";
    return JSON.stringify(v);
  } catch {
    return String(v);
  }
}

/**
 * Build rows in the unified EventRegister-shaped format
 * given real EventRegister docs.
 */
function rowsFromEventRegister(regs, evId) {
  return regs.map((r) => {
    const u = r.user || {};
    return {
      eventId: String(r.event || evId || ""),
      userId: String(u?._id || ""),
      name: r.name ?? u.fullName ?? u.name ?? "",
      email: r.email ?? u.email ?? "",
      studentId: r.studentId ?? u.studentId ?? u.studentID ?? "",
      status: r.status || "registered",
      checkedIn: Boolean(r.checkedIn),
      checkInAt: fmtLocal(r.checkInAt),
      amountPaid: Number(r.amountPaid || 0),
      createdAt: fmtLocal(r.createdAt),
      modifiedAt: fmtLocal(r.modifiedAt),
      meta: safeStringify(r.meta),
    };
  });
}

/**
 * Build rows in the same format but from EventApplication + participants
 * (fallback path when EventRegister has no data).
 */
function rowsFromApplications(apps, evId) {
  const out = [];
  for (const a of apps) {
    const u = a.userId || {};
    const base = {
      eventId: String(evId),
      userId: String(u?._id || ""),
      status: "registered",
      checkedIn: "",            // unknown in applications
      checkInAt: "",            // unknown in applications
      amountPaid: "",           // unknown in applications
      createdAt: fmtLocal(a.createdAt),
      modifiedAt: fmtLocal(a.updatedAt || a.modifiedAt || a.createdAt),
      meta: safeStringify(a.meta),
    };

    if (Array.isArray(a.participants) && a.participants.length > 0) {
      for (const p of a.participants) {
        out.push({
          ...base,
          name: p?.name || a.applicantName || u.fullName || "",
          email: p?.email || u.email || "",
          studentId: a.gucID || u.studentId || "",
        });
      }
    } else {
      out.push({
        ...base,
        name: a.applicantName || u.fullName || "",
        email: u.email || "",
        studentId: a.gucID || u.studentId || "",
      });
    }
  }
  return out;
}

/**
 * GET /api/event/:id/export-registrations.xlsx
 * Primary: EventRegister
 * Fallback: EventApplication (status: accepted)
 */
export async function exportEventRegistrationsXlsx(req, res) {
  try {
    const { id } = req.params;
    if (!isId(id))
      return res
        .status(400)
        .json({ status: "error", message: "Invalid event id" });

    const ev = await Event.findById(id).lean();
    if (!ev)
      return res
        .status(404)
        .json({ status: "error", message: "Event not found" });

    // 1) Try EventRegister
    const regs = await EventRegister.find({ event: id })
      .populate("user", "fullName name email studentId studentID")
      .sort({ createdAt: 1 })
      .lean();

    let rows = rowsFromEventRegister(regs, ev._id);

    // 2) Fallback to EventApplication if no EventRegister data
    if (rows.length === 0) {
      const apps = await EventApplication.find({
        eventId: id,
        status: "accepted",
      })
        .populate("userId", "fullName email studentId studentID")
        .sort({ createdAt: 1 })
        .lean();

      rows = rowsFromApplications(apps, ev._id);
    }

    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("Registrations");

    // Columns exactly in EventRegister shape (+eventId/userId/meta kept for auditing)
    ws.columns = [
      { header: "Event ID", key: "eventId", width: 24 },
      { header: "User ID", key: "userId", width: 24 },
      { header: "Name", key: "name", width: 28 },
      { header: "Email", key: "email", width: 30 },
      { header: "Student ID", key: "studentId", width: 16 },
      { header: "Status", key: "status", width: 14 },
      { header: "Checked In", key: "checkedIn", width: 12 },
      { header: "Check-in At", key: "checkInAt", width: 22 },
      { header: "Amount Paid", key: "amountPaid", width: 14 },
      { header: "Registered At", key: "createdAt", width: 22 },
      { header: "Last Modified At", key: "modifiedAt", width: 22 },
      { header: "Meta (JSON)", key: "meta", width: 40 },
    ];

    if (rows.length === 0) {
      // Still give a valid file (headers + one context row with event id)
      ws.addRow({ eventId: String(ev._id) });
    } else {
      ws.addRows(rows);
    }

    // Style header + freeze
    const header = ws.getRow(1);
    header.font = { bold: true };
    header.alignment = { vertical: "middle" };
    ws.views = [{ state: "frozen", ySplit: 1 }];

    const fnameSafe = String(ev.name || "event").replace(/[^\w\-]+/g, "_");
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${fnameSafe}_registrations.xlsx"`
    );

    await wb.xlsx.write(res);
    res.end();
  } catch (e) {
    console.error("exportEventRegistrationsXlsx error:", e);
    res
      .status(500)
      .json({ status: "error", message: e.message || "Export failed" });
  }
}

/**
 * GET /api/event/:id/external-visitor-qr
 * (unchanged behavior) – only bazaars & “career fair”-like events.
 */
export async function generateExternalVisitorQR(req, res) {
  try {
    const { id } = req.params;
    if (!isId(id))
      return res
        .status(400)
        .json({ status: "error", message: "Invalid event id" });

    const ev = await Event.findById(id).lean();
    if (!ev)
      return res
        .status(404)
        .json({ status: "error", message: "Event not found" });

    // Require the event to have external visitors enabled in access settings
    if (!ev.externalVisitorsEnabled) {
      return res
        .status(400)
        .json({ status: "error", message: "External visitors not enabled for this event" });
    }

    const type = String(ev.eventType || "").toLowerCase();
    const isBazaar = type === "bazaar";
    const isBooth = type === "booth";
    const looksCareerFair = /career\s*fair/i.test(String(ev.name || ""));

    // Allow bazaars, booths or events that look like career fairs
    if (!isBazaar && !isBooth && !looksCareerFair) {
      return res
        .status(400)
        .json({ status: "error", message: "QR only for bazaars/booths/career fairs" });
    }

    // Build a wrapped payload that the frontend `/visitor-qr` page understands.
    const inner = {
      k: "ev-visitor",
      v: {
        t: "external-visitor",
        eventId: String(ev._id),
        eventName: ev.name || "",
        name: (req.query.name || "").toString().slice(0, 80),
        email: (req.query.email || "").toString().slice(0, 120),
        ts: Date.now(),
      },
    };

    // Delegate QR construction to the shared util which prefers the
    // `FRONTEND_BASE_URL` env var (fallback: http://localhost:3000).
    const dataUrl = await makeEventVisitorQR(inner);

    return res.json({ status: "success", dataUrl });
  } catch (e) {
    return res
      .status(500)
      .json({ status: "error", message: e.message || "Failed to generate QR" });
  }
}
