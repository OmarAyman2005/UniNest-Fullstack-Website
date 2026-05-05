import express from "express";
import { authRequired } from "../middleware/auth.js";
import {
  listMyNotifications,
  markRead,
  debugReminderStatus,
  runRemindersOnce,
  markAllRead,              // ✅ NEW
  deleteNotification,       // ✅ NEW
  deleteAllMyNotifications, // ✅ NEW
} from "../controllers/notifications.controller.js";
// (EXISTING)
import { sendTimeWindowReminders } from "../utils/scheduler.js";

const router = express.Router();

// Existing routes
router.get("/", authRequired, listMyNotifications);
router.patch("/:id/read", authRequired, markRead);

// ✅ NEW bulk & delete routes (non-breaking)
router.patch("/read-all", authRequired, markAllRead);
router.delete("/:id", authRequired, deleteNotification);
router.delete("/", authRequired, deleteAllMyNotifications);

// 🔎 explain scheduler’s decision for a specific event
router.get("/debug/:id", authRequired, debugReminderStatus);

// ▶️ run the reminder job on demand (optionally pass ?now=ISO)
router.post("/run-once", authRequired, runRemindersOnce);

// 🧪 test endpoint
router.get("/admin/test-reminders", async (req, res) => {
  const result = await sendTimeWindowReminders();
  res.json(result);
});

export default router;
