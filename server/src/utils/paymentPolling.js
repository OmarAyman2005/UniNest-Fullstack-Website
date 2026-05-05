// server/src/utils/paymentPolling.js
import Stripe from "stripe";
import nodemailer from "nodemailer";          // ✅ NEW: use our own transporter here
import { Payment } from "../models/PaymentV.js";
import User from "../models/User.js";
import { EventApplication } from "../models/EventApplication.js";
import { Event } from "../models/Event.js";
import { sendEmail } from "./sendEmail.js";   // keep using this for vendor receipts
import { makeEventVisitorQR } from "./qrcode.js";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: "2023-10-16",
});

/* -------------------------------------------------------------------------- */
/*  Local transporter JUST for worker QR emails                               */
/* -------------------------------------------------------------------------- */

const qrTransporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || "smtp.gmail.com",
  port: Number(process.env.SMTP_PORT || 587),
  secure: false, // true for 465, false for 587
  auth: {
    user: process.env.SMTP_USER || process.env.EMAIL_USER,
    pass: process.env.SMTP_PASS || process.env.EMAIL_PASS,
  },
});

const QR_FROM =
  process.env.EMAIL_FROM ||
  `"Internship System" <${
    process.env.SMTP_USER || process.env.EMAIL_USER || "mailverify436@gmail.com"
  }>`;

/* -------------------------------------------------------------------------- */
/*  Helper: send QR code emails to ALL workers/participants                   */
/* -------------------------------------------------------------------------- */

async function sendWorkerVisitorQREmails({ application, eventDoc, invoice }) {
  try {
    if (!application) {
      return;
    }

    // Requirement: only for accepted + paid applications
    if (application.status !== "accepted") {
      return;
    }

    const participants = Array.isArray(application.participants)
      ? application.participants
      : [];

    if (!participants.length) {
      return;
    }

    const eventName = eventDoc?.name || "your event";
    const boothLabel = application.boothNumber
      ? `Booth ${application.boothNumber}`
      : "your booth";

    const eventIdStr = eventDoc?._id
      ? String(eventDoc._id)
      : application.eventId
      ? String(application.eventId)
      : null;

    // Send one email per worker
    for (let idx = 0; idx < participants.length; idx++) {
      const p = participants[idx];

      if (!p?.email) {
        continue;
      }

      const workerName = p.name || `Worker #${idx + 1}`;
      const workerEmail = p.email;

      // Payload that the /visitor-qr frontend route will decode
      const payload = {
        applicationId: String(application._id),
        eventId: eventIdStr,
        boothNumber: application.boothNumber || null,
        participantIndex: idx,
        participantName: workerName,
        participantEmail: workerEmail,
      };

      // This returns a DATA URL (data:image/png;base64,....)
      const qrDataUrl = await makeEventVisitorQR(payload);

      // Convert data URL -> Buffer so we can use it as an inline attachment with CID
      let mimeType = "image/png";
      let base64Data = null;

      if (qrDataUrl && typeof qrDataUrl === "string") {
        const match = /^data:([^;]+);base64,(.+)$/.exec(qrDataUrl);
        if (match) {
          mimeType = match[1] || "image/png";
          base64Data = match[2];
        } else {
        }
      }

      if (!base64Data) {
        continue;
      }

      const qrBuffer = Buffer.from(base64Data, "base64");
      const cid = `worker-qr-${String(application._id)}-${idx}@aclians`;

      const subject = `Your visitor QR code for ${boothLabel} at ${eventName}`;

      const html = `
        <div style="font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;">
          <p>Hi ${workerName},</p>
          <p>
            You have been registered as a worker for
            <strong>${eventName}</strong> (${boothLabel}).
          </p>
          <p>
            Please show the QR code below at the entrance to access the event.
          </p>
          <p style="margin: 16px 0;">
            <img src="cid:${cid}" alt="Visitor QR for ${workerName}" style="width:220px;height:220px;" />
          </p>
          <p>
            Keep this email handy. Do not share your QR code with others.
          </p>
        </div>
      `;

      const text =
        `Hi ${workerName},\n\n` +
        `You have been registered as a worker for ${eventName} (${boothLabel}).\n\n` +
        `This email contains your visitor QR code. Please open it in a mail client that supports images and show the QR at the entrance.\n`;

      try {
        await qrTransporter.sendMail({
          from: QR_FROM,
          to: workerEmail,
          subject,
          html,
          text,
          attachments: [
            {
              filename: "visitor-qr.png",
              content: qrBuffer,
              contentType: mimeType,
              cid,
            },
          ],
        });

        console.log(
          "[payPoll][visitorQR] SUCCESS: worker QR email sent to",
          workerEmail
        );
      } catch (err) {
      }
    }
  } catch (err) {
  }
}

/* -------------------------------------------------------------------------- */
/*  Helper: handle a SINGLE invoice that just became paid                     */
/* -------------------------------------------------------------------------- */

