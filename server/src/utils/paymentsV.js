// server/src/utils/paymentsV.js
import Stripe from "stripe";
import { Payment } from "../models/PaymentV.js";
import { resolveApplicationPrice } from "./pricingV.js";
import User from "../models/User.js";
import { Event } from "../models/Event.js";
import { sendEmail } from "../utils/sendEmail.js";

// ---- Guarded Stripe init (no crash if key is missing) ----
const stripeSecret = process.env.STRIPE_SECRET_KEY;

export const stripe = stripeSecret
  ? new Stripe(stripeSecret, { apiVersion: "2023-10-16" })
  : null;

if (!stripeSecret) {
  console.log(
    "[paymentsV] STRIPE_SECRET_KEY is not set. Stripe helpers are disabled in this environment."
  );
}

/**
 * Create + send a Stripe Invoice for the accepted application.
 * Returns { payment, hostedUrl }.
 */
export async function createAndSendInvoiceForApplication(app) {
  // If Stripe isn't configured (e.g. local dev without keys), fail clearly
  if (!stripe) {
    throw new Error(
      "Stripe is not configured (missing STRIPE_SECRET_KEY). Cannot create invoice."
    );
  }

  // 1) Load event (for pricing rules)
  const ev = await Event.findById(app.eventId).lean();

  // 2) Compute amount (in MINOR units)
  let { amount, currency, kind, breakdown } = resolveApplicationPrice(app, ev);
  let stripeCurrency = String(currency || "egp").toLowerCase();

  console.log("[paymentsV] Resolved price BEFORE floor:", {
    appId: String(app._id),
    amount,
    currency: stripeCurrency,
    kind,
    breakdown,
  });

  // Safety floor: never allow <= 0
  if (!Number.isFinite(amount) || amount <= 0) {
    console.warn(
      "[paymentsV] Invalid amount from resolveApplicationPrice (",
      amount,
      ") – forcing 1000 minor units (10.00)"
    );
    amount = 1000; // 10.00 EGP
  }

  // 3) Ensure we have recipient email
  const user = await User.findById(app.userId, {
    email: 1,
    fullName: 1,
    firstName: 1,
    lastName: 1,
  }).lean();

  if (!user?.email) {
    throw new Error("Applicant has no email to invoice.");
  }

  const email = user.email;
  const name =
    user.fullName ||
    [user.firstName, user.lastName].filter(Boolean).join(" ").trim() ||
    undefined;

  // 4) Create Stripe Customer
  const customer = await stripe.customers.create({
    email,
    name,
    metadata: {
      applicationId: String(app._id),
      userId: String(app.userId),
    },
  });

  // Extra safety in TEST mode: if somehow negative, reset to 0
  if (typeof customer.balance === "number" && customer.balance < 0) {
    await stripe.customers.update(customer.id, { balance: 0 });
  }

  // 5) Add Invoice Item (pending)
  const description =
    kind === "booth"
      ? `Booth participation fee — booth ${app.boothNumber ?? "-"}`
      : `Bazaar participation fee — ${app.boothSize || "-"} — ${
          app.setupLocation || "-"
        }`;

  console.log("[paymentsV] Creating invoice item:", {
    customerId: customer.id,
    amount,
    currency: stripeCurrency,
    description,
  });

  const lineItem = await stripe.invoiceItems.create({
    customer: customer.id,
    currency: stripeCurrency,
    amount,
    description,
    metadata: {
      applicationId: String(app._id),
      kind,
      location: app.setupLocation || "",
      boothSize: app.boothSize || "",
      boothNumber: app.boothNumber || "",
    },
  });

  console.log("[paymentsV] Created invoice item:", {
    lineItemId: lineItem.id,
    amount: lineItem.amount,
    currency: lineItem.currency,
  });

  // 6) Create the invoice and INCLUDE pending items, but DO NOT auto-advance
  const invoiceDraft = await stripe.invoices.create({
    customer: customer.id,
    collection_method: "send_invoice",
    days_until_due: 3,
    auto_advance: false, // we'll finalize manually
    pending_invoice_items_behavior: "include",
    metadata: {
      applicationId: String(app._id),
      kind,
    },
  });

  console.log("[paymentsV] Created invoice (draft):", {
    invoiceId: invoiceDraft.id,
    amount_due: invoiceDraft.amount_due,
    status: invoiceDraft.status,
  });

  // 7) Finalize invoice → becomes 'open', still unpaid, amount_due > 0
  const invoice = await stripe.invoices.finalizeInvoice(invoiceDraft.id);

  console.log("[paymentsV] Finalized invoice:", {
    invoiceId: invoice.id,
    amount_due: invoice.amount_due,
    total: invoice.total,
    hosted_invoice_url: invoice.hosted_invoice_url,
    status: invoice.status,
  });

  const hostedUrl = invoice.hosted_invoice_url || null;

  // 8) Send OUR OWN email with payment link (using sendEmail.js)
  if (hostedUrl) {
    const amountDisplay = (amount / 100).toFixed(2);
    const currencyDisplay = stripeCurrency.toUpperCase();

    const html = `
      <div style="font-family:system-ui,Segoe UI,Arial,sans-serif">
        <h2>Your booth invoice</h2>
        <p>Dear ${name || "vendor"},</p>
        <p>
          Your invoice for <b>${amountDisplay} ${currencyDisplay}</b> is ready.
          You can pay it securely online using the link below:
        </p>
        <p><a href="${hostedUrl}">View & pay your invoice</a></p>
        <p>Due date: ${
          invoice.due_date
            ? new Date(invoice.due_date * 1000).toLocaleString()
            : "in 3 days"
        }</p>
        <p>Thank you for your participation.</p>
      </div>
    `;

    const text =
      `Your invoice for ${amountDisplay} ${currencyDisplay} is ready.\n` +
      `View & pay it here: ${hostedUrl}\n` +
      `Thank you for your participation.`;

    // Fire-and-forget; don't crash the flow if email fails
    sendEmail({
      to: email,
      subject: "Your ACLians booth invoice",
      html,
      text,
    }).catch((err) => {
      console.error("[paymentsV] Failed to send invoice email:", err.message);
    });
  }

  // 9) Persist Payment record
  const now = Date.now();
  const dueAt = new Date(now + 3 * 24 * 60 * 60 * 1000);

  const payDoc = await Payment.create({
    applicationId: app._id,
    userId: app.userId,
    kind,
    boothSize: app.boothSize || undefined,
    location: app.setupLocation || undefined,
    durationWeeks: app.setupDurationWeeks || undefined,
    currency: stripeCurrency.toUpperCase(), // e.g., "EGP"
    amount,
    status: "pending",
    stripeCustomerId: customer.id,
    stripeInvoiceId: invoice.id,
    dueAt,
  });

  return {
    payment: payDoc,
    hostedUrl,
  };
}
