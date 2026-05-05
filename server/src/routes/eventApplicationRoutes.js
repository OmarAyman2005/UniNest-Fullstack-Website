// server/src/routes/eventApplicationRoutes.js
import express from "express";
import multer from "multer";

import {
  getApplicationById,
  createApplication,
  listApplications,
  updateApplication,
  deleteApplication,
  acceptApplication,
  rejectApplication,
  cancelApplication,
  cancelEvent,
  getApplicationsByEventAndBooth,
  checkAttendance,
  sendCertificate,
  uploadParticipantId,
  attachParticipantIdMeta,
  verifyParticipantId,
  createLoyaltyProgramApplication, // ← from your branch
} from "../controllers/eventApplicationController.js";

const router = express.Router();

// Multer in-memory; controller writes to disk (easy to swap to S3)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 }, // 15 MB
});

// List & CRUD
router.get("/", listApplications);                      // ?eventId=&userId=&status=
router.get("/by-booth", getApplicationsByEventAndBooth);
router.get("/:id", getApplicationById);
router.post("/", createApplication);

// NEW: Loyalty Program applications
router.post("/loyalty", createLoyaltyProgramApplication); // ← added

router.patch("/:id", updateApplication);
router.delete("/:id", deleteApplication);

// Status transitions
router.post("/:id/accept", acceptApplication);
router.post("/:id/reject", rejectApplication);
router.post("/:id/cancel", cancelApplication);
router.post("/:id/cancelEvent", cancelEvent);

// Extra lookups / utilities
router.get("/booth", getApplicationsByEventAndBooth);
router.get("/attended", checkAttendance);
router.post("/send-certificate", sendCertificate);

// Attendee ID uploads / metadata / verification
router.post(
  "/:id/participants/:index/id",
  upload.single("file"),
  uploadParticipantId
);
router.patch(
  "/:id/participants/:index/id/meta",
  attachParticipantIdMeta
);
router.post(
  "/:id/participants/:index/id/:docId/verify",
  verifyParticipantId
);

export default router;
