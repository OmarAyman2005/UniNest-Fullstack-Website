// server/src/controllers/documents.controller.js
import mongoose from "mongoose";
import path from "path";
import fs from "fs/promises";
import { EventApplication } from "../models/EventApplication.js";
import { Event } from "../models/Event.js";

const UPLOAD_DIR = path.join(process.cwd(), "uploads", "ids");

/**
 * GET /api/admin/documents
 * List all uploaded documents across all applications with filtering
 * Query params: 
 *   - eventId: filter by event
 *   - status: filter by verification status (pending, verified, rejected)
 *   - page, limit: pagination
 */
export const listDocuments = async (req, res) => {
  try {
    const { eventId, status, page = 1, limit = 50 } = req.query;
    
    const filter = {};
    if (eventId && mongoose.Types.ObjectId.isValid(eventId)) {
      filter.eventId = eventId;
    }
    
    // Only get applications that have participants with ID docs
    filter["participants.idDocs.0"] = { $exists: true };

    const skip = (Number(page) - 1) * Number(limit);

    const applications = await EventApplication.find(filter)
      .populate("eventId", "name eventType")
      .populate("userId", "fullName email")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit))
      .lean();

    const total = await EventApplication.countDocuments(filter);

    // Flatten the documents structure for easier frontend consumption
    const documents = [];
    
    applications.forEach((app) => {
      if (!app.participants) return;
      
      app.participants.forEach((participant, pIndex) => {
        if (!participant.idDocs || participant.idDocs.length === 0) return;
        
        participant.idDocs.forEach((doc) => {
          // Apply status filter if provided
          if (status && doc.verification?.status !== status) return;
          
          documents.push({
            _id: doc._id,
            applicationId: app._id,
            participantIndex: pIndex,
            participantName: participant.name,
            participantEmail: participant.email,
            applicantName: app.applicantName,
            userId: app.userId,
            eventId: app.eventId?._id,
            eventName: app.eventId?.name,
            eventType: app.eventId?.eventType,
            file: doc.file,
            uploadedAt: doc.uploadedAt,
            verification: doc.verification,
            applicationStatus: app.status,
            createdAt: app.createdAt,
          });
        });
      });
    });

    // Apply status filter after flattening if needed
    const filteredDocuments = status 
      ? documents.filter(doc => doc.verification?.status === status)
      : documents;

    res.json({
      status: "success",
      data: filteredDocuments,
      pagination: {
        total,
        page: Number(page),
        limit: Number(limit),
        pages: Math.ceil(total / Number(limit)),
      },
    });
  } catch (err) {
    console.error("listDocuments error:", err);
    return res.status(500).json({ status: "error", message: err.message });
  }
};

/**
 * GET /api/admin/documents/:applicationId/:participantIndex/:docId
 * Download a specific document file
 */
