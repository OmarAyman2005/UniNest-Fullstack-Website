// server/src/utils/mailer.js
import dotenv from "dotenv";
dotenv.config(); // ensure .env is loaded even if server.js missed it

import nodemailer from "nodemailer";

function bool(v) {
  if (typeof v === "boolean") return v;
  const s = String(v ?? "").toLowerCase().trim();
  return s === "1" || s === "true" || s === "yes" || s === "on";
}

// Support BOTH SMTP_* and EMAIL_* env names
const host =
  process.env.SMTP_HOST ||
  process.env.EMAIL_HOST ||
  "";

const port = Number(
  process.env.SMTP_PORT ||
  process.env.EMAIL_PORT ||
  0
) || 587;

// Gmail: 465 => secure true; 587 => secure false (STARTTLS)
const secure =
  typeof process.env.SMTP_SECURE !== "undefined"
    ? bool(process.env.SMTP_SECURE)
    : (port === 465);

const user =
  process.env.SMTP_USER ||
  process.env.EMAIL_USER ||
  "";

const pass =
  process.env.SMTP_PASS ||
  process.env.EMAIL_PASS ||
  "";

const from =
  process.env.SMTP_FROM ||
  process.env.EMAIL_FROM ||
  user ||
  "";

// Build transporter; only attach auth if both user & pass exist
export const mailer = nodemailer.createTransport({
  host,
  port,
  secure,
  auth: (user && pass) ? { user, pass } : undefined,
  // Help some hosts on 587 negotiate TLS cleanly
  tls: { ciphers: "TLSv1.2" },
});

export async function verifySmtpOnce() {
  // Clear diagnostics if any of these are missing
  const missing = [];
  if (!host) missing.push("EMAIL_HOST/SMTP_HOST");
  if (!port) missing.push("EMAIL_PORT/SMTP_PORT");
  if (!user) missing.push("EMAIL_USER/SMTP_USER");
  if (!pass) missing.push("EMAIL_PASS/SMTP_PASS");

  if (missing.length) {
    console.warn("[mail] Missing env:", missing.join(", "),
      "→ email sending is disabled until provided.");
    return;
  }

  try {
    await mailer.verify();
    console.log(
      "[mail] SMTP verified:",
      `${host}:${port}`,
      secure ? "(secure 465)" : "(STARTTLS 587)"
    );
  } catch (err) {
    console.error("[mail] SMTP verify failed:", err?.message || err);
  }
}

export async function sendMail({ to, subject, html, text }) {
  if (!user || !pass) {
    throw new Error("SMTP is not configured (missing EMAIL_USER/EMAIL_PASS or SMTP_USER/SMTP_PASS).");
  }
  return mailer.sendMail({
    from: from || user,
    to,
    subject,
    text,
    html,
  });
}
