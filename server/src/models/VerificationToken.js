import mongoose from "mongoose";

const verificationTokenSchema = new mongoose.Schema({
  user:     { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  token:    { type: String, required: true, index: true, unique: true },
  expiresAt:{ type: Date, required: true },
}, { timestamps: true });

export default mongoose.model("VerificationToken", verificationTokenSchema);
