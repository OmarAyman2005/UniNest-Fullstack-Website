console.log("[sports.routes] loaded");
import { Router } from "express";
import {
  // Courts
  listCourts,
  courtAvailability,
  // Court reservations
  listReservations,
  createReservation,
  cancelReservation,
  resetReservations,
  // Gym sessions + reservations (end-user + create page)
  listGymSessions,
  createGymSession,
  reserveGymSession,
  cancelGymReservation,
  // Gym sessions – admin management
  listGymSessionsAdmin,
  adminUpdateGymSession,
  adminCancelGymSession,
  adminDeleteGymSession,
  adminBulkDeleteGymSessions,
} from "../controllers/sports.controller.js";
import { authRequired, optionalAuth } from "../middleware/auth.js";

const router = Router();

router.get("/_ping", (_req, res) =>
  res.json({ ok: true, from: "sports.routes" })
);

/* Courts */
router.get("/courts", listCourts);
router.get("/courts/:id/availability", courtAvailability);

/* Court reservations */
router.get("/reservations", optionalAuth, listReservations);
router.post("/reservations", authRequired, createReservation);
router.delete("/reservations", authRequired, cancelReservation);
// Dev helper
router.delete("/reservations/_reset", resetReservations);

/* Gym sessions – end user / create page */
router.get("/gym/sessions", optionalAuth, listGymSessions);
router.post("/gym/sessions", authRequired, createGymSession);

// Reserve / cancel (end user)
router.post("/gym/sessions/:id/reserve", authRequired, reserveGymSession);
router.delete(
  "/gym/sessions/:id/reserve",
  authRequired,
  cancelGymReservation
);

/* Gym sessions – ADMIN management (event_office only inside controllers) */
router.get("/gym/sessions/admin", authRequired, listGymSessionsAdmin);
router.patch("/gym/sessions/:id/admin", authRequired, adminUpdateGymSession);
router.post(
  "/gym/sessions/:id/admin-cancel",
  authRequired,
  adminCancelGymSession
);
router.delete("/gym/sessions/:id/admin", authRequired, adminDeleteGymSession);
router.delete(
  "/gym/sessions/admin",
  authRequired,
  adminBulkDeleteGymSessions
);

export default router;
