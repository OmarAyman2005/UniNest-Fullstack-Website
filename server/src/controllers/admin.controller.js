import crypto from 'crypto';
import { validationResult } from 'express-validator';
import User, { ROLES } from '../models/User.js';
import VerificationToken from '../models/VerificationToken.js';
import { sendEmail } from '../utils/sendEmail.js';
import { CLIENT_URL } from '../config/env.js';

const NEEDS_ADMIN_APPROVAL = new Set(['student','staff', 'ta', 'professor']);

// ✅ allow @guc.edu.eg and subdomains
const GUC_EMAIL_RE = /^[^@\s]+@(?:[A-Za-z0-9-]+\.)*guc\.edu\.eg$/i;
const isGucEmail = (email) => GUC_EMAIL_RE.test(String(email || '').trim());

async function sendVerificationForUser(user) {
  const alreadyVerified =
    (typeof user.isEmailVerified === 'boolean' ? user.isEmailVerified : user.isVerified) === true;
  if (alreadyVerified) return;

  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
  await VerificationToken.create({ user: user._id, token, expiresAt });

  const link = `${CLIENT_URL}/verify?token=${encodeURIComponent(token)}`;
  const html = `
    <div style="font-family:Arial,sans-serif;line-height:1.6;color:#222">
      <h2 style="margin:0 0 12px">Verify your ACLians account</h2>
      <p>Click the button below to verify your email:</p>
      <p>
        <a href="${link}" style="background:#000;padding:10px 16px;border-radius:10px;color:#fff;text-decoration:none;display:inline-block">
          Verify Email
        </a>
      </p>
      <p style="font-size:12px;color:#666">If the button doesn't work, copy & paste this link:</p>
      <p style="font-size:12px;color:#0066cc;word-break:break-all">${link}</p>
    </div>
  `;

  try {
    await sendEmail({ to: user.email, subject: 'Verify your account', html, text: `Verify your account: ${link}` });
    console.log(`[mail] verification sent to ${user.email}`);
  } catch (err) {
    console.error('[mail] verification error:', err);
  }
}

// GET /admin/users
export const listUsers = async (req, res) => {
  const { role, q, approval, status, page = 1, limit = 20 } = req.query;
  const filter = {};
  if (role) filter.role = role;
  if (approval) filter.approvalStatus = approval;
  if (status) filter.status = status;
  if (q) filter.$or = [{ fullName: new RegExp(q, 'i') }, { email: new RegExp(q, 'i') }];

  const skip = (Number(page) - 1) * Number(limit);
  const [items, total] = await Promise.all([
    User.find(filter).sort({ createdAt: -1 }).skip(skip).limit(Number(limit)),
    User.countDocuments(filter),
  ]);
  res.json({ items, total, page: Number(page), pages: Math.ceil(total / limit) });
};

// GET /admin/users/:userId
export const getUserById = async (req, res) => {
  const { userId } = req.params;

  if (!mongoose.Types.ObjectId.isValid(userId)) {
    return res.status(400).json({ message: 'Invalid user id' });
  }

  const user = await User.findById(userId);
  if (!user) return res.status(404).json({ message: 'User not found' });

  res.json({ user });
};

// PATCH /admin/users/:userId/role
export const setRole = async (req, res) => {
  const { userId } = req.params;
  const { role } = req.body;

  if (!ROLES.includes(role)) return res.status(400).json({ message: 'Invalid role' });

  const user = await User.findById(userId);
  if (!user) return res.status(404).json({ message: 'User not found' });

  // ✅ subdomains allowed
  if (role !== 'vendor' && !isGucEmail(user.email)) {
    return res.status(400).json({ message: 'Only @guc.edu.eg emails may be assigned non-vendor roles.' });
  }

  const needsApproval = NEEDS_ADMIN_APPROVAL.has(role);
  user.role = role;
  user.approvalStatus = needsApproval ? 'pending' : 'approved';
  user.isEmailVerified = needsApproval ? false : true;
  user.isVerified = needsApproval ? false : true;
  await user.save();

  res.json({ message: 'Role updated', user });
};

// PATCH /admin/users/:userId/status
export const setStatus = async (req, res) => {
  const { userId } = req.params;
  const { status } = req.body;

  if (!['active', 'blocked'].includes(status)) {
    return res.status(400).json({ message: 'Invalid status' });
  }

  const user = await User.findByIdAndUpdate(userId, { status }, { new: true });
  if (!user) return res.status(404).json({ message: 'User not found' });

  res.json({ message: 'Status updated', user });
};

// POST /admin/users
export const createPrivileged = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  let { fullName, email, password, role } = req.body;
  email = String(email || '').trim().toLowerCase();

  if (!['admin', 'event_office'].includes(role))
    return res.status(400).json({ message: 'Only admin or event_office allowed here' });

  // Only event_office accounts require GUC email
  if (role === 'event_office' && !isGucEmail(email)) {
    return res.status(400).json({ message: 'Event Office accounts must use @guc.edu.eg email.' });
  }

  const exists = await User.findOne({ email });
  if (exists) return res.status(409).json({ message: 'Email already exists' });

  const user = await User.create({
    fullName,
    email,
    password,
    role,
    approvalStatus: 'approved',
    status: 'active',
    isEmailVerified: true,
    isVerified: true,
  });

  res.status(201).json({ message: 'Created', user });
};

// DELETE /admin/users/:userId
export const removeUser = async (req, res) => {
  const { userId } = req.params;
  const user = await User.findByIdAndDelete(userId);
  if (!user) return res.status(404).json({ message: 'User not found' });
  res.json({ message: 'Deleted' });
};

// PATCH /admin/users/:userId/approve
export const approveUser = async (req, res) => {
  const { userId } = req.params;
  const user = await User.findById(userId);
  if (!user) return res.status(404).json({ message: 'User not found' });

  if (user.role !== 'vendor' && !isGucEmail(user.email)) {
    return res.status(400).json({ message: 'Only @guc.edu.eg emails may be approved for non-vendor roles.' });
  }

  user.approvalStatus = 'approved';
  await user.save();

  const verified =
    (typeof user.isEmailVerified === 'boolean' ? user.isEmailVerified : user.isVerified) === true;

  if (!verified) {
    console.log(`[admin] sending verification to ${user.email} after approval`);
    await sendVerificationForUser(user);
  }

  res.json({ message: 'User approved. Verification email sent (if needed).' });
};

// PATCH /admin/users/:userId/reject
export const rejectUser = async (req, res) => {
  const { userId } = req.params;
  const user = await User.findById(userId);
  if (!user) return res.status(404).json({ message: 'User not found' });

  user.approvalStatus = 'rejected';
  await user.save();

  res.json({ message: 'User rejected.' });
};

// POST /admin/users/:userId/resend-verification
export const resendVerification = async (req, res) => {
  const { userId } = req.params;
  const user = await User.findById(userId);
  if (!user) return res.status(404).json({ message: 'User not found' });

  if (user.approvalStatus && user.approvalStatus !== 'approved') {
    return res.status(400).json({ message: 'User not approved yet' });
  }

  const verified =
    (typeof user.isEmailVerified === 'boolean' ? user.isEmailVerified : user.isVerified) === true;
  if (verified) return res.status(400).json({ message: 'User already verified' });

  await sendVerificationForUser(user);
  res.json({ message: 'Verification email resent.' });
};
