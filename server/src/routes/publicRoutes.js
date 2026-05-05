import express from "express";
import { getProfessors, getProfessorById } from "../controllers/publicController.js";

// 👉 use the report handlers you implemented
import {
  getAttendeesReport,
  getSalesReport,
} from "../controllers/eventRegisterController.js";

import { authRequired } from "../middleware/auth.js";
// 👉 singular file name
import { requireRole } from "../middleware/roles.js";

const router = express.Router();

// list professors
router.get("/professors", getProfessors);
router.get("/professors/:id", getProfessorById);

// Reports (Event Office/Admin)
router.get(
  "/reports/attendees",
  authRequired,
  requireRole("admin", "event_office"),
  getAttendeesReport
);

router.get(
  "/reports/sales",
  authRequired,
  requireRole("admin", "event_office"),
  getSalesReport
);

export default router;
