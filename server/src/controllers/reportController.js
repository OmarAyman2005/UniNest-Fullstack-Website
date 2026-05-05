// server/src/controllers/reportController.js
import mongoose from "mongoose";
import { Event } from "../models/Event.js";
import { EventRegister } from "../models/EventRegister.js";
import { EventApplication } from "../models/EventApplication.js";
import { Payment } from "../models/PaymentV.js";

const isValidId = (v) => mongoose.Types.ObjectId.isValid(String(v));

/**
 * Common query builder for Event filters
 */
function buildEventMatch({ name = "", type = "", from = "", to = "" }) {
  const match = {};
  if (name) {
    match.name = { $regex: String(name).trim(), $options: "i" };
  }
  if (type && type.toLowerCase() !== "all") {
    match.eventType = String(type).toLowerCase();
  }
  if (from || to) {
    match.startDateTime = {};
    if (from) match.startDateTime.$gte = new Date(from);
    if (to) match.startDateTime.$lte = new Date(to);
  }
  return match;
}

/**
 * GET /api/reports/summary
 * Returns { totalAttendees, totalRevenue }
 */
export async function getReportsSummary(req, res) {
  try {
    const { name = "", type = "", from = "", to = "" } = req.query;

    const matchEvents = buildEventMatch({ name, type, from, to });

    // Pick matched event ids
    const events = await Event.find(matchEvents, { _id: 1 }).lean();
    const eventIds = events.map((e) => e._id);

    if (eventIds.length === 0) {
      return res.json({
        status: "success",
        data: { totalAttendees: 0, totalRevenue: 0 },
      });
    }

    // Get total attendees from EventApplication (accepted only)
    const attendeesAgg = await EventApplication.aggregate([
      { $match: { eventId: { $in: eventIds }, status: "accepted" } },
      { $addFields: { peopleCount: { $cond: [ { $gt: [ { $size: { $ifNull: ["$participants", []] } }, 0 ] }, { $size: { $ifNull: ["$participants", []] } }, 1 ] } } },
      { $group: { _id: null, total: { $sum: "$peopleCount" } } },
    ]);

    const totalAttendeesCount = attendeesAgg?.[0]?.total || 0;

    // Compute revenue from EventApplication (accepted) similar to sales report
    const appPipeline = [
      { $match: { eventId: { $in: eventIds }, status: "accepted" } },
      { $addFields: { peopleCount: { $cond: [ { $gt: [ { $size: { $ifNull: ["$participants", []] } }, 0 ] }, { $size: { $ifNull: ["$participants", []] } }, 1 ] } } },
      { $lookup: { from: "events", localField: "eventId", foreignField: "_id", as: "event" } },
      { $unwind: { path: "$event", preserveNullAndEmptyArrays: true } },
      { $group: { _id: null, total: { $sum: { $ifNull: ["$amountPaid", { $multiply: [ { $ifNull: ["$event.ticketPrice", { $ifNull: ["$event.price", 0] } ] }, "$peopleCount" ] } ] } } } },
    ];
    const appAgg = await EventApplication.aggregate(appPipeline);
    const appRevenue = appAgg?.[0]?.total || 0;

    // Get revenue from EventRegister.amountPaid using event.price/ticketPrice fallback
    const registerAgg = await EventRegister.aggregate([
      { $match: { event: { $in: eventIds }, status: "registered" } },
      { $lookup: { from: "events", localField: "event", foreignField: "_id", as: "event" } },
      { $unwind: { path: "$event", preserveNullAndEmptyArrays: true } },
      { $group: { _id: null, total: { $sum: { $ifNull: ["$amountPaid", { $ifNull: ["$event.price", "$event.ticketPrice"] } ] } } } },
    ]);
    const registerRevenue = registerAgg?.[0]?.total || 0;

    // Include payments linked to applications (paid payments)
    const paymentsAgg = await Payment.aggregate([
      { $match: { status: "paid" } },
      { $lookup: { from: "eventapplications", localField: "applicationId", foreignField: "_id", as: "app" } },
      { $unwind: { path: "$app", preserveNullAndEmptyArrays: true } },
      { $match: { "app.eventId": { $in: eventIds } } },
      { $group: { _id: "$app.eventId", revenue: { $sum: "$amount" } } }
    ]);
    const paymentsRevenue = (paymentsAgg || []).reduce((s, r) => s + (r?.revenue || 0), 0);

    const totalRevenue = Number(appRevenue || 0) + Number(registerRevenue || 0) + Number(paymentsRevenue || 0);

    res.json({
      status: "success",
      data: {
        totalAttendees: totalAttendeesCount,
        totalRevenue,
      },
    });
  } catch (e) {
    res.status(500).json({ status: "error", message: e.message || "Failed to compute summary" });
  }
}

