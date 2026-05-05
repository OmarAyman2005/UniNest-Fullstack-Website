// server/src/routes/stripeWebhook.js
import express from "express";
import Stripe from "stripe";

import { Payment } from "../models/PaymentV.js";
import User from "../models/User.js";
import { EventApplication } from "../models/EventApplication.js";
import { Event } from "../models/Event.js";
import { EventAccess } from "../models/EventAccess.js";
import { makeEventVisitorQR } from "../utils/qrcode.js";
import { sendEmail } from "../utils/sendEmail.js";

const router = express.Router();

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: "2023-10-16",
});

/* -------------------------------------------------------------------------- */
/*  Helper: build + send QR codes for all workers/participants in an app      */
/* -------------------------------------------------------------------------- */

/**
 * Send an email to the vendor that contains QR codes for all registered
 * workers/participants on the application.
 *
 * This is only called if:
 *   - app.status === "accepted"
 *   - EventAccess.externalVisitorsEnabled === true
 */
async function sendWorkerVisitorQREmail({ app, vendor, eventDoc, accessDoc }) {
  try {
    if (!accessDoc || !accessDoc.externalVisitorsEnabled) {
      console.log(
        "[visitorQR] externalVisitorsEnabled is FALSE or missing, skipping QR email for event",
        eventDoc?._id || app?.eventId
      );
      return;
    }

    const participants = Array.isArray(app.participants) ? app.participants : [];
    if (!participants.length) {
      console.log(
        "[visitorQR] No participants on application",
        String(app._id),
        "- nothing to send."
      );
      return;
    }

    // Determine email recipient (vendor)
    const to =
      vendor?.email ||
      app.contactEmail ||
      app.applicantEmail ||
      app.email ||
      null;

    if (!to) {
      console.warn(
        "[visitorQR] No vendor email found for application",
        String(app._id),
        "- cannot send visitor QR email."
      );
      return;
    }

    const eventIdStr =
      eventDoc?._id
        ? String(eventDoc._id)
        : app.eventId
        ? String(app.eventId)
        : null;

    const boothLabel = app.boothNumber
      ? `Booth ${app.boothNumber}`
      : "your booth";

    const qrEntries = [];

    // Generate a QR for each worker/participant
    for (let index = 0; index < participants.length; index++) {
      const participant = participants[index];

      const payload = {
        // This is what /visitor-qr will decode:
        k: "ev-visitor", // preserved by makeEventVisitorQR wrapper
        applicationId: String(app._id),
        eventId: eventIdStr,
        boothNumber: app.boothNumber || null,
        participantIndex: index,
        participantName: participant?.name || null,
      };

      // We only pass the payload to makeEventVisitorQR – it wraps into {k,v}
      const qrDataUrl = await makeEventVisitorQR(payload);

      qrEntries.push({
        label: participant?.name || `Worker #${index + 1}`,
        qrDataUrl,
      });
    }

    const eventName = eventDoc?.name || "your event";

    const subject = `Visitor QR codes for ${boothLabel} at ${eventName}`;

    let html = `
      <p>Hi ${vendor?.fullName || vendor?.firstName || "there"},</p>
      <p>
        We’ve received your booth reservation payment for
        <strong>${eventName}</strong>.
      </p>
      <p>
        Below are the visitor QR codes for the workers you registered in your
        application (<strong>${boothLabel}</strong>).
        Each worker should show their QR code at the entrance to be allowed in.
      </p>
    `;

    qrEntries.forEach(({ label, qrDataUrl }) => {
      html += `
        <hr />
        <p><strong>${label}</strong></p>
        <p>
          <img src="${qrDataUrl}" alt="Visitor QR for ${label}" />
        </p>
      `;
    });

    html += `
      <hr />
      <p>
        If you need to change the list of workers, please contact the event team.
      </p>
    `;

    const text =
      `We received your booth payment for ${eventName}.\n` +
      `This email contains QR codes for all registered workers (please open it in a mail client that supports images).`;

    console.log(
      "[visitorQR] Sending visitor QR email to",
      to,
      "for application",
      String(app._id)
    );

    await sendEmail({
      to,
      subject,
      html,
      text,
    });
  } catch (err) {
    console.error("[visitorQR] Error while sending visitor QR email:", err);
  }
}

/* -------------------------------------------------------------------------- */
/*  Helper: handle invoice.payment_succeeded                                  */
/* -------------------------------------------------------------------------- */

/**
 * Called when Stripe sends invoice.payment_succeeded.
 * Responsibilities:
 *  - Mark Payment as 'paid'
 *  - (Your existing behavior: send payment receipt, log, etc.)
 *  - NEW: send QR codes for workers if:
 *        app.status === "accepted" AND EventAccess.externalVisitorsEnabled
 */
