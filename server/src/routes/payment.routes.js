import express from "express";
import {
  createStripeIntent,
  payWithWallet,
} from "../controllers/PaymentController.js";

const router = express.Router();

// Create a Stripe PaymentIntent for a registration
router.post("/stripe-intent", createStripeIntent);

// Pay for a registration using wallet
router.post("/wallet", payWithWallet);

export default router;