// server/src/models/GymReservation.js
import mongoose from "mongoose";

const GymReservationSchema = new mongoose.Schema(
  {
    session: { type: mongoose.Schema.Types.ObjectId, ref: "GymSession", required: true, index: true },
    user:    { type: mongoose.Schema.Types.ObjectId, ref: "User",       required: true, index: true },
  },
  { timestamps: true }
);

// one reservation per (session,user)
GymReservationSchema.index({ session: 1, user: 1 }, { unique: true, name: "uniq_session_user" });

export default mongoose.model("GymReservation", GymReservationSchema);
