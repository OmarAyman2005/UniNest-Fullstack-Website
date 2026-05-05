import mongoose from "mongoose";
import Court from "../models/Court.js";
import GymSession from "../models/GymSession.js";
import CourtReservation from "../models/CourtReservation.js";
import GymReservation from "../models/GymReservation.js";
import { sendEmail } from "../utils/sendEmail.js";

/* ---------------- helpers ---------------- */
function pad(n) {
  return String(n).padStart(2, "0");
}
function toMinutes(hhmm) {
  const [h, m] = String(hhmm).split(":").map(Number);
  return h * 60 + m;
}
function fromMinutes(mins) {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${pad(h)}:${pad(m)}`;
}
function toISODateOnly(dateLike) {
  const iso =
    typeof dateLike === "string"
      ? dateLike.slice(0, 10)
      : new Date(dateLike).toISOString().slice(0, 10);
  return iso;
}
function buildHourlySlotsFromWindows(windows) {
  const out = [];
  for (const w of windows) {
    const startM = toMinutes(w.startTime);
    const endM = toMinutes(w.endTime);
    for (let m = startM; m < endM; m += 60) {
      const next = m + 60;
      if (next <= endM) out.push({ start: fromMinutes(m), end: fromMinutes(next) });
    }
  }
  return out;
}
function fridayPremiumBlock() {
  return { start: "14:00", end: "16:00", premium: true };
}
function thursdayWindows() {
  return [{ startTime: "08:00", endTime: "22:00" }];
}
function standardWindows() {
  return [{ startTime: "08:00", endTime: "16:00" }];
}

/** Small helper: only event_office can use admin gym endpoints */
function assertEventOffice(req, res) {
  const role = req.user?.role;
  if (role !== "event_office") {
    res.status(403).json({ error: "Forbidden: event_office role required" });
    return false;
  }
  return true;
}

/* ---------------- COURTS ---------------- */
export const listCourts = async (_req, res, next) => {
  try {
    const data = await Court.find().lean();
    res.json({ data });
  } catch (e) {
    next(e);
  }
};

export const courtAvailability = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { date } = req.query;
    const iso = toISODateOnly(date || new Date());
    const dayUTC = new Date(`${iso}T00:00:00.000Z`).getUTCDay();

    let court;
    try {
      court = await Court.findById(id).lean();
    } catch (e) {
      if (e?.name === "CastError")
        return res.status(400).json({ error: "Invalid court id" });
      throw e;
    }
    if (!court) return res.status(404).json({ error: "Court not found" });

    if (dayUTC === 6) return res.json({ data: [] });

    let slots = [];
    if (dayUTC === 5) {
      const p = fridayPremiumBlock();
      slots = [{ start: p.start, end: p.end, premium: true }];
    } else if (dayUTC === 4) {
      slots = buildHourlySlotsFromWindows(thursdayWindows());
    } else {
      slots = buildHourlySlotsFromWindows(standardWindows());
    }
    return res.json({ data: slots });
  } catch (e) {
    console.error("[availability] error:", e?.name, e?.message);
    next(e);
  }
};

/* ---------------- COURT RESERVATIONS ---------------- */
export const listReservations = async (req, res, next) => {
  try {
    const { courtId, date } = req.query;
    if (!courtId || !date)
      return res
        .status(400)
        .json({ error: "courtId and date are required" });

    const iso = toISODateOnly(date);

    // include user so front-end can show reserved name + GUC id
    const rows = await CourtReservation.find({ court: courtId, date: iso })
      .populate("user", "fullName email role studentId staffId")
      .lean();

    const me = req.user?._id?.toString?.();

    const data = rows.map((r) => {
      const user = r.user || null;
      const isMine = me && user?._id?.toString?.() === me;

      return {
        start: r.startTime,
        end: r.endTime,
        userId: user?._id?.toString?.() || null,
        isMine: !!isMine,
        user: user
          ? {
              fullName: user.fullName || "",
              email: user.email || "",
              role: user.role || "",
              studentId: user.studentId || "",
              staffId: user.staffId || "",
            }
          : null,
      };
    });

    res.json({ data });
  } catch (e) {
    next(e);
  }
};

export const createReservation = async (req, res, next) => {
  try {
    const { courtId, date, startTime, endTime } = req.body || {};
    if (!courtId || !date || !startTime || !endTime) {
      return res
        .status(400)
        .json({ error: "courtId, date, startTime, endTime are required" });
    }
    const iso = toISODateOnly(date);
    const court = await Court.findById(courtId).lean();
    if (!court) return res.status(404).json({ error: "Court not found" });

    try {
      const doc = await CourtReservation.create({
        court: courtId,
        date: iso,
        startTime,
        endTime,
        user: req.user._id,
      });
      return res.status(201).json({ data: { id: doc._id } });
    } catch (e) {
      if (e?.code === 11000)
        return res.status(409).json({ error: "Slot already reserved" });
      throw e;
    }
  } catch (e) {
    next(e);
  }
};

export const cancelReservation = async (req, res, next) => {
  try {
    const { courtId, date, startTime } = req.body || {};
    if (!courtId || !date || !startTime) {
      return res
        .status(400)
        .json({ error: "courtId, date, startTime are required" });
    }
    const iso = toISODateOnly(date);
    const row = await CourtReservation.findOne({
      court: courtId,
      date: iso,
      startTime,
    });
    if (!row) return res.status(404).json({ error: "Reservation not found" });
    if (row.user.toString() !== req.user._id.toString())
      return res.status(403).json({ error: "Not your reservation" });
    await CourtReservation.deleteOne({ _id: row._id });
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
};

export const resetReservations = async (req, res, next) => {
  try {
    if (process.env.NODE_ENV === "production")
      return res.status(403).json({ error: "Disabled in production" });
    const { courtId, date } = req.query;
    const filter = {};
    if (courtId) filter.court = courtId;
    if (date) filter.date = date.slice(0, 10);
    const { deletedCount } = await CourtReservation.deleteMany(filter);
    res.json({ ok: true, deletedCount });
  } catch (e) {
    next(e);
  }
};

/* ---------------- GYM SESSIONS (END-USER + CREATE PAGE) ---------------- */
// GET /api/sports/gym/sessions?type=...&date=YYYY-MM-DD
export const listGymSessions = async (req, res, next) => {
  try {
    const { date, type, location } = req.query;
    const filter = { status: "active" }; // only active sessions for end-users / create page

    if (type) filter.type = type;
    if (location) filter.location = location;

    if (date) {
      const start = new Date(date);
      start.setHours(0, 0, 0, 0);
      const end = new Date(start);
      end.setDate(end.getDate() + 1);
      filter.date = { $gte: start, $lt: end };
    } else {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      filter.date = { $gte: today };
    }

    const rows = await GymSession.find(filter)
      .sort({ date: 1, startTime: 1 })
      .lean();

    // Attach isMine marks if user is logged in
    if (req.user && rows.length) {
      const ids = rows.map((r) => r._id);
      const mine = await GymReservation.find({
        user: req.user._id,
        session: { $in: ids },
      })
        .select("session")
        .lean();
      const mineSet = new Set(mine.map((r) => r.session.toString()));
      const data = rows.map((r) => ({
        ...r,
        isMine: mineSet.has(r._id.toString()),
      }));
      return res.json({ data });
    }

    res.json({ data: rows });
  } catch (e) {
    next(e);
  }
};

// POST /api/sports/gym/sessions
export const createGymSession = async (req, res, next) => {
  try {
    const {
      type,
      category,
      coach,
      coachName: coachNameRaw,
      date: dateStr,
      startTime,
      endTime,
      capacity,
      location,
    } = req.body || {};

    const coachName = coachNameRaw ?? coach;
    if (!type || !category || !coachName || !dateStr || !startTime || !endTime) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    // --- validate + normalize date ---
    const date = new Date(dateStr);
    if (Number.isNaN(date.getTime())) {
      return res.status(400).json({ error: "Invalid date" });
    }
    date.setHours(0, 0, 0, 0);

    // --- validate time range ---
    const toMin = (hhmm) => {
      const [h, m] = String(hhmm).split(":").map(Number);
      return Number.isFinite(h) && Number.isFinite(m) ? h * 60 + m : NaN;
    };
    const sM = toMin(startTime);
    const eM = toMin(endTime);
    if (!Number.isFinite(sM) || !Number.isFinite(eM) || eM <= sM) {
      return res.status(400).json({ error: "Invalid time range" });
    }

    // --- normalize capacity ---
    const cap = Math.max(0, Number.isFinite(+capacity) ? +capacity : 0);

    // Normal path: create an ACTIVE session
    const doc = await GymSession.create({
      type,
      category,
      coachName,
      date,
      startTime,
      endTime,
      capacity: cap,
      booked: 0,
      location: location || "Main Gym",
      status: "active",
    });

    return res.status(201).json({ data: doc });
  } catch (e) {
    if (e?.code === 11000) {
      // With the partial unique index, this only happens
      // if there is already another ACTIVE session for the same slot.
      return res.status(409).json({ error: "Session already exists" });
    }
    if (e?.name === "ValidationError") {
      return res.status(400).json({ error: e.message });
    }
    next(e);
  }
};

/* --------- NEW: reserve/cancel gym session (capacity-aware) --------- */
// POST /api/sports/gym/sessions/:id/reserve
export const reserveGymSession = async (req, res, next) => {
  try {
    const { id } = req.params;

    const session = await GymSession.findById(id).lean();
    if (!session || session.status !== "active") {
      return res
        .status(404)
        .json({ error: "Session not found or inactive" });
    }

    // create reservation (unique on (session,user))
    try {
      await GymReservation.create({ session: id, user: req.user._id });
    } catch (e) {
      if (e?.code === 11000)
        return res.status(409).json({ error: "Already reserved" });
      throw e;
    }

    // atomically bump booked if there's capacity
    const upd = await GymSession.updateOne(
      { _id: id, status: "active", $expr: { $lt: ["$booked", "$capacity"] } },
      { $inc: { booked: 1 } }
    );

    if (upd.modifiedCount === 0) {
      // full or inactive: rollback reservation doc
      await GymReservation.deleteOne({ session: id, user: req.user._id });
      return res
        .status(409)
        .json({ error: "Fully booked or inactive" });
    }

    const fresh = await GymSession.findById(id).lean();
    return res.status(200).json({
      data: {
        booked: fresh.booked,
        capacity: fresh.capacity,
        isMine: true,
      },
    });
  } catch (e) {
    next(e);
  }
};

// DELETE /api/sports/gym/sessions/:id/reserve
export const cancelGymReservation = async (req, res, next) => {
  try {
    const { id } = req.params;

    const del = await GymReservation.deleteOne({
      session: id,
      user: req.user._id,
    });
    if (del.deletedCount === 0)
      return res.status(404).json({ error: "Reservation not found" });

    await GymSession.updateOne(
      { _id: id, booked: { $gt: 0 } },
      { $inc: { booked: -1 } }
    );

    const fresh = await GymSession.findById(id).lean();
    return res.status(200).json({
      data: {
        booked: fresh.booked,
        capacity: fresh.capacity,
        isMine: false,
      },
    });
  } catch (e) {
    next(e);
  }
};

/* ---------------- GYM SESSIONS – ADMIN MANAGEMENT ------------------- */

// Helper: send notification emails to session attendees
async function notifyGymSessionUsers(session, reservations, action) {
  if (!reservations || !reservations.length) return;

  const allowedRoles = new Set(["student", "staff", "ta", "professor"]);

  const whenDate = session.date
    ? new Date(session.date).toLocaleDateString("en-EG", {
        weekday: "short",
        year: "numeric",
        month: "short",
        day: "numeric",
      })
    : "unspecified date";

  const timeRange =
    session.startTime && session.endTime
      ? `${session.startTime}–${session.endTime}`
      : "";

  const titleParts = [];
  if (session.type) titleParts.push(session.type);
  if (session.category) titleParts.push(session.category);
  const title =
    titleParts.length > 0
      ? titleParts.join(" – ")
      : "Gym session";

  const subject =
    action === "cancel"
      ? `Gym session cancelled: ${title}`
      : `Gym session updated: ${title}`;

  await Promise.all(
    reservations.map((r) => {
      const u = r.user;
      if (!u || !u.email) return Promise.resolve();
      if (!allowedRoles.has(u.role)) return Promise.resolve();

      const name =
        u.fullName ||
        [u.firstName, u.lastName].filter(Boolean).join(" ").trim() ||
        "Gym member";
      const gucId = u.studentId || u.staffId || "";
      const extraId = gucId ? ` (ID: ${gucId})` : "";

      const html =
        action === "cancel"
          ? `
        <div style="font-family:system-ui,Segoe UI,Arial,sans-serif">
          <p>Dear ${name}${extraId},</p>
          <p>The gym session you registered for has been <b>cancelled</b>.</p>
          <p><b>${title}</b><br/>${whenDate} ${timeRange}</p>
          <p>Please check the system for alternative timings.</p>
        </div>
      `
          : `
        <div style="font-family:system-ui,Segoe UI,Arial,sans-serif">
          <p>Dear ${name}${extraId},</p>
          <p>The gym session you registered for has been <b>updated</b> (date/time changed).</p>
          <p><b>${title}</b><br/>${whenDate} ${timeRange}</p>
          <p>Please review the new timing in the system.</p>
        </div>
      `;

      const text =
        action === "cancel"
          ? `Dear ${name}${extraId},
The gym session you registered for has been cancelled.
${title}
${whenDate} ${timeRange}
Please check the system for alternative timings.`
          : `Dear ${name}${extraId},
The gym session you registered for has been updated (date/time changed).
${title}
${whenDate} ${timeRange}
Please review the new timing in the system.`;

      return sendEmail({
        to: u.email,
        subject,
        html,
        text,
      }).catch((err) => {
        console.error(
          "[sports.controller] Failed to send gym email:",
          err.message
        );
      });
    })
  );
}

// GET /api/sports/gym/sessions/admin
// Returns ALL sessions (active + cancelled), no date filtering (front-end will filter)
export const listGymSessionsAdmin = async (req, res, next) => {
  try {
    if (!assertEventOffice(req, res)) return;

    const rows = await GymSession.find({})
      .sort({ date: 1, startTime: 1 })
      .lean();

    res.json({ data: rows });
  } catch (e) {
    next(e);
  }
};

// PATCH /api/sports/gym/sessions/:id/admin
// Edit only date + time
export const adminUpdateGymSession = async (req, res, next) => {
  try {
    if (!assertEventOffice(req, res)) return;

    const { id } = req.params;
    const { date: dateStr, startTime, endTime } = req.body || {};

    const session = await GymSession.findById(id);
    if (!session) return res.status(404).json({ error: "Session not found" });
    if (session.status !== "active") {
      return res
        .status(400)
        .json({ error: "Cannot edit a cancelled session" });
    }

    // capture original for comparison
    const original = {
      date: session.date ? new Date(session.date) : null,
      startTime: session.startTime,
      endTime: session.endTime,
      location: session.location,
    };

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const date = new Date(dateStr);
    if (Number.isNaN(date.getTime()))
      return res.status(400).json({ error: "Invalid date" });
    date.setHours(0, 0, 0, 0);
    if (date < today)
      return res.status(400).json({ error: "Date cannot be in the past" });

    const toMin = (hhmm) => {
      const [h, m] = String(hhmm).split(":").map(Number);
      return Number.isFinite(h) && Number.isFinite(m) ? h * 60 + m : NaN;
    };
    const sM = toMin(startTime),
      eM = toMin(endTime);
    if (!Number.isFinite(sM) || !Number.isFinite(eM) || eM <= sM) {
      return res.status(400).json({ error: "Invalid time range" });
    }

    session.date = date;
    session.startTime = startTime;
    session.endTime = endTime;

    let saved;
    try {
      saved = await session.save();
    } catch (e) {
      if (e?.code === 11000) {
        return res.status(409).json({
          error: "Another session already exists for this type/date/slot",
        });
      }
      throw e;
    }

    // Determine if it was actually changed (date/time/location)
    const changed =
      !original.date ||
      original.date.getTime() !== date.getTime() ||
      original.startTime !== startTime ||
      original.endTime !== endTime ||
      original.location !== session.location;

    if (changed) {
      // load reserved users (before/after change does not matter)
      const reservations = await GymReservation.find({ session: id })
        .populate("user", "email fullName role studentId staffId firstName lastName")
        .lean();

      await notifyGymSessionUsers(saved.toObject(), reservations, "update");
    }

    res.json({ data: saved.toObject() });
  } catch (e) {
    next(e);
  }
};

// POST /api/sports/gym/sessions/:id/admin-cancel
export const adminCancelGymSession = async (req, res, next) => {
  try {
    if (!assertEventOffice(req, res)) return;

    const { id } = req.params;
    const session = await GymSession.findById(id);
    if (!session) return res.status(404).json({ error: "Session not found" });

    // load reservations BEFORE deleting, so we can email them
    const reservations = await GymReservation.find({ session: id })
      .populate("user", "email fullName role studentId staffId firstName lastName")
      .lean();

    if (session.status === "cancelled") {
      // already cancelled, but still notify (optional) – here we skip to avoid duplicates
      return res.json({ data: session.toObject() });
    }

    session.status = "cancelled";
    session.cancelledAt = new Date();
    session.booked = 0;

    await GymReservation.deleteMany({ session: id });
    await session.save();

    await notifyGymSessionUsers(session.toObject(), reservations, "cancel");

    res.json({ data: session.toObject() });
  } catch (e) {
    next(e);
  }
};

// DELETE /api/sports/gym/sessions/:id/admin
export const adminDeleteGymSession = async (req, res, next) => {
  try {
    if (!assertEventOffice(req, res)) return;

    const { id } = req.params;

    await GymReservation.deleteMany({ session: id });
    const { deletedCount } = await GymSession.deleteOne({ _id: id });
    if (!deletedCount) return res.status(404).json({ error: "Session not found" });

    res.json({ ok: true, deletedCount });
  } catch (e) {
    next(e);
  }
};

// DELETE /api/sports/gym/sessions/admin?scope=past|cancelled
export const adminBulkDeleteGymSessions = async (req, res, next) => {
  try {
    if (!assertEventOffice(req, res)) return;

    const { scope } = req.query;
    if (!scope || !["past", "cancelled"].includes(scope)) {
      return res
        .status(400)
        .json({ error: "scope must be 'past' or 'cancelled'" });
    }

    const now = new Date();
    now.setHours(0, 0, 0, 0);

    const filter = {};
    if (scope === "past") {
      filter.status = "active";
      filter.date = { $lt: now };
    } else {
      filter.status = "cancelled";
    }

    const sessions = await GymSession.find(filter).select("_id").lean();
    const ids = sessions.map((s) => s._id);
    if (!ids.length) return res.json({ ok: true, deletedCount: 0 });

    await GymReservation.deleteMany({ session: { $in: ids } });
    const { deletedCount } = await GymSession.deleteMany({ _id: { $in: ids } });

    res.json({ ok: true, deletedCount });
  } catch (e) {
    next(e);
  }
};
