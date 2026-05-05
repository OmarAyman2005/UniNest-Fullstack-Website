// server.js
import 'dotenv/config'; // MUST come before importing any routes that use Stripe
import express from "express";
import cors from "cors";
import mongoose from "mongoose";
import dotenv from "dotenv";
import cookieParser from "cookie-parser";
import path from "path";
import stripeWebhookRouter from "./src/routes/stripeWebhook.js";
import { startStripePaymentPolling } from "./src/utils/paymentPolling.js";


// ---- Routers ----
import authRoutes from "./src/routes/auth.routes.js";
import adminRoutes from "./src/routes/admin.routes.js";
import publicRoutes from "./src/routes/publicRoutes.js";
import eventRoutes from "./src/routes/eventRoutes.js";
import bazaarRoutes from "./src/routes/bazaarRoutes.js";
import conferenceRoutes from "./src/routes/conferenceRoutes.js";
import tripRoutes from "./src/routes/tripRoutes.js";
import workshopRoutes from "./src/routes/workshopRoutes.js";
import workshopRequestsRoutes from "./src/routes/workshopRequestsRoutes.js";
import sportsRoutes from "./src/routes/sportsRoutes.js";
import eventApplicationRoutes from "./src/routes/eventApplicationRoutes.js";
import boothNumberRoutes from "./src/routes/boothNumberRoutes.js";
import eventRegisterRoutes from "./src/routes/eventRegisterRoutes.js";
import walletRoutes from "./src/routes/wallets.js";
import paymentRoutes from "./src/routes/payment.routes.js";
import notificationsRoutes from "./src/routes/notificationsRoutes.js";
import reportRoutes from "./src/routes/reportRoutes.js";
import pollRoutes from "./src/routes/pollRoutes.js";
import documentsRoutes from "./src/routes/documents.routes.js";
import vendorRoutes from "./src/routes/vendorRoutes.js";
import supportRoutes from "./src/routes/support.routes.js";

import { autoArchiveEvents } from "./src/utils/archiveEvents.js";
import { startNotificationsScheduler } from "./src/utils/scheduler.js";
dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

/* ---------------- CORS (robust, non-throwing) ---------------- */
const normalize = (u) => String(u || "").replace(/\/+$/, "");

const envOrigins =
  (process.env.CLIENT_URLS || process.env.CLIENT_URL || "")
    .split(",")
    .map((s) => normalize(s.trim()))
    .filter(Boolean);

const devOrigins = [
  "http://localhost:3000",
  "http://127.0.0.1:3000",
  "http://0.0.0.0:3000",
].map(normalize);

const ALLOWED = new Set([...envOrigins, ...devOrigins]);

const corsOptions = {
  origin(origin, cb) {
    // Allow tools/same-origin with no Origin header
    if (!origin) return cb(null, true);
    if (ALLOWED.has(normalize(origin))) return cb(null, true);
    return cb(null, false); // block silently (no throw)
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  optionsSuccessStatus: 204,
};

app.set("trust proxy", 1);
app.use(cors(corsOptions));
// Express 5: use regex to match all for preflight
app.options(/.*/, cors(corsOptions));

/* ---------------- Body & Cookies ---------------- */
app.use(express.json({ limit: "1mb" }));
app.use(cookieParser());

/* ---------------- Health ---------------- */
app.get("/", (_req, res) => res.send("API is running..."));
app.get("/api/health", (_req, res) => res.json({ ok: true }));

// log every request (method + path)
app.use((req, _res, next) => {
  console.log(`[req] ${req.method} ${req.originalUrl}`);
  next();
});

// hard ping that bypasses the sports router
app.get("/api/sports/_ping", (_req, res) => res.json({ ok: true, from: "server.js" }));

/* ---------------- API Routes ---------------- */
/* ------------ API routes ------------ */
app.use("/api/auth", authRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/public", publicRoutes);
app.use("/api/event", eventRoutes);
app.use("/api/bazaar", bazaarRoutes);
app.use("/api/conference", conferenceRoutes);
app.use("/api/trip", tripRoutes);
app.use("/api/workshop", workshopRoutes);
app.use("/api/workshopRequests", workshopRequestsRoutes);
app.use("/api/documents", documentsRoutes);
app.use("/api/vendor", vendorRoutes);

// ✅ Sports endpoints (courts, availability, reservations, gym sessions)
app.use("/api/sports", sportsRoutes);

app.use("/api/application", eventApplicationRoutes);
app.use("/api/event-registers", eventRegisterRoutes);
app.use("/api/wallets", walletRoutes);
app.use("/api/payments", paymentRoutes);
app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));


// Booths router (compat mounts)
app.use("/api/booths", boothNumberRoutes);
app.use("/api/booth", boothNumberRoutes);
app.use("/api/notifications", notificationsRoutes);
app.use("/api/reports", reportRoutes);
app.use("/api/stripe", stripeWebhookRouter);
app.use("/api/polls", pollRoutes);
app.use("/api/support", supportRoutes);

/* ---------------- 404 & Error Handling ---------------- */
app.use((req, res, _next) => {
  res.status(404).json({ message: "Not found", path: req.originalUrl });
});

// Normalize common DB errors (e.g., invalid ObjectId) to 400
app.use((err, _req, res, _next) => {
  if (err?.name === "CastError") {
    return res.status(400).json({ message: "Invalid id format" });
  }
  console.error("[server] Unhandled error:", err?.stack || err);
  res.status(500).json({ message: err?.message || "Server error" });
});

/* ---------------- DB Connect & Start ---------------- */
/* ------------ DB connect + start ------------ */
(async () => {
  try {
    if (!process.env.MONGO_URI) {
      console.warn("[server] MONGO_URI is not set");
    }
    await mongoose.connect(process.env.MONGO_URI);
    console.log("MongoDB connected");
  } catch (err) {
    console.error("Mongo connection error:", err.message);
  }

  try {
    const mailMod = await import("./src/utils/sendEmail.js");
    if (typeof mailMod.verifySmtp === "function") {
      await mailMod.verifySmtp();
    }
  } catch (err) {
    console.warn("[mail] SMTP verification skipped:", err.message);
  }

  console.log(
    "[server] CORS allowed origins:",
    Array.from(ALLOWED).join(", ") || "(none)"
  );
  const runArchive = async () => {
    try {
      const result = await autoArchiveEvents();
      console.log(
        `[archive] ranAt=${result.ranAt?.toISOString()} events=${result.eventsArchived} gyms=${result.gymArchived}`
      );
    } catch (e) {
      console.warn("[archive] scheduler error:", e?.message);
    }
  };
  await runArchive();
  setInterval(runArchive, 60 * 60 * 1000);

  // #57–58
  startNotificationsScheduler();

  // 🔔 Start Stripe invoice polling (no webhooks, no CLI)
  startStripePaymentPolling();

  app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
})();
export default app;
