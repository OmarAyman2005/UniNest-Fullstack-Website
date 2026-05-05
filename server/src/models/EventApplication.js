// server/src/models/EventApplication.js
import mongoose from "mongoose";

// ─────────────────────────────────────────────
// ID file / document sub-schemas (from main)
// ─────────────────────────────────────────────
const idFileSchema = new mongoose.Schema(
  {
    url:  { type: String, required: true }, // /uploads/ids/... or https URL
    key:  { type: String },                 // storage key if any (e.g., S3 key)
    mime: { type: String },
    size: { type: Number },                 // bytes
  },
  { _id: false }
);

const idDocSchema = new mongoose.Schema(
  {
    file: { type: idFileSchema, required: true },
    uploadedAt: { type: Date, default: Date.now },
    verification: {
      status: { type: String, enum: ["pending", "verified", "rejected"], default: "pending" },
      by: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
      at: { type: Date, default: null },
      notes: { type: String, trim: true, maxlength: 500 },
    },
  },
  { _id: true, timestamps: true }
);

// ─────────────────────────────────────────────
// Attendee + Loyalty sub-schemas (merged)
// ─────────────────────────────────────────────
const attendeeSchema = new mongoose.Schema(
  {
    name:  { type: String, trim: true, minlength: 2, maxlength: 80, required: true },
    email: {
      type: String,
      trim: true,
      lowercase: true,
      required: true,
      match: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
    },
    // Keep main’s ID docs support
    idDocs: { type: [idDocSchema], default: [] }, // only file(s)
  },
  { _id: false }
);

const loyaltySchema = new mongoose.Schema(
  {
    discountRate: { type: Number, min: 0, max: 100, required: true },
    promoCode: { type: String, trim: true, maxlength: 60, required: true },
    terms: { type: String, trim: true, maxlength: 4000, required: true },
  },
  { _id: false }
);

// ─────────────────────────────────────────────
// Main EventApplication schema (merged)
// ─────────────────────────────────────────────
const eventApplicationSchema = new mongoose.Schema(
  {
    userId:  { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    eventId: { type: mongoose.Schema.Types.ObjectId, ref: "Event", required: true, index: true },

    /** What kind of application this is (kept independent from Event.eventType
     *  so migrations are simpler and queries are clearer)
     */
    applicationKind: {
      type: String,
      enum: ["bazaar", "booth", "loyaltyProgram", "other"],
      default: "other",
      index: true,
    },

    participants: { type: [attendeeSchema], default: [] },

    // Human-friendly display name
    applicantName: { type: String, trim: true, maxlength: 120, index: true },

    // Bazaar/booth fields (optional for loyalty)
    gucID: { type: String, trim: true, maxlength: 80 },

    boothSize: { type: String, enum: ["2x2", "4x4"] },
    setupDurationWeeks: { type: Number, min: 1, max: 4 },
    setupLocation: { type: String, trim: true, maxlength: 120 },
    boothNumber: { type: String, trim: true, maxlength: 20 },

    reservationStart: { type: Date, default: null, index: true },
    reservationEnd:   { type: Date, default: null, index: true },

    // Loyalty fields (present only when applicationKind === 'loyaltyProgram')
    loyalty: { type: loyaltySchema, default: undefined },

    status: {
      type: String,
      enum: ["pending", "accepted", "rejected", "cancelled"],
      default: "pending",
      index: true,
    },
    notes:  { type: String, trim: true, maxlength: 2000 },

    createdBy:  { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    modifiedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

// ─────────────────────────────────────────────
// Hooks
// ─────────────────────────────────────────────
eventApplicationSchema.pre("validate", function (next) {
  if (this.boothNumber) {
    this.boothNumber = String(this.boothNumber).trim().toUpperCase();
  }

  if (!this.applicantName || !this.applicantName.trim()) {
    const firstP = Array.isArray(this.participants) && this.participants[0];
    if (firstP?.name) this.applicantName = String(firstP.name).trim();
  }

  next();
});

export const EventApplication = mongoose.model("EventApplication", eventApplicationSchema);
