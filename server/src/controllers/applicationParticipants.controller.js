// server/src/controllers/applicationParticipants.controller.js
import mongoose from "mongoose";
import { EventApplication } from "../models/EventApplication.js";
import User from "../models/User.js";

/**
 * GET /api/events/:eventId/participants
 * Returns: { status, count, data:[ "Full Name", ... ] }
 */
export async function getParticipatingVendorsByEventId(req, res) {
  try {
    const { eventId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(eventId)) {
      return res
        .status(400)
        .json({ status: "error", message: "Invalid event id" });
    }

    // 1) Accepted applications for this event → unique userIds
    const apps = await EventApplication
      .find({ eventId, status: "accepted" }, { userId: 1 })
      .lean();

    if (apps.length === 0) {
      return res.json({ status: "success", count: 0, data: [] });
    }

    const userIds = [...new Set(apps.map(a => String(a.userId)))].map(id => new mongoose.Types.ObjectId(id));

    // 2) Fetch users' full names
    const users = await User
      .find({ _id: { $in: userIds } }, { fullName: 1 })
      .lean();

    const names = users
      .map(u => u.fullName)
      .filter(Boolean);

    return res.json({ status: "success", count: names.length, data: names });
  } catch (err) {
    console.error("getParticipatingVendorsByEventId error:", err);
    return res
      .status(500)
      .json({ status: "error", message: err.message });
  }
}