/**
 * GET /api/reports/attendees?name=&type=&page=&limit=&sort=...
 * Returns paged list: {items, page, totalPages, total}
 * Each item: { eventId, name, type, start, end, registered }
 */
export async function getReportsAttendees(req, res) {
  try {
    const {
      name = "", type = "",
      from = "", to = "",
      page = "1", limit = "8",
      sort = "start_asc"
    } = req.query;

    const matchEvents = buildEventMatch({ name, type, from, to });

    const p = Math.max(parseInt(page, 10) || 1, 1);
    const l = Math.min(Math.max(parseInt(limit, 10) || 8, 1), 100);

    // Sorting
    const sortMap = {
      name_asc:  { name: 1 },
      name_desc: { name: -1 },
      type_asc:  { eventType: 1 },
      type_desc: { eventType: -1 },
      start_asc: { startDateTime: 1 },
      start_desc:{ startDateTime: -1 },
      end_asc:   { endDateTime: 1 },
      end_desc:  { endDateTime: -1 },
      reg_asc:   { registered: 1 },
      reg_desc:  { registered: -1 },
    };

    // base: get events page
    const [events, total] = await Promise.all([
      Event.find(matchEvents)
        .sort(sortMap[sort] || { startDateTime: 1 })
        .skip((p - 1) * l)
        .limit(l)
        .lean(),
      Event.countDocuments(matchEvents),
    ]);

    const ids = events.map((e) => e._id);

    // Use EventApplication (accepted) counts per event
    const appRegs = await EventApplication.aggregate([
      { $match: { eventId: { $in: ids }, status: "accepted" } },
      { $addFields: { peopleCount: { $cond: [ { $gt: [ { $size: { $ifNull: ["$participants", []] } }, 0 ] }, { $size: { $ifNull: ["$participants", []] } }, 1 ] } } },
      { $group: { _id: "$eventId", c: { $sum: "$peopleCount" } } },
    ]);
    const appMap = new Map(appRegs.map((r) => [String(r._id), r.c]));

    const items = events.map((e) => {
      const id = String(e._id);
      const registered = appMap.get(id) || 0; // rely solely on EventApplication
      return {
        eventId: id,
        name: e.name,
        type: e.eventType,
        start: e.startDateTime,
        end: e.endDateTime,
        registered,
      };
    });

    return res.json({
      status: "success",
      data: {
        items,
        page: p,
        totalPages: Math.max(Math.ceil(total / l), 1),
        total,
      },
    });
  } catch (e) {
    res.status(500).json({ status: "error", message: e.message || "Failed to load attendees report" });
  }
}

/**
 * GET /api/reports/sales?type=&from=&to=&page=&limit=&sort=rev_desc
 * Returns paged list: {items, page, totalPages, total}
 * Each item: { name, type, start, end, revenue }
 */
