import mongoose from "mongoose";
const { Schema } = mongoose;

const NotificationSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", index: true, required: true },
    title: { type: String, required: true },
    body: { type: String, required: true },
    meta: { type: Schema.Types.Mixed }, // { eventId, ... }
    read: { type: Boolean, default: false, index: true },
  },
  { timestamps: true }
);
// add after schema definition
// NotificationSchema.index(
//   { user: 1, "meta.eventId": 1, "meta.kind": 1 },
//   { unique: true, sparse: true }
// );


export const Notification =
  mongoose.models.Notification || mongoose.model("Notification", NotificationSchema);
