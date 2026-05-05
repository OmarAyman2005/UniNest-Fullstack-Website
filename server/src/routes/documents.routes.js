// server/src/routes/documents.routes.js
import { Router } from "express";
import { authRequired } from "../middleware/auth.js";
import { requireRole } from "../middleware/roles.js";
import {
  listDocuments,
  downloadDocument,
  updateDocumentVerification,
  getEventsWithDocuments,
} from "../controllers/documents.controller.js";

const router = Router();

// All routes require admin or event_office role
router.use(authRequired, requireRole("admin", "event_office"));

// Get list of events with documents
router.get("/events", getEventsWithDocuments);

// List all documents with filtering
router.get("/", listDocuments);

// Download a specific document
router.get("/:applicationId/:participantIndex/:docId", downloadDocument);

// Update document verification status
router.patch("/:applicationId/:participantIndex/:docId/verify", updateDocumentVerification);

export default router;