export async function getReportsSales(req, res) {
  try {
    const {
      name = "", type = "", from = "", to = "",
      page = "1", limit = "8", sort = "rev_desc",
    } = req.query;

    const matchEvents = buildEventMatch({ name, type, from, to });

    // load events (we'll compute revenue per event then sort & paginate)
    const events = await Event.find(matchEvents, { _id: 1, name: 1, eventType: 1, startDateTime: 1, endDateTime: 1, ticketPrice: 1 }).lean();
    const ids = events.map((e) => e._id);

    if (ids.length === 0) {
      return res.json({ status: "success", data: { items: [], page: 1, totalPages: 1, total: 0 } });
    }

    // Applications (accepted) revenue per event
    const appPipeline = [
      { $match: { eventId: { $in: ids } } },
      { $addFields: { peopleCount: { $cond: [ { $gt: [ { $size: { $ifNull: ["$participants", []] } }, 0 ] }, { $size: { $ifNull: ["$participants", []] } }, 1 ] } } },
      { $lookup: { from: "events", localField: "eventId", foreignField: "_id", as: "event" } },
      { $unwind: { path: "$event", preserveNullAndEmptyArrays: true } },
      { $group: { _id: "$eventId", regs: { $sum: "$peopleCount" }, revenue: { $sum: { $ifNull: ["$amountPaid", { $multiply: [ { $ifNull: ["$event.ticketPrice", { $ifNull: ["$event.price", 0] } ] }, "$peopleCount" ] } ] } } } },
    ];
    const appAgg = await EventApplication.aggregate(appPipeline);

    // EventRegister revenue per event
    const regPipeline = [
      { $match: { event: { $in: ids } } },
      { $lookup: { from: "events", localField: "event", foreignField: "_id", as: "event" } },
      { $unwind: { path: "$event", preserveNullAndEmptyArrays: true } },
      { $group: { _id: "$event", regs: { $sum: 1 }, revenue: { $sum: { $ifNull: ["$amountPaid", { $ifNull: ["$event.ticketPrice", { $ifNull: ["$event.price", 0] } ] } ] } } } },
    ];
    const regAgg = await EventRegister.aggregate(regPipeline);

    const appMap = new Map(appAgg.map((r) => [String(r._id), { regs: r.regs || 0, revenue: r.revenue || 0 }]));
    const regMap = new Map(regAgg.map((r) => [String(r._id), { regs: r.regs || 0, revenue: r.revenue || 0 }]));

    // Include payments linked to applications (paid payments) per event
    const paymentsAgg = await Payment.aggregate([
      { $match: { status: "paid" } },
      { $lookup: { from: "eventapplications", localField: "applicationId", foreignField: "_id", as: "app" } },
      { $unwind: { path: "$app", preserveNullAndEmptyArrays: true } },
      { $match: { "app.eventId": { $in: ids } } },
      { $group: { _id: "$app.eventId", revenue: { $sum: "$amount" } } }
    ]);
    const payMap = new Map((paymentsAgg || []).map((r) => [String(r._id), { revenue: r.revenue || 0 }]));

    const rows = events.map((e) => {
      const id = String(e._id);
      const a = appMap.get(id) || { regs: 0, revenue: 0 };
      const r = regMap.get(id) || { regs: 0, revenue: 0 };
      const p = payMap.get(id) || { revenue: 0 };
      const revenue = Number((a.revenue || 0) + (r.revenue || 0) + (p.revenue || 0));
      return {
        eventId: id,
        name: e.name,
        type: e.eventType,
        start: e.startDateTime,
        end: e.endDateTime,
        revenue,
      };
    });

    // sorting
    const s = String(sort || "rev_desc");
    const sorters = {
      rev_desc: (a,b) => b.revenue - a.revenue,
      rev_asc:  (a,b) => a.revenue - b.revenue,
      name_asc: (a,b) => String(a.name || "").localeCompare(String(b.name || "")),
      name_desc:(a,b) => String(b.name || "").localeCompare(String(a.name || "")),
      start_asc:(a,b) => new Date(a.start || 0) - new Date(b.start || 0),
      start_desc:(a,b) => new Date(b.start || 0) - new Date(a.start || 0),
      type_asc: (a,b) => String(a.type || "").localeCompare(String(b.type || "")),
      type_desc:(a,b) => String(b.type || "").localeCompare(String(a.type || "")),
    };

    rows.sort(sorters[s] || sorters.rev_desc);

    const p = Math.max(parseInt(page, 10) || 1, 1);
    const l = Math.min(Math.max(parseInt(limit, 10) || 8, 1), 200);
    const total = rows.length;
    const totalPages = Math.max(Math.ceil(total / l), 1);
    const items = rows.slice((p - 1) * l, (p - 1) * l + l);

    return res.json({ status: "success", data: { items, page: p, totalPages, total } });
  } catch (err) {
    return res.status(500).json({ status: "error", message: err.message || "Failed to compute sales report" });
  }
}

