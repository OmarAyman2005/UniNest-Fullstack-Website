import Wallet, {WALLET_ROLES} from "../models/Wallet.js";
import User from "../models/User.js";

/**
 * GET /wallets/:userId?
 */
export async function getWallet(req, res) {
  try {
    const userId = req.params.userId ?? (req.user && req.user._id);
    if (!userId) return res.status(400).json({ error: "userId required" });

    const wallet = await Wallet.findByUserId(userId);
    if (!wallet) return res.status(404).json({ error: "Wallet not found" });

    return res.json({ wallet });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("getWallet error:", err);
    return res.status(500).json({ error: "Server error" });
  }
}

/**
 * POST /wallets
 */
export async function createWallet(req, res) {
  try {
    const { userId } = req.body;
    if (!userId) return res.status(400).json({ error: "userId required in body" });

    const user = await User.findById(userId).lean();
    if (!user) return res.status(404).json({ error: "User not found" });

    if (!WALLET_ROLES.has(String(user.role))) {
      return res.status(400).json({ error: "User role is not eligible for a wallet" });
    }

    const wallet = await Wallet.ensureForUser(user);
    return res.status(201).json({ wallet });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("createWallet error:", err);
    return res.status(500).json({ error: "Server error" });
  }
}

/**
 * POST /wallets/:userId/credit
 */
export async function creditWallet(req, res) {
  try {
    const { userId } = req.params;
    const amount = Number(req.body.amount);
    if (!userId || !amount || isNaN(amount) || amount <= 0)
      return res.status(400).json({ error: "Valid userId and positive amount required" });

    const wallet = await Wallet.findByUserId(userId);
    if (!wallet) return res.status(404).json({ error: "Wallet not found" });

    await wallet.credit(amount);
    return res.json({ wallet });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("creditWallet error:", err);
    return res.status(500).json({ error: err.message || "Server error" });
  }
}

/**
 * POST /wallets/:userId/debit
 */
export async function debitWallet(req, res) {
  try {
    const { userId } = req.params;
    const amount = Number(req.body.amount);
    if (!userId || !amount || isNaN(amount) || amount <= 0)
      return res.status(400).json({ error: "Valid userId and positive amount required" });

    const wallet = await Wallet.findByUserId(userId);
    if (!wallet) return res.status(404).json({ error: "Wallet not found" });

    await wallet.debit(amount);
    return res.json({ wallet });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("debitWallet error:", err);
    return res.status(400).json({ error: err.message || "Server error" });
  }
}

/**
 * GET /wallets
 */
export async function listWallets(req, res) {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(200, Number(req.query.limit) || 50);
    const skip = (page - 1) * limit;

    const [wallets, total] = await Promise.all([
      Wallet.find().sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      Wallet.countDocuments(),
    ]);

    return res.json({ wallets, total, page, limit });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("listWallets error:", err);
    return res.status(500).json({ error: "Server error" });
  }
}

export default {
  getWallet,
  createWallet,
  creditWallet,
  debitWallet,
  listWallets,
};