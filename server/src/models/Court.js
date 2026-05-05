import mongoose from "mongoose";

const availabilitySchema = new mongoose.Schema({
  dayOfWeek: { type: Number, min: 0, max: 6, required: true }, // 0=Sun .. 6=Sat
  startTime: { type: String, required: true }, // "HH:mm"
  endTime:   { type: String, required: true }, // "HH:mm"
}, { _id: false });

const courtSchema = new mongoose.Schema({
  name: { type: String, required: true },
  sport: {
    type: String,
    enum: ["football","basketball","tennis","volleyball","squash","gym"],
    required: true
  },
  location: { type: String, default: "Sports Complex" },
  weeklyAvailability: [availabilitySchema],
}, { timestamps: true });

export default mongoose.model("Court", courtSchema);
