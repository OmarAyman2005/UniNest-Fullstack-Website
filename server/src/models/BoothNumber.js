import mongoose from "mongoose";

const boothNumberSchema = new mongoose.Schema(
  {
    boothNumber: { type: String, trim: true, required: true, unique: true, index: true },
  },
  { timestamps: true, collection: "boothnumbers" }
);

// Uppercase normalize
boothNumberSchema.pre("validate", function (next) {
  if (this.boothNumber) this.boothNumber = String(this.boothNumber).trim().toUpperCase();
  next();
});

const BoothNumber =
  mongoose.models.BoothNumber || mongoose.model("BoothNumber", boothNumberSchema);

export default BoothNumber;
