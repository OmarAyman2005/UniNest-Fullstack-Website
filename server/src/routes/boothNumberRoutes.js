import express from "express";
import {
  // reserveBooth,       // <-- new
  listBooths,
  createBooth,
  bulkCreateBooths,
  getBoothById,
  updateBooth,
  deleteBooth,
} from "../controllers/boothNumberController.js";
import { requireAuth } from "../middleware/vendorAuth.js";

const router = express.Router();

// Public vendor flows
router.get("/", listBooths);
// router.post("/reserve", reserveBooth);

// Admin maintenance (optional)
router.get("/:id", getBoothById);
router.post("/", createBooth);
router.post("/bulk", bulkCreateBooths);
router.patch("/:id", updateBooth);
router.delete("/:id", deleteBooth);


export default router;
