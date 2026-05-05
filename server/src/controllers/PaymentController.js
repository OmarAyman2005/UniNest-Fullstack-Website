import Stripe from "stripe";
import { sendEmail } from "../utils/sendEmail.js";
import mongoose from "mongoose";
import { Event } from "../models/Event.js";
import Wallet from "../models/Wallet.js";
import User from "../models/User.js";
import { EventApplication } from "../models/EventApplication.js";
import { CLIENT_URL } from "../config/env.js";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "", { apiVersion: "2022-11-15" });

function receiptLink(app, ev) {
  if (!CLIENT_URL) return null;
  if (ev && ev._id) return `${CLIENT_URL.replace(/\/$/, "")}/events/${ev._id}`;
  return CLIENT_URL;
}

async function sendReceiptEmail({ to, app, ev, paymentMethod } = {}) {
  if (!to) return;
  const link = receiptLink(app, ev);
  const subject = `Payment receipt — ${ev?.name || "Event"}`;

  const text = [
    `Hello,`,
    ``,
    `Thank you for your payment for "${ev?.name || ev?.title || "Event"}".`,
    ``,
    `Amount: ${app?.payment?.amount ?? ev?.price}`,
    `Method: ${paymentMethod ?? "unknown"}`,
    ``,
    link ? `View details: ${link}` : "",
    ``,
    `Regards,`,
    `Event Team`,
  ].join("\n");

  const html = `
    <div style="font-family:Arial,sans-serif;line-height:1.6;color:#222">
      <h2 style="margin:0 0 12px">Payment receipt</h2>
      <p>Thank you for your payment for "<strong>${ev?.name || ev?.title || "Event"}</strong>".</p>
      <p><strong>Amount:</strong> ${app?.payment?.amount ?? ev?.price}</p>
      <p><strong>Method:</strong> ${app?.payment?.method ?? "unknown"}</p>
      ${link ? `<p style="margin-top:12px"><a href="${link}" style="background:#000;padding:10px 16px;border-radius:10px;color:#fff;text-decoration:none;display:inline-block">View details</a></p>` : ""}
      <p style="font-size:12px;color:#666;margin-top:12px">If you have questions, reply to this email.</p>
    </div>
  `;

  await sendEmail({ to, subject, text, html });
}

function appSummaryText(app, ev) {
  return `Receipt for payment
Event: ${ev.name || ev.title || ""}
Amount: ${app.payment?.amount ?? ev.price}
Method: ${app.payment?.method ?? "unknown"}
Application id: ${app._id}
Thank you for your payment.
`;
}

function appSummaryHtml(app, ev) {
  return `
    <div>
      <h2>Payment receipt</h2>
      <p><strong>Event:</strong> ${ev.name || ev.title || ""}</p>
      <p><strong>Amount:</strong> ${app.payment?.amount ?? ev.price}</p>
      <p><strong>Method:</strong> ${app.payment?.method ?? "unknown"}</p>
      <p><strong>Application id:</strong> ${app._id}</p>
      <p>Thank you for your payment.</p>
    </div>
  `;
}

