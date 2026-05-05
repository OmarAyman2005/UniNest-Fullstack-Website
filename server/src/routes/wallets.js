import express from "express";
import {
  getWallet,
  createWallet,
  creditWallet,
  debitWallet,
  listWallets,
} from "../controllers/WalletController.js";

const router = express.Router();

// Public or authenticated endpoints (apply auth middleware in server if needed)
router.get("/", listWallets); // list wallets (admin)
router.get("/:userId", getWallet);
router.post("/", createWallet);
router.post("/:userId/credit", creditWallet);
router.post("/:userId/debit", debitWallet);

export default router;