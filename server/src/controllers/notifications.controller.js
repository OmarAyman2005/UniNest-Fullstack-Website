// server/src/controllers/notifications.controller.js
import { Notification } from "../models/Notification.js";
import {
  sendTimeWindowReminders,
  explainReminderStatus,
} from "../utils/scheduler.js";

/**
 * Create a single notification.
 */
export async function pushNotification({ user, title, body, meta = {} }) {
  if (!user || !title || !body) return null;

  try {
    const doc = await Notification.create({ user, title, body, meta });
    return doc?.toObject?.() ?? doc;
  } catch (e) {
    const msg = String(e?.message || "");
    if (msg.includes("E11000")) return null;
    throw e;
  }
}

/** Convenience bulk helper */
export async function pushManyNotifications(userIds = [], payload = {}) {
  const items = (userIds || [])
    .filter(Boolean)
    .map((u) => ({
      user: u,
      title: payload.title,
      body: payload.body,
      meta: payload.meta || {},
    }));

  if (items.length === 0) return { inserted: 0 };

  try {
    const res = await Notification.insertMany(items, { ordered: false });
    return { inserted: res?.length || 0 };
  } catch {
    return { inserted: 0 };
  }
}

export async function listMyNotifications(req, res) {
  try {
    const userId = req.user?._id || req.user?.id;
    const items = await Notification.find({ user: userId })
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();
    return res.json({ status: "success", data: items });
  } catch (e) {
    return res.status(500).json({ status: "error", message: e.message });
  }
}

export async function markRead(req, res) {
  try {
    const userId = req.user?._id || req.user?.id;
    const { id } = req.params;
    const n = await Notification.findOne({ _id: id, user: userId });
    if (!n) return res.status(404).json({ status: "error", message: "Not found" });
    if (!n.read) {
      n.read = true;
      await n.save();
    }
    return res.json({ status: "success", data: { _id: n._id, read: n.read } });
  } catch (e) {
    return res.status(500).json({ status: "error", message: e.message });
  }
}

/**
 * POST /api/notifications/run-once
 */
export async function runRemindersOnce(req, res) {
  try {
    const nowParam = req.query?.now || req.body?.now;
    const now = nowParam ? new Date(nowParam) : new Date();
    if (Number.isNaN(now.getTime())) {
      return res.status(400).json({ status: "error", message: "Invalid 'now' ISO datetime" });
    }
    const result = await sendTimeWindowReminders(now);
    return res.json({ status: "success", ranAt: now.toISOString(), ...result });
  } catch (e) {
    return res.status(500).json({ status: "error", message: e.message });
  }
}

/**
 * GET /api/notifications/debug/:id
 */
export async function debugReminderStatus(req, res) {
  try {
    const { id } = req.params;
    const nowParam = req.query?.now;
    const now = nowParam ? new Date(nowParam) : new Date();
    if (nowParam && Number.isNaN(now.getTime())) {
      return res.status(400).json({ status: "error", message: "Invalid 'now' ISO datetime" });
    }
    const info = await explainReminderStatus(id, now);
    if (!info.ok) {
      return res.status(404).json({ status: "error", message: info.reason || "Not found" });
    }
    return res.json({ status: "success", data: info });
  } catch (e) {
    return res.status(500).json({ status: "error", message: e.message });
  }
}

/* ===========================
   ✅ NEW BULK + DELETE HANDLERS
   =========================== */

export async function markAllRead(req, res) {
  try {
    const userId = req.user?._id || req.user?.id;
    const r = await Notification.updateMany(
      { user: userId, read: { $ne: true } },
      { $set: { read: true } }
    );
    return res.json({ status: "success", modified: r.modifiedCount || 0 });
  } catch (e) {
    return res.status(500).json({ status: "error", message: e.message });
  }
}

export async function deleteNotification(req, res) {
  try {
    const userId = req.user?._id || req.user?.id;
    const { id } = req.params;
    const r = await Notification.deleteOne({ _id: id, user: userId });
    if (!r.deletedCount)
      return res.status(404).json({ status: "error", message: "Not found" });
    return res.json({ status: "success", deleted: 1 });
  } catch (e) {
    return res.status(500).json({ status: "error", message: e.message });
  }
}

export async function deleteAllMyNotifications(req, res) {
  try {
    const userId = req.user?._id || req.user?.id;
    const r = await Notification.deleteMany({ user: userId });
    return res.json({ status: "success", deleted: r.deletedCount || 0 });
  } catch (e) {
    return res.status(500).json({ status: "error", message: e.message });
  }
}
