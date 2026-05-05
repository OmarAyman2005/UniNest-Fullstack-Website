import express from "express";
import multer from "multer";
import { postCompanyProfile } from "../controllers/vendor.controller.js";
import { authRequired } from "../middleware/auth.js";
import { requireRole } from "../middleware/roles.js";

const router = express.Router();

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 15 * 1024 * 1024 } });

// POST /api/vendor/company-profile
router.post(
  "/company-profile",
  authRequired,
  requireRole("vendor"),
  upload.fields([
    { name: "taxCard", maxCount: 1 },
    { name: "logo", maxCount: 1 },
  ]),
  postCompanyProfile
);

export default router;
