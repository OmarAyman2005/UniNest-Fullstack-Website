// server/src/routes/pollRoutes.js
import express from "express";
import {
  listEligibleVendors,
  createPoll,
  listPolls,
  getPollById,
  votePoll,
  updatePoll,
  deletePoll,
} from "../controllers/pollController.js";
import {
  authRequired,
  optionalAuth,
} from "../middleware/auth.js";

const router = express.Router();

/**
 * NOTE:
 *  - Eligible vendors + poll creation + list are protected
 *    (Events Office / Admin only; enforced in controller).
 *  - getPollById uses optionalAuth (anyone can see poll, but
 *    logged-in users get "isMyChoice" info).
 *  - vote requires auth (students/staff/TA/professors).
 */

// Get vendors that can be put in a poll for a given event
router.get("/eligible-vendors", authRequired, listEligibleVendors);

// Create a new poll
router.post("/", authRequired, createPoll);

// List polls
router.get("/", authRequired, listPolls);

// Get one poll (public / optional auth)
router.get("/:id", optionalAuth, getPollById);

// Vote in a poll
router.post("/:id/vote", authRequired, votePoll);

// Update poll (title/description/isOpen) – Events Office/Admin only
router.patch("/:id", authRequired, updatePoll);

// Delete poll – Events Office/Admin only
router.delete("/:id", authRequired, deletePoll);

export default router;