async function handleInvoicePaymentSucceeded(invoice) {
  console.log(
    "[stripeWebhook] invoice.payment_succeeded received for invoice",
    invoice.id,
    "customer:",
    invoice.customer
  );

  // Idempotent update: only transition to 'paid' if not already paid
  const payment = await Payment.findOneAndUpdate(
    { stripeInvoiceId: invoice.id, status: { $ne: "paid" } },
    {
      $set: {
        status: "paid",
        paidAt: new Date(),
        stripeCustomerId: invoice.customer || undefined,
        amountPaid: invoice.amount_paid ?? undefined,
        currency: invoice.currency || undefined,
      },
    },
    { new: true }
  );

  if (!payment) {
    console.warn(
      "[stripeWebhook] No Payment document updated for invoice",
      invoice.id,
      "- either missing record or already paid."
    );
    return;
  }

  console.log(
    "[stripeWebhook] Payment marked as paid:",
    String(payment._id),
    "applicationId:",
    String(payment.applicationId)
  );

  // Load the related application (vendor's booth app)
  const app = await EventApplication.findById(payment.applicationId).lean();
  if (!app) {
    console.warn(
      "[stripeWebhook] Application not found for payment",
      String(payment._id),
      "applicationId was",
      payment.applicationId
    );
    return;
  }

  console.log(
    "[stripeWebhook] Loaded application",
    String(app._id),
    "status:",
    app.status,
    "boothNumber:",
    app.boothNumber
  );

  // Vendor who owns this application
  const vendor = app.userId
    ? await User.findById(app.userId).lean()
    : null;

  // Load event + event access
  const eventId = app.eventId || app.event;
  const eventDoc = eventId ? await Event.findById(eventId).lean() : null;
  const accessDoc = eventId
    ? await EventAccess.findOne({ event: eventId }).lean()
    : null;

  console.log(
    "[stripeWebhook] Event for application",
    String(app._id),
    "is",
    eventDoc?._id || "(none)",
    "externalVisitorsEnabled:",
    accessDoc?.externalVisitorsEnabled
  );

  /* --------------------------- Payment receipt email ---------------------- */

  try {
    const toReceipt =
      vendor?.email ||
      app.contactEmail ||
      invoice.customer_email ||
      null;

    if (toReceipt) {
      const amountStr = (invoice.amount_paid ?? 0) / 100;
      const subject = `Payment received for your booth at ${
        eventDoc?.name || "the event"
      }`;

      const html = `
        <p>Hi ${vendor?.fullName || vendor?.firstName || "there"},</p>
        <p>
          We’ve successfully received your payment for
          <strong>${eventDoc?.name || "your event"}</strong>.
        </p>
        <p>
          Amount: <strong>${amountStr} ${
            invoice.currency?.toUpperCase() || ""
          }</strong><br/>
          Invoice: <code>${invoice.number || invoice.id}</code>
        </p>
        <p>Thank you for your participation!</p>
      `;

      console.log(
        "[stripeWebhook] Sending payment receipt email to",
        toReceipt
      );

      await sendEmail({
        to: toReceipt,
        subject,
        html,
        text: `We received your payment of ${amountStr} ${
          invoice.currency?.toUpperCase() || ""
        } for ${eventDoc?.name || "your event"}.`,
      });
    } else {
      console.warn(
        "[stripeWebhook] No recipient email for payment receipt (application",
        String(app._id),
        ")"
      );
    }
  } catch (err) {
    console.error(
      "[stripeWebhook] Failed to send payment receipt email:",
      err
    );
  }

  /* ---------------------- NEW: send visitor QR codes ---------------------- */

  if (app.status !== "accepted") {
    console.log(
      "[visitorQR] Application status is not 'accepted' (current:",
      app.status,
      ") – not sending visitor QR email."
    );
    return;
  }

  console.log(
    "[visitorQR] Application is accepted; attempting to send worker QR codes..."
  );

  await sendWorkerVisitorQREmail({
    app,
    vendor,
    eventDoc,
    accessDoc,
  });
}

/* -------------------------------------------------------------------------- */
/*  Webhook route                                                             */
/* -------------------------------------------------------------------------- */

router.post(
  "/webhook",
  // IMPORTANT: in server.js you must mount this with express.raw(), e.g.:
  // app.post("/api/stripe/webhook", express.raw({ type: "application/json" }), stripeWebhookRouter);
  express.raw({ type: "application/json" }),
  async (req, res) => {
    const sig = req.headers["stripe-signature"];

    let event;
    try {
      event = stripe.webhooks.constructEvent(
        req.body,
        sig,
        process.env.STRIPE_WEBHOOK_SECRET
      );
    } catch (err) {
      console.error(
        "[stripeWebhook] Signature verification failed:",
        err.message
      );
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    console.log(
      "[stripeWebhook] Event received from Stripe:",
      event.type,
      "id:",
      event.id
    );

    try {
      switch (event.type) {
        case "invoice.payment_succeeded":
          await handleInvoicePaymentSucceeded(event.data.object);
          break;

        // You can keep / add other event types here as you had them before.
        // case "invoice.payment_failed":
        //   ...
        //   break;

        default:
          console.log("[stripeWebhook] Unhandled event type:", event.type);
      }

      // Always answer 200 so Stripe knows we received it.
      res.json({ received: true });
    } catch (err) {
      console.error("[stripeWebhook] Handler threw an error:", err);
      // Still respond 200/OK so Stripe doesn't retry forever if it is our bug.
      res.status(200).json({ received: true, error: "internal error" });
    }
  }
);

export default router;
