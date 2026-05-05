// server/src/models/EventAccess.js
import mongoose from "mongoose";

const { Schema } = mongoose;

const EventAccessSchema = new Schema(
  {
    event: { type: Schema.Types.ObjectId, ref: "Event", required: true, unique: true, index: true },
    allowedRoles: {
      type: [String],
      default: [], // empty => open to all
      enum: ["student", "staff", "ta", "professor", "vendor", "admin", "event_office"],
    },
    // This flag powers the “External Visitor QR” flow
    externalVisitorsEnabled: { type: Boolean, default: false },
    modifiedBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

export const EventAccess =
  mongoose.models.EventAccess || mongoose.model("EventAccess", EventAccessSchema);
