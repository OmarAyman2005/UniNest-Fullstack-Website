import express from "express";
import {
  getAllEvents,
  deleteEvent,
  getEventById,
  createEvent,
  addRating,
  editRating,
  removeRating,
  removeRatingComment,
  archivePastNow,
  setAllowedRoles,
  setAccess,
  getAccess, // ← keep
} from "../controllers/eventController.js";

// 👇 move exports/QR to the dedicated controller
import {
  exportEventRegistrationsXlsx,
  generateExternalVisitorQR,
} from "../controllers/eventExports.controller.js";

import { getParticipatingVendorsByEventId } from "../controllers/applicationParticipants.controller.js";
import { authRequired, attachUserIfPresent } from "../middleware/auth.js";
import { requireRole } from "../middleware/roles.js";

const router = express.Router();

router.post("/", createEvent);
router.get("/:id", getEventById);
router.delete("/:id", deleteEvent);
router.post("/:id/ratings", addRating);
router.put("/:id/ratings/:ratingId", editRating);
router.delete("/:id/ratings/:ratingId", removeRating);
router.delete("/:id/ratings/:ratingId/comment", removeRatingComment);
/* List / public-visible with attachUserIfPresent */
router.get("/", attachUserIfPresent, getAllEvents);

/* Access settings (GET + PUT) */
router.get(
  "/:id/access",
  authRequired,
  requireRole("admin", "event_office"),
  getAccess
);

router.put(
  "/:id/access",
  authRequired,
  requireRole("admin", "event_office"),
  setAccess
);

/* Participants (accepted vendors) */
router.get("/:eventId/participants", getParticipatingVendorsByEventId);

/* Exports / QR (admin & events office only) */
router.get(
  "/:id/export-registrations.xlsx",
  authRequired,
  requireRole("event_office", "admin"),
  exportEventRegistrationsXlsx
);

router.get(
  "/:id/external-visitor-qr",
  authRequired,
  requireRole("admin", "event_office"),
  generateExternalVisitorQR
);

/* Manual archive trigger */
router.post(
  "/archive/run",
  authRequired,
  requireRole("admin", "event_office"),
  archivePastNow
);

/* Create / allowed-roles (legacy patch kept for UI) */
router.post("/", authRequired, requireRole("admin", "event_office"), createEvent);

router.patch(
  "/:id/allowed-roles",
  authRequired,
  requireRole("admin", "event_office"),
  setAllowedRoles
);

/* Read single / delete (keep last) */
router.get("/:id", attachUserIfPresent, getEventById);

router.delete(
  "/:id",
  authRequired,
  requireRole("admin", "event_office"),
  deleteEvent
);

export default router;