export const downloadDocument = async (req, res) => {
  try {
    const { applicationId, participantIndex, docId } = req.params;
    const pIndex = Number(participantIndex);

    if (!mongoose.Types.ObjectId.isValid(applicationId)) {
      return res.status(400).json({ status: "error", message: "Invalid application ID" });
    }

    if (!Number.isInteger(pIndex) || pIndex < 0) {
      return res.status(400).json({ status: "error", message: "Invalid participant index" });
    }

    const app = await EventApplication.findById(applicationId);
    if (!app) {
      return res.status(404).json({ status: "error", message: "Application not found" });
    }

    const participant = app.participants?.[pIndex];
    if (!participant) {
      return res.status(404).json({ status: "error", message: "Participant not found" });
    }

    const doc = participant.idDocs.id(docId);
    if (!doc) {
      return res.status(404).json({ status: "error", message: "Document not found" });
    }

    console.log('[Download] Document metadata:', JSON.stringify(doc, null, 2));

    // Try multiple strategies to find the file
    let filePath;
    let filename;

    // Strategy 1: Use the key directly
    if (doc.file.key) {
      filename = doc.file.key;
      filePath = path.join(UPLOAD_DIR, filename);
      console.log(`[Download] Strategy 1 - Using key: ${filePath}`);
      
      try {
        await fs.access(filePath);
        console.log(`[Download] File found using key`);
      } catch (err) {
        console.log(`[Download] File not found using key, trying next strategy`);
        filePath = null;
      }
    }

    // Strategy 2: Extract from URL
    if (!filePath && doc.file.url) {
      filename = path.basename(doc.file.url);
      filePath = path.join(UPLOAD_DIR, filename);
      console.log(`[Download] Strategy 2 - Using URL basename: ${filePath}`);
      
      try {
        await fs.access(filePath);
        console.log(`[Download] File found using URL`);
      } catch (err) {
        console.log(`[Download] File not found using URL, trying next strategy`);
        filePath = null;
      }
    }

    // Strategy 3: Try to find by pattern (applicationId_participantIndex_*)
    if (!filePath) {
      const pattern = `${applicationId}_${pIndex}_`;
      console.log(`[Download] Strategy 3 - Searching for files matching: ${pattern}*`);
      
      try {
        const files = await fs.readdir(UPLOAD_DIR);
        const matchingFile = files.find(f => f.startsWith(pattern));
        
        if (matchingFile) {
          filename = matchingFile;
          filePath = path.join(UPLOAD_DIR, matchingFile);
          console.log(`[Download] File found by pattern: ${filePath}`);
          
          await fs.access(filePath);
        } else {
          console.log(`[Download] No files found matching pattern`);
        }
      } catch (err) {
        console.log(`[Download] Pattern search failed:`, err.message);
        filePath = null;
      }
    }

    // Strategy 4: Try with underscores instead of spaces
    if (!filePath && doc.file.key) {
      const filenameWithUnderscores = doc.file.key.replace(/ /g, '_');
      filePath = path.join(UPLOAD_DIR, filenameWithUnderscores);
      console.log(`[Download] Strategy 4 - Using underscores: ${filePath}`);
      
      try {
        await fs.access(filePath);
        filename = filenameWithUnderscores;
        console.log(`[Download] File found with underscores`);
      } catch (err) {
        console.log(`[Download] File not found with underscores`);
        filePath = null;
      }
    }

    // Strategy 5: List all files and try fuzzy matching
    if (!filePath) {
      console.log(`[Download] Strategy 5 - Fuzzy search in directory`);
      
      try {
        const files = await fs.readdir(UPLOAD_DIR);
        const searchKey = doc.file.key || path.basename(doc.file.url);
        
        // Remove special characters and normalize for comparison
        const normalizeFilename = (name) => name.toLowerCase().replace(/[^a-z0-9]/g, '');
        const normalizedSearch = normalizeFilename(searchKey);
        
        const matchingFile = files.find(f => normalizeFilename(f) === normalizedSearch);
        
        if (matchingFile) {
          filename = matchingFile;
          filePath = path.join(UPLOAD_DIR, matchingFile);
          console.log(`[Download] File found by fuzzy match: ${filePath}`);
          await fs.access(filePath);
        } else {
          console.log(`[Download] No files found by fuzzy matching`);
        }
      } catch (err) {
        console.log(`[Download] Fuzzy search failed:`, err.message);
        filePath = null;
      }
    }

    if (!filePath) {
      console.error(`[Download] All strategies failed. File not found for document ${docId}`);
      
      // Last resort: if doc.file.url is a full HTTP URL, redirect to it
      if (doc.file.url && (doc.file.url.startsWith('http://') || doc.file.url.startsWith('https://'))) {
        console.log(`[Download] Redirecting to remote URL: ${doc.file.url}`);
        return res.redirect(doc.file.url);
      }
      
      return res.status(404).json({ 
        status: "error", 
        message: "File not found on server. The file may have been deleted or moved." 
      });
    }

    console.log(`[Download] Serving file: ${filePath}`);

    // Set appropriate headers for file download
    res.setHeader("Content-Type", doc.file.mime || "application/octet-stream");
    res.setHeader("Content-Disposition", `attachment; filename="${encodeURIComponent(filename)}"`);
    
    // Stream the file
    const fileStream = await fs.readFile(filePath);
    res.send(fileStream);
  } catch (err) {
    console.error("downloadDocument error:", err);
    return res.status(500).json({ status: "error", message: err.message });
  }
};

/**
 * PATCH /api/admin/documents/:applicationId/:participantIndex/:docId/verify
 * Update verification status of a document
 */
export const updateDocumentVerification = async (req, res) => {
  try {
    const { applicationId, participantIndex, docId } = req.params;
    const { status, notes } = req.body;
    const pIndex = Number(participantIndex);

    if (!["pending", "verified", "rejected"].includes(status)) {
      return res.status(400).json({ status: "error", message: "Invalid verification status" });
    }

    if (!mongoose.Types.ObjectId.isValid(applicationId)) {
      return res.status(400).json({ status: "error", message: "Invalid application ID" });
    }

    const app = await EventApplication.findById(applicationId);
    if (!app) {
      return res.status(404).json({ status: "error", message: "Application not found" });
    }

    const participant = app.participants?.[pIndex];
    if (!participant) {
      return res.status(404).json({ status: "error", message: "Participant not found" });
    }

    const doc = participant.idDocs.id(docId);
    if (!doc) {
      return res.status(404).json({ status: "error", message: "Document not found" });
    }

    doc.verification = {
      status,
      by: req.user?._id || req.user?.id,
      at: new Date(),
      notes: notes || "",
    };

    await app.save();

    res.json({
      status: "success",
      message: "Document verification updated",
      data: doc,
    });
  } catch (err) {
    console.error("updateDocumentVerification error:", err);
    return res.status(500).json({ status: "error", message: err.message });
  }
};

/**
 * GET /api/admin/documents/events
 * Get list of events that have uploaded documents
 */
export const getEventsWithDocuments = async (req, res) => {
  try {
    const eventIds = await EventApplication.distinct("eventId", {
      "participants.idDocs.0": { $exists: true },
    });

    const events = await Event.find({ _id: { $in: eventIds } })
      .select("name eventType startDate endDate")
      .sort({ startDate: -1 })
      .lean();

    res.json({
      status: "success",
      data: events,
    });
  } catch (err) {
    console.error("getEventsWithDocuments error:", err);
    return res.status(500).json({ status: "error", message: err.message });
  }
};
