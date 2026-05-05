import mongoose from "mongoose";
const { Schema } = mongoose;

// roles allowed to have wallets
export const WALLET_ROLES = new Set(["student", "staff", "ta", "professor"]);

const WalletSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true, unique: true },
    balance: { type: Number, default: 0 },
    currency: { type: String, default: "EGP" },
    enabled: { type: Boolean, default: true },
  },
  { timestamps: true }
);

// Static: find wallet by user id (accepts id string or object)
WalletSchema.statics.findByUserId = function (userOrId) {
  const id = userOrId && (userOrId._id || userOrId.id) ? (userOrId._id || userOrId.id) : userOrId;
  return this.findOne({ user: id });
};

// Static: ensure wallet exists for a user object or id
WalletSchema.statics.ensureForUser = async function (userOrId) {
  const id = userOrId && (userOrId._id || userOrId.id) ? (userOrId._id || userOrId.id) : userOrId;
  if (!id) throw new Error("user id required");
  let wallet = await this.findOne({ user: id });
  if (!wallet) {
    wallet = await this.create({
      user: id,
      balance: 0,
      currency: "EGP",
      enabled: true,
    });
  }
  return wallet;
};

// Instance: credit wallet
WalletSchema.methods.credit = async function (amount) {
  const n = Number(amount);
  if (!Number.isFinite(n) || n <= 0) throw new Error("Invalid credit amount");
  this.balance = Number(this.balance || 0) + n;
  await this.save();
  return this;
};

// Instance: debit wallet
WalletSchema.methods.debit = async function (amount) {
  const n = Number(amount);
  if (!Number.isFinite(n) || n <= 0) throw new Error("Invalid debit amount");
  if (Number(this.balance || 0) < n) throw new Error("Insufficient wallet balance");
  this.balance = Number(this.balance || 0) - n;
  await this.save();
  return this;
};

const Wallet = mongoose.models.Wallet || mongoose.model("Wallet", WalletSchema);
export default Wallet;