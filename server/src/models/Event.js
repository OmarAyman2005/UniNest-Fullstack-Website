// server/src/models/Event.js
import mongoose from "mongoose";

export const ALLOWED_REG_ROLES = ["student", "staff", "ta", "professor", "vendor"]; // used by access UI

const ratingSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    score: { type: Number, required: true, min: 1, max: 5 },
    comment: { type: String, default: '' },
  },
  { timestamps: { createdAt: 'createdAt', updatedAt: 'modifiedAt' } }
);

const eventSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    startDateTime: { type: Date, required: true },
    endDateTime: { type: Date, required: true },
    location: { type: String, required: true },
    description: { type: String, required: true },
    registrationDeadline: { type: Date, required: true },
    eventType: { type: String, enum: ['workshop', 'trip', 'bazaar', 'booth', 'conference','loyaltyProgram'], required: true },
    ratings: { type: [ratingSchema], default: [] },
    averageRating: { type: Number, default: 0 }, // average score (e.g. 4.25)
    // optional ticket price for paid events (trips, workshops, etc.)
    ticketPrice: { type: Number, min: 0 },
    // ---- Registration access controls (REQ #50 & #51) ----
    allowedRoles: {
      type: [String],
      default: [], // empty => open to all
      validate: (v) =>
        Array.isArray(v) && v.every((r) => ALLOWED_REG_ROLES.includes(String(r))),
    },
    externalVisitorsEnabled: { type: Boolean, default: false }, // QR check-in for externals

    // ---- Archival fields ----
    isArchived: { type: Boolean, default: false, index: true },
    archivedAt: { type: Date },
    archiveReason: { type: String, enum: ["auto", "manual"], default: undefined },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    modifiedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  {
    timestamps: { createdAt: "createdAt", updatedAt: "modifiedAt" },
  }
);

// Basic guards
eventSchema.pre("validate", function (next) {
  if (
    this.startDateTime &&
    this.endDateTime &&
    this.startDateTime > this.endDateTime
  ) {
    return next(new Error("Start date must be before end date."));
  }
  if (
    this.registrationDeadline &&
    this.startDateTime &&
    this.registrationDeadline > this.startDateTime
  ) {
    return next(
      new Error("Registration deadline must be before the workshop start date.")
    );
  }
  next();
});

eventSchema.methods.getRatingSummary = function () {
  const ratings = this.ratings || [];
  const count = ratings.length;
  const avg = count === 0 ? 0 : ratings.reduce((s, r) => s + (r.score || 0), 0) / count;
  return { average: Number(avg.toFixed(2)), count };
};

eventSchema.methods.updateRatingSummary = function () {
  const summary = this.getRatingSummary();
  this.averageRating = summary.average;
  return summary;
};

// Useful compound index for listing
eventSchema.index({ isArchived: 1, endDateTime: 1 });

/* ------------------------------------------------------------------
   New-event notifications (model-level so it works from ANY create path)
------------------------------------------------------------------- */

// Remember "isNew" in pre('save'), then act in post('save')
eventSchema.pre("save", function (next) {
  this.$locals ??= {};
  this.$locals.wasNew = this.isNew === true;
  next();
});

eventSchema.post("save", async function (doc) {
  try {
    const wasNew = this?.$locals?.wasNew === true;
    if (!wasNew) return;

    // Lazy import to avoid circular deps
    const { notifyNewEventToRoles } = await import("../utils/scheduler.js");
    const res = await notifyNewEventToRoles(doc);
    console.log(
      `[events] broadcasted "new event" notif: name="${doc.name}" recipients=${res?.sent ?? 0}`
    );
  } catch (e) {
    console.warn("[events] new-event notify failed:", e?.message);
  }
});

// Dev-safe export (avoids OverwriteModelError during HMR)
export const Event =
  mongoose.models.Event || mongoose.model("Event", eventSchema);