/**
 * GET /api/reports/debug-breakdown
 * Returns per-event breakdown for troubleshooting: counts and revenue from EventRegister and EventApplication
 */
export async function getReportsBreakdown(req, res) {
  try {
    const { name = "", type = "", from = "", to = "" } = req.query;
    const matchEvents = buildEventMatch({ name, type, from, to });

    const events = await Event.find(matchEvents, { _id: 1, name: 1, eventType: 1, ticketPrice: 1 }).lean();
    const ids = events.map((e) => e._id);

    if (ids.length === 0) return res.json({ status: "success", data: [] });

    // Aggregate EventApplication by eventId + status
    const appPipeline = [
      { $match: { eventId: { $in: ids } } },
      { $addFields: { peopleCount: { $cond: [ { $gt: [ { $size: { $ifNull: ["$participants", []] } }, 0 ] }, { $size: { $ifNull: ["$participants", []] } }, 1 ] } } },
      { $lookup: { from: "events", localField: "eventId", foreignField: "_id", as: "event" } },
      { $unwind: { path: "$event", preserveNullAndEmptyArrays: true } },
      { $group: { _id: { eventId: "$eventId", status: "$status" }, regs: { $sum: "$peopleCount" }, revenue: { $sum: { $ifNull: ["$amountPaid", { $multiply: [ { $ifNull: ["$event.ticketPrice", { $ifNull: ["$event.price", 0] } ] }, "$peopleCount" ] } ] } } } },
    ];
    const appAgg = await EventApplication.aggregate(appPipeline);

    // Aggregate EventRegister by event + status
    const regPipeline = [
      { $match: { event: { $in: ids } } },
      { $lookup: { from: "events", localField: "event", foreignField: "_id", as: "event" } },
      { $unwind: { path: "$event", preserveNullAndEmptyArrays: true } },
      { $group: { _id: { eventId: "$event", status: "$status" }, regs: { $sum: 1 }, revenue: { $sum: { $ifNull: ["$amountPaid", { $ifNull: ["$event.ticketPrice", { $ifNull: ["$event.price", 0] } ] } ] } } } },
    ];
    const regAgg = await EventRegister.aggregate(regPipeline);

    // Build maps
    const appsMap = new Map();
    for (const a of appAgg) {
      const eid = String(a._id.eventId);
      if (!appsMap.has(eid)) appsMap.set(eid, {});
      appsMap.get(eid)[String(a._id.status || "")] = { regs: a.regs || 0, revenue: a.revenue || 0 };
    }

    const regsMap = new Map();
    for (const r of regAgg) {
      const eid = String(r._id.eventId);
      if (!regsMap.has(eid)) regsMap.set(eid, {});
      regsMap.get(eid)[String(r._id.status || "")] = { regs: r.regs || 0, revenue: r.revenue || 0 };
    }

    const rows = events.map((e) => {
      const id = String(e._id);
      const appInfo = appsMap.get(id) || {};
      const regInfo = regsMap.get(id) || {};
      // totals
      const appAccepted = (appInfo.accepted && appInfo.accepted.regs) || 0;
      const appCancelled = (appInfo.cancelled && appInfo.cancelled.regs) || 0;
      const appRejected = (appInfo.rejected && appInfo.rejected.regs) || 0;
      const regRegistered = (regInfo.registered && regInfo.registered.regs) || 0;

      const revenueApp = Object.values(appInfo).reduce((s, v) => s + (v.revenue || 0), 0);
      const revenueReg = Object.values(regInfo).reduce((s, v) => s + (v.revenue || 0), 0);

      return {
        eventId: id,
        name: e.name,
        type: e.eventType,
        ticketPrice: e.ticketPrice || null,
        appCounts: { accepted: appAccepted, cancelled: appCancelled, rejected: appRejected },
        regCounts: { registered: regRegistered },
        revenue: { fromApplications: revenueApp, fromRegisters: revenueReg, total: revenueApp + revenueReg },
      };
    });

    return res.json({ status: "success", data: rows });
  } catch (err) {
    return res.status(500).json({ status: "error", message: err.message || "Failed to compute debug breakdown" });
  }
}
