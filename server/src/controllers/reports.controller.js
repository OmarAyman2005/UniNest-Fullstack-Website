import mongoose from "mongoose";
import { Event } from "../models/Event.js";
import { EventRegister } from "../models/EventRegister.js";

// Parse YYYY-MM-DD (or ISO) to Date start/end helpers
const parseDate = (s, end = false) => {
  if (!s) return null;
  const d = new Date(s);
  if (Number.isNaN(+d)) return null;
  if (end) d.setHours(23, 59, 59, 999);
  return d;
};

// /api/public/reports/attendees
export async function attendeesReport(req, res) {
  try {
    const { eventName = "", eventType = "", from = "", to = "" } = req.query || {};
    const start = parseDate(from);
    const end = parseDate(to, true);

    // match events by type/name + time window (use end if provided)
    const evMatch = { };
    if (eventType) evMatch.eventType = eventType;
    if (eventName) evMatch.name = { $regex: eventName, $options: "i" };
    if (start || end) {
      evMatch.startDateTime = {};
      if (start) evMatch.startDateTime.$gte = start;
      if (end) evMatch.startDateTime.$lte = end;
    }

    // pull eligible events first (avoid huge joins)
    const events = await Event.find(evMatch, { _id: 1, name: 1, eventType: 1 }).lean();
    const ids = events.map(e => e._id);
    if (ids.length === 0) return res.json({ status: "success", data: [] });

    // count registrations per event
    const grouped = await EventRegister.aggregate([
      { $match: { event: { $in: ids }, status: "registered" } },
      { $group: { _id: "$event", count: { $sum: 1 } } },
    ]);

    const map = new Map(events.map(e => [String(e._id), e]));
    const data = grouped.map(g => ({
      _id: g._id,
      eventName: map.get(String(g._id))?.name || "Event",
      eventType: map.get(String(g._id))?.eventType || "",
      count: g.count,
    }));

    return res.json({ status: "success", data });
  } catch (e) {
    return res.status(500).json({ status: "error", message: e.message });
  }
}

// /api/public/reports/sales
// NOTE: revenue = registrations * (event.price || 0). If your fee comes from another model,
// adjust here later—we kept it simple to unblock testing.
export async function salesReport(req, res) {
  try {
    const { eventType = "", from = "", to = "", sort = "desc" } = req.query || {};
    const start = parseDate(from);
    const end = parseDate(to, true);

    const evMatch = { };
    if (eventType) evMatch.eventType = eventType;
    if (start || end) {
      evMatch.startDateTime = {};
      if (start) evMatch.startDateTime.$gte = start;
      if (end) evMatch.startDateTime.$lte = end;
    }

    const events = await Event.find(evMatch, { _id: 1, name: 1, eventType: 1, price: 1 }).lean();
    const ids = events.map(e => e._id);
    if (ids.length === 0) return res.json({ status: "success", data: [] });

    const regs = await EventRegister.aggregate([
      { $match: { event: { $in: ids }, status: "registered" } },
      { $group: { _id: "$event", registrations: { $sum: 1 } } },
    ]);

    const regMap = new Map(regs.map(r => [String(r._id), r.registrations]));
    const data = events.map(e => {
      const registrations = regMap.get(String(e._id)) || 0;
      const price = Number(e.price || 0);
      const revenue = registrations * price;
      return {
        _id: e._id,
        eventName: e.name,
        eventType: e.eventType,
        registrations,
        revenue,
      };
    });

    data.sort((a, b) => (sort === "asc" ? a.revenue - b.revenue : b.revenue - a.revenue));

    return res.json({ status: "success", data });
  } catch (e) {
    return res.status(500).json({ status: "error", message: e.message });
  }
}
