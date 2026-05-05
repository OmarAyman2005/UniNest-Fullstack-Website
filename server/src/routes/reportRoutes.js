// server/src/routes/reportRoutes.js
import express from "express";
import { authRequired } from "../middleware/auth.js";
import { requireRole } from "../middleware/roles.js";
import {
  getReportsSummary,
  getReportsAttendees,
  getReportsSales,
  getReportsBreakdown,
} from "../controllers/reportController.js";

const router = express.Router();

// All reports are protected for Admin / Event Office
const gate = [authRequired, requireRole("admin", "event_office")];

router.get("/summary", gate, getReportsSummary);
router.get("/attendees", gate, getReportsAttendees);
router.get("/sales", gate, getReportsSales);
router.get("/debug-breakdown", gate, getReportsBreakdown);

export default router;