async function handlePaidInvoice(paymentDoc, invoice) {
  const invoiceId = invoice.id;
  const amountPaidMinor = invoice.amount_paid || invoice.total || 0;
  const currency = (invoice.currency || "egp").toUpperCase();
  const hostedUrl = invoice.hosted_invoice_url || null;
  const invoicePdfUrl = invoice.invoice_pdf || null;
  const chargeId = invoice.charge || null;

  // 1) Mark Payment as paid (only once)
  const updatedPayment = await Payment.findByIdAndUpdate(
    paymentDoc._id,
    {
      status: "paid",
      paidAt: new Date(
        invoice.status_transitions?.paid_at
          ? invoice.status_transitions.paid_at * 1000
          : Date.now()
      ),
    },
    { new: true }
  );

  // 2) Mark EventApplication.hasPaid = true AND return the updated application
  let application = null;
  if (updatedPayment?.applicationId) {
    application = await EventApplication.findByIdAndUpdate(
      updatedPayment.applicationId,
      { $set: { hasPaid: true } },
      { new: true }
    ).lean();
  } else {
  }

  // 3) Build receipt URLs from the Charge
  let receiptUrl = null;
  let receiptPdfUrl = null;

  if (chargeId) {
    try {
      const charge = await stripe.charges.retrieve(chargeId);
      receiptUrl = charge.receipt_url || null;

      if (receiptUrl) {
        const base = receiptUrl.split("?")[0];
        receiptPdfUrl = `${base}/pdf`;
      }
    } catch (err) {
    }
  } else {
  }

  // 4) Load the user (vendor) for receipt (NOT for worker QR targets)
  const user = await User.findById(updatedPayment.userId, {
    email: 1,
    fullName: 1,
    firstName: 1,
    lastName: 1,
  }).lean();

  if (!user) {
  }

  // 5) Send receipt email to vendor (if possible) – still using sendEmail.js
  if (user?.email) {
    const amountDisplay = (amountPaidMinor / 100).toFixed(2);
    const name =
      user.fullName ||
      [user.firstName, user.lastName].filter(Boolean).join(" ").trim() ||
      "vendor";

    const subject = "Your ACLians payment receipt";

    const htmlParts = [
      `<p>Dear ${name},</p>`,
      `<p>We have received your payment of <b>${amountDisplay} ${currency}</b> for your ACLians participation.</p>`,
    ];

    if (invoicePdfUrl) {
      htmlParts.push(
        `<p><b>Invoice (PDF):</b> <a href="${invoicePdfUrl}">Download invoice</a></p>`
      );
    } else if (hostedUrl) {
      htmlParts.push(
        `<p><b>Invoice:</b> <a href="${hostedUrl}">${hostedUrl}</a></p>`
      );
    }

    if (receiptPdfUrl) {
      htmlParts.push(
        `<p><b>Payment receipt (PDF):</b> <a href="${receiptPdfUrl}">Download receipt</a></p>`
      );
    } else if (receiptUrl) {
      htmlParts.push(
        `<p><b>Payment receipt:</b> <a href="${receiptUrl}">View online</a> (you can download the PDF from that page).</p>`
      );
    }

    htmlParts.push(
      `<p>Invoice ID: <code>${invoiceId}</code></p>`,
      "<p>Thank you for your participation.</p>"
    );

    const html =
      `<div style="font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;">` +
      htmlParts.join("\n") +
      `</div>`;

    const textLines = [
      `Dear ${name},`,
      "",
      `We have received your payment of ${amountDisplay} ${currency} for your ACLians participation.`,
    ];

    if (invoicePdfUrl) {
      textLines.push(`Invoice PDF: ${invoicePdfUrl}`);
    } else if (hostedUrl) {
      textLines.push(`Invoice: ${hostedUrl}`);
    }

    if (receiptPdfUrl) {
      textLines.push(`Payment receipt PDF: ${receiptPdfUrl}`);
    } else if (receiptUrl) {
      textLines.push(`Payment receipt: ${receiptUrl}`);
    }

    textLines.push(
      "",
      `Invoice ID: ${invoiceId}`,
      "",
      "Thank you for your participation."
    );

    const text = textLines.join("\n");

    try {
      await sendEmail({
        to: user.email,
        subject,
        html,
        text,
      });
      console.log(
        "[payPoll] SUCCESS: payment receipt email sent to",
        user.email
      );
    } catch (err) {
    }
  } else {
  }

  // 6) Load the Event for nicer worker email content (event name, etc.)
  let eventDoc = null;
  if (application?.eventId) {
    try {
      eventDoc = await Event.findById(application.eventId).lean();
    } catch (err) {
    }
  }

  // 7) Send QR code emails to workers (participants)
  if (application) {
    await sendWorkerVisitorQREmails({
      application,
      eventDoc,
      invoice,
    });
  } else {
  }
}

// Public function: start polling loop
export function startStripePaymentPolling() {
  const INTERVAL_MS = 30 * 1000; // every 30 seconds (change if you want slower)

  const tick = async () => {
    try {
      // Find pending payments that have an invoice id
      const pendingPayments = await Payment.find({
        status: "pending",
        stripeInvoiceId: { $exists: true, $ne: null },
      })
        .limit(20)
        .lean();

      if (!pendingPayments.length) {
        return;
      }

      for (const p of pendingPayments) {
        try {
          const invoice = await stripe.invoices.retrieve(p.stripeInvoiceId);

          if (invoice.status === "paid") {
            await handlePaidInvoice(p, invoice);
          }
          // You can also handle "void", "uncollectible" etc. here if you want.
        } catch (err) {
        }
      }
    } catch (err) {
    }
  };

  // Run once on startup:
  tick();
  // And then repeat:
  setInterval(tick, INTERVAL_MS);
}
