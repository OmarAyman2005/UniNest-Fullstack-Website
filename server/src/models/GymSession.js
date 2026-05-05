import mongoose from "mongoose";

/**
 * Gym sessions.
 * Uniqueness policy:
 *   For ACTIVE sessions only, (type, date@00:00:00Z, startTime, endTime) must be unique.
 *   Cancelled sessions are kept for history and do NOT block recreating the same slot.
 */
const GymSessionSchema = new mongoose.Schema(
  {
    // Admin UI fields
    category: { type: String, required: true, trim: true },
    type: { type: String, required: true, trim: true },
    coachName: { type: String, required: true, trim: true },

    // Stored as Date at 00:00:00.000Z
    date: { type: Date, required: true, index: true },

    // "HH:mm"
    startTime: { type: String, required: true, trim: true },
    endTime: { type: String, required: true, trim: true },

    capacity: { type: Number, default: 0, min: 0 },
    booked: { type: Number, default: 0, min: 0 }, // used for reservations

    // NEW: lifecycle
    status: {
      type: String,
      enum: ["active", "cancelled"],
      default: "active",
      index: true,
    },
    cancelledAt: { type: Date },

    // optional location (used already in your data)
    location: { type: String, default: "Main Gym" },
  },
  { timestamps: true }
);

// Uniqueness across type + date + slot BUT **only for active sessions**
GymSessionSchema.index(
  { type: 1, date: 1, startTime: 1, endTime: 1 },
  {
    unique: true,
    name: "uniq_type_date_slot_active_only",
    partialFilterExpression: { status: "active" },
  }
);

// Convenience indexes
GymSessionSchema.index({ date: 1, type: 1, startTime: 1 });

export default mongoose.model("GymSession", GymSessionSchema);
