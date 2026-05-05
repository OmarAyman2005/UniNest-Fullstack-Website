// server/src/models/PaymentV.js
import mongoose from "mongoose";

const paymentSchema = new mongoose.Schema(
  {
    applicationId: { type: mongoose.Schema.Types.ObjectId, ref: "EventApplication", required: true, index: true },
    userId:        { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },

    // Snapshot of what the fee was based on
    kind: { type: String, enum: ["booth", "bazaar"], required: true },
    boothSize: { type: String },        // bazaar only e.g. "2x2" | "4x4"
    location:  { type: String },        // zone / hall / area
    durationWeeks: { type: Number },    // booth only (1..4)

    currency: { type: String, default: "EGP" },   // Stripe currency code
    amount:   { type: Number, required: true },   // smallest unit (piasters/fils)

    status:   { type: String, enum: ["pending", "paid", "failed", "void", "expired"], default: "pending", index: true },

    // Stripe references
    stripeCustomerId:      { type: String },
    stripeInvoiceId:       { type: String, index: true },
    stripePaymentIntentId: { type: String },
    stripeChargeId:        { type: String },

    // Deadline (3 days after acceptance)
    dueAt: { type: Date, required: true },
  },
  { timestamps: true }
);

export const Payment = mongoose.model("Payment", paymentSchema);