export async function createStripeIntent(req, res) {
  try {
    // expect { eventId, userId, returnUrl? } in body
    const { eventId, userId, returnUrl } = req.body || {};
    if (!eventId || !userId) return res.status(400).json({ error: "eventId and userId required" });
    if (!mongoose.Types.ObjectId.isValid(eventId) || !mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ error: "Invalid eventId or userId" });
    }

    if (!stripe) return res.status(503).json({ error: "Stripe not configured on server" });

    // optional auth check
    if (req.user && String(req.user._id) !== String(userId)) {
      return res.status(403).json({ error: "Not authorized for this user" });
    }

    const ev = await Event.findById(eventId).lean();
    if (!ev) return res.status(404).json({ error: "Event not found" });
    if (ev.price == null) return res.status(400).json({ error: "Event has no price" });

    // amount in subunits (cents)
    const amountCents = Math.round(Number(ev.price) * 100);
    if (!Number.isFinite(amountCents) || amountCents <= 0) return res.status(400).json({ error: "Invalid amount" });

    const currency = (ev.currency || "usd").toLowerCase();

    // create PaymentIntent - limit to card only
    const paymentIntent = await stripe.paymentIntents.create({
      amount: amountCents,
      currency,
      automatic_payment_methods: { enabled: true },
      metadata: {
        eventId: String(ev._id),
        userId: String(userId),
      },
      // optionally include return_url in metadata if you use redirect flows
    });

    // create EventApplication record similar to payWithWallet (mark pending)
    let app = null;
    try {
      const userDoc = await User.findById(userId).lean();
      const evtType = String(ev.eventType || ev.type || "").toLowerCase();
      app = await EventApplication.create({
        eventId: ev._id,
        userId,
        applicantName: userDoc?.fullName || userDoc?.email || "",
        // payment not completed yet -> pending
        status: ["workshop", "trip"].includes(evtType) ? "accepted" : "pending",
        payment: {
          method: "stripe",
          stripePaymentIntentId: paymentIntent.id,
          amount: Number(ev.price),
          currency: (ev.currency || "EGP").toUpperCase(),
          createdAt: new Date(),
        },
        createdAt: new Date(),
      });
    } catch (e) {
      console.error("Failed to create EventApplication after creating stripe intent:", e);
      // continue, we still return clientSecret
    }

    // send receipt / notification email (payment pending)
    try {
      const usr = await User.findById(userId).lean();
      await sendReceiptEmail({ to: usr?.email, app, ev, paymentMethod: "stripe" });
    } catch (e) {
      console.error("Failed to send receipt email after stripe intent:", e);
    }

    return res.json({
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
      application: app || null,
    });
  } catch (err) {
    console.error("createStripeIntent error:", err);
    return res.status(500).json({ error: err?.message || "Internal server error" });
  }
}

export async function payWithWallet(req, res) {
  try {
    const { eventId, userId } = req.body || {};
    if (!eventId || !userId) return res.status(400).json({ error: "eventId and userId required" });
    if (!mongoose.Types.ObjectId.isValid(eventId) || !mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ error: "Invalid eventId or userId" });
    }

    if (req.user && String(req.user._id) !== String(userId)) {
      return res.status(403).json({ error: "Not authorized for this user" });
    }

    const ev = await Event.findById(eventId).lean();
    if (!ev) return res.status(404).json({ error: "Event not found" });
    if (ev.price == null) return res.status(400).json({ error: "Event has no price" });

    const wallet = await Wallet.findByUserId(String(userId));
    if (!wallet) return res.status(404).json({ error: "Wallet not found" });

    const amount = Number(ev.price);
    if (!Number.isFinite(amount) || amount <= 0) return res.status(400).json({ error: "Invalid amount" });

    if (!wallet.enabled) return res.status(403).json({ error: "Wallet disabled" });
    if (wallet.balance < amount) return res.status(402).json({ error: "Insufficient wallet balance" });

    await wallet.debit(amount);

    // create EventApplication
    let app;
    try {
      const userDoc = await User.findById(userId).lean();
      const evtType = String(ev.eventType || ev.type || "").toLowerCase();
      app = await EventApplication.create({
        eventId: ev._id,
        userId,
        applicantName: userDoc?.fullName || userDoc?.email || "",
        status: ["workshop", "trip"].includes(evtType) ? "accepted" : "registered",
        payment: {
          method: "wallet",
          walletId: wallet._id,
          amount,
          currency: wallet.currency || ev.currency || "EGP",
          paidAt: new Date(),
        },
        createdAt: new Date(),
      });
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error("Failed to create EventApplication after wallet payment:", e);
      // still continue and respond success
    }

    // send receipt email (uses shared sendEmail helper)
    try {
      const usr = await User.findById(userId).lean();
      await sendReceiptEmail({ to: usr?.email, app, ev });
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error("Failed to send receipt email:", e);
    }

    return res.json({ status: "success", application: app || null });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("payWithWallet error:", err);
    return res.status(500).json({ error: err.message || "Failed to pay with wallet" });
  }
}

export default {
  createStripeIntent,
  payWithWallet,
};