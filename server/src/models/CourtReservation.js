// server/src/models/CourtReservation.js
import mongoose from "mongoose";

const schema = new mongoose.Schema(
  {
    court: { type: mongoose.Schema.Types.ObjectId, ref: "Court", required: true },
    date: { type: String, required: true },         // "YYYY-MM-DD"
    startTime: { type: String, required: true },    // "HH:mm"
    endTime: { type: String, required: true },      // "HH:mm"
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true }
);

// one reservation per (court, date, startTime)
schema.index({ court: 1, date: 1, startTime: 1 }, { unique: true });

export default mongoose.model("CourtReservation", schema);
