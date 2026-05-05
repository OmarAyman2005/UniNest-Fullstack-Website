// server/src/routes/fileRoutes.js
import express from "express";
import mongoose from "mongoose";
import { getGridFSBucket } from "../lib/gridfs.js";

const router = express.Router();

// GET /api/files/:id -> streams the file from GridFS
router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) return res.status(400).send("Invalid id");

    const bucket = getGridFSBucket();
    const _id = new mongoose.Types.ObjectId(id);

    // Find file metadata to set headers (optional but nice)
    const filesColl = bucket.s.db.collection(`${bucket.s.options.bucketName}.files`);
    const fileDoc = await filesColl.findOne({ _id });
    if (!fileDoc) return res.status(404).send("File not found");

    if (fileDoc.contentType) res.setHeader("Content-Type", fileDoc.contentType);
    res.setHeader("Content-Length", fileDoc.length);

    const stream = bucket.openDownloadStream(_id);
    stream.on("error", () => res.status(404).end());
    stream.pipe(res);
  } catch (e) {
    res.status(500).send("Server error");
  }
});

export default router;
