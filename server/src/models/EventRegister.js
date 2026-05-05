import mongoose from "mongoose";

const { Schema } = mongoose;

const EventRegisterSchema = new Schema(
  {
    event: { type: Schema.Types.ObjectId, ref: "Event", required: true, index: true },
    user:  { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },

    // denormalized snapshot fields (optional)
    name:      { type: String },
    email:     { type: String },
    studentId: { type: String },
    meta:      { type: Schema.Types.Mixed },

    status: { type: String, enum: ["registered", "cancelled"], default: "registered" },

    // ---- NEW: attendance + payments (for reports)
    checkedIn: { type: Boolean, default: false, index: true },
    checkInAt: { type: Date },
    amountPaid: { type: Number, default: 0, min: 0 },

    createdAt:  { type: Date, default: () => new Date() },
    modifiedAt: { type: Date, default: () => new Date() },
    modifiedBy: { type: Schema.Types.ObjectId, ref: "User" }
  },
  {
    timestamps: { createdAt: "createdAt", updatedAt: "modifiedAt" }
  }
);

// ensure a user cannot register twice for the same event
EventRegisterSchema.index({ event: 1, user: 1 }, { unique: true });

export const EventRegister =
  mongoose.models.EventRegister || mongoose.model("EventRegister", EventRegisterSchema);
