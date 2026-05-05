// server/src/utils/applicationNotificationEmail.js
import mongoose from "mongoose";
import { sendEmail } from "./sendEmail.js";
import { Event } from "../models/Event.js";
import User from "../models/User.js";

async function resolveRecipient(app) {
  if (app.userId && mongoose.Types.ObjectId.isValid(app.userId)) {
    const u = await User.findById(app.userId, { email: 1 }).lean();
    if (u?.email) return String(u.email).toLowerCase();
  }
  const first = app.participants?.[0]?.email;
  return first ? String(first).toLowerCase() : null;
}

function subjectFor(status, eventTitle) {
  const suffix = eventTitle ? ` — ${eventTitle}` : "";
  if (status === "accepted")  return `Your application has been ACCEPTED${suffix}`;
  if (status === "rejected")  return `Your application has been REJECTED${suffix}`;
  if (status === "cancelled") return `Your application has been CANCELLED${suffix}`;
  return `Application status updated${suffix}`;
}

function buildBodies(app, eventDoc, actorName) {
  const title = eventDoc?.title || "the event";
  const boothLine = app.boothNumber ? `<p><b>Booth:</b> ${app.boothNumber}</p>` : "";
  const windowLine =
    app.reservationStart && app.reservationEnd
      ? `<p><b>Reservation:</b> ${new Date(app.reservationStart).toDateString()} → ${new Date(app.reservationEnd).toDateString()}</p>`
      : "";

  const lastNote = (app.notes || "").split("\n").slice(-1)[0] || "";
  const cleanNote = lastNote.replace(/^\[[A-Z]+\]\s*/, "").trim();
  const notesLine = cleanNote ? `<p><b>Notes:</b> ${cleanNote}</p>` : "";

  const html = `
    <div style="font-family:system-ui,Segoe UI,Arial,sans-serif">
      <h2>Application ${app.status.toUpperCase()}</h2>
      <p>Hi${app.applicantName ? ` ${app.applicantName}` : ""},</p>
      <p>Your request to join <b>${title}</b> has been <b>${app.status}</b>.</p>
      ${boothLine}
      ${windowLine}
      ${notesLine}
      <p>You can view your application in your dashboard.</p>
      ${actorName ? `<p style="color:#6b7280">— ${actorName}</p>` : ""}
    </div>
  `;

  const text = [
    `Application ${app.status.toUpperCase()}`,
    `Hi${app.applicantName ? ` ${app.applicantName}` : ""},`,
    `Your request to join ${title} has been ${app.status}.`,
    app.boothNumber ? `Booth: ${app.boothNumber}` : "",
    app.reservationStart && app.reservationEnd
      ? `Reservation: ${new Date(app.reservationStart).toDateString()} -> ${new Date(app.reservationEnd).toDateString()}`
      : "",
    cleanNote ? `Notes: ${cleanNote}` : "",
    "You can view your application in your dashboard.",
    actorName ? `— ${actorName}` : "",
  ].filter(Boolean).join("\n");

  return { html, text };
}

export async function sendApplicationStatusEmail(app, actorUser) {
  try {
    const to = await resolveRecipient(app);
    if (!to) return;

    const eventDoc =
      app.event ||
      (app.eventId ? await Event.findById(app.eventId, { title: 1, startDateTime: 1, endDateTime: 1 }).lean() : null);

    const actorName =
      (actorUser?.fullName && String(actorUser.fullName).trim()) ||
      [actorUser?.firstName, actorUser?.lastName].filter(Boolean).join(" ").trim() ||
      "";

    const subject = subjectFor(app.status, eventDoc?.title);
    const { html, text } = buildBodies(app, eventDoc, actorName);

    await sendEmail({ to, subject, html, text });
  } catch (err) {
    console.error("sendApplicationStatusEmail error:", err);
  }
}
