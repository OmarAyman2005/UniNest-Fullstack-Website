import dotenv from "dotenv";
dotenv.config();

import nodemailer from "nodemailer";

/* ---------------- HELPER ---------------- */
function toBool(v) {
  if (typeof v === "boolean") return v;
  const s = String(v || "").toLowerCase();
  return ["1", "true", "yes", "on"].includes(s);
}

/* ---------------- ENV SUPPORT ---------------- */
// use EMAIL_* (your .env) but still support SMTP_*
const host = process.env.EMAIL_HOST || process.env.SMTP_HOST || "";
const port = Number(process.env.EMAIL_PORT || process.env.SMTP_PORT || 587);
const user = process.env.EMAIL_USER || process.env.SMTP_USER || "";
const pass = process.env.EMAIL_PASS || process.env.SMTP_PASS || "";
const from = process.env.EMAIL_FROM || process.env.SMTP_FROM || user;

/* Gmail: 587 => secure false, 465 => secure true */
const secure = toBool(process.env.SMTP_SECURE ?? (port === 465));

/* ---------------- TRANSPORTER ---------------- */
export const transporter = nodemailer.createTransport({
  host,
  port,
  secure,
  auth: user && pass ? { user, pass } : undefined,
  tls: { rejectUnauthorized: false },
});

/* ---------------- VERIFY SMTP ---------------- */
export async function verifySmtp() {
  // Check missing envs first
  const missing = [];
  if (!host) missing.push("EMAIL_HOST");
  if (!port) missing.push("EMAIL_PORT");
  if (!user) missing.push("EMAIL_USER");
  if (!pass) missing.push("EMAIL_PASS");

  if (missing.length > 0) {
    console.warn("[mail] Missing env vars:", missing.join(", "));
    console.warn("[mail] Email functions are disabled.");
    return;
  }

  try {
    await transporter.verify();
    console.log("[mail] SMTP verified OK");
  } catch (err) {
    console.error("[mail] SMTP verify failed:", err.message);
  }
}

/* ---------------- SEND EMAIL ---------------- */
export async function sendEmail({ to, subject, html, text }) {
  if (!user || !pass) {
    throw new Error("SMTP is not configured (EMAIL_USER/EMAIL_PASS missing).");
  }

  return transporter.sendMail({
    from,
    to,
    subject,
    text,
    html,
  });
}