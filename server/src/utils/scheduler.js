// server/src/utils/scheduler.js
import { Event } from "../models/Event.js";
import { EventRegister } from "../models/EventRegister.js";
import { Notification } from "../models/Notification.js";
import { pushNotification } from "../controllers/notifications.controller.js";

const WINDOW_MIN = Number(process.env.REMINDER_WINDOW_MIN || 5);
const REGISTERED_STATUSES = ["registered", "approved", "accepted"];
const DEBUG_REMINDERS = process.env.DEBUG_REMINDERS === "1";

/* ---------------------------- small helpers ---------------------------- */

/** Check if 'now' is within a window around 'target' */
function between(now, target, windowMinutes) {
  const w = windowMinutes * 60 * 1000;
  const diff = Math.abs(now.getTime() - target.getTime());
  return diff <= w;
}

/** Check if 'now' is past 'target' but before 'until' */
function isPastButBefore(now, target, until) {
  return now >= target && now < until;
}

/** Floor a Date to the nearest minute (kill seconds/millis). */
function floorToMinute(dt) {
  const ms = dt.getTime();
  return new Date(Math.floor(ms / 60000) * 60000);
}

// Lazy import to avoid circular deps
async function getEventApplicationsModel() {
  try {
    const mod = await import("../models/EventApplication.js");
    return mod?.EventApplication || mod?.default || null;
  } catch (err) {
    if (DEBUG_REMINDERS) {
      console.log("[reminders] EventApplication model not available:", err.message);
    }
    return null;
  }
}

/** Collect unique userIds that should receive reminders for an event. */
async function collectRegisteredUserIds(eventId) {
  const ids = new Set();

  try {
    // 1) Direct registrations
    const regs = await EventRegister.find({
      event: eventId,
      status: { $in: REGISTERED_STATUSES },
    })
      .select("user")
      .lean();

    for (const r of regs || []) {
      if (r?.user) ids.add(String(r.user));
    }

    // 2) Applications implying attendance
    const EventApplication = await getEventApplicationsModel();
    if (EventApplication) {
      const apps = await EventApplication.find({
        eventId,
        status: { $in: REGISTERED_STATUSES },
      })
        .select("userId participants")
        .lean();

      for (const a of apps || []) {
        if (a?.userId) ids.add(String(a.userId));
        const ps = Array.isArray(a?.participants) ? a.participants : [];
        for (const p of ps) {
          if (p?.userId) ids.add(String(p.userId));
        }
      }
    }
  } catch (err) {
    console.error("[reminders] Error collecting registered users:", err.message);
  }

  return Array.from(ids);
}

/* ------------------------- core reminder job -------------------------- */
/**
 * Core reminder job. Exported so controllers can trigger it (run-once).
 * Returns a small summary { eventsChecked, notifications }.
 */
export async function sendTimeWindowReminders(now = new Date()) {
  // Normalize "now" down to minute
  now = floorToMinute(now);

  if (DEBUG_REMINDERS) {
    console.log(
      `[reminders] tick now=${now.toISOString()} window=±${WINDOW_MIN}m`
    );
  }

  // candidates within next ~26 hours to reduce DB size
  const upper = new Date(now.getTime() + 1000 * 60 * 60 * 26);
  const events = await Event.find({
    startDateTime: { $lte: upper },
    isArchived: { $ne: true },
  }).lean();

  if (!events.length) {
    if (DEBUG_REMINDERS) console.log("[reminders] no candidate events");
    return { eventsChecked: 0, notifications: 0 };
  }

  let notifCount = 0;

  for (const ev of events) {
    if (!ev?.startDateTime) continue;

    // Normalize start to the minute
    const start = floorToMinute(new Date(ev.startDateTime));
    
    // Calculate target notification times
    const t24h = new Date(start.getTime() - 24 * 60 * 60 * 1000); // 24 hours before
    const t1h = new Date(start.getTime() - 1 * 60 * 60 * 1000);   // 1 hour before

    // Skip if event has already started
    if (now >= start) {
      if (DEBUG_REMINDERS) {
        console.log(`[reminders] skip "${ev.name}": already started`);
      }
      continue;
    }

    // Check if we're in the notification window for each time
    const in24hWindow = between(now, t24h, WINDOW_MIN);
    const in1hWindow = between(now, t1h, WINDOW_MIN);
    
    // Check if we're past the notification time (catch-up logic)
    const past24h = isPastButBefore(now, t24h, t1h);
    const past1h = isPastButBefore(now, t1h, start);

    if (DEBUG_REMINDERS) {
      console.log(
        `[reminders] event="${ev.name}" start=${start.toISOString()}\n` +
        `  t24h=${t24h.toISOString()} in24hWindow=${in24hWindow} past24h=${past24h}\n` +
        `  t1h=${t1h.toISOString()} in1hWindow=${in1hWindow} past1h=${past1h}`
      );
    }

    // Determine if we should send notifications
    const should24h = in24hWindow || past24h;
    const should1h = in1hWindow || past1h;

    if (!should24h && !should1h) {
      if (DEBUG_REMINDERS) {
        console.log(`[reminders] skip "${ev.name}": not in any notification window`);
      }
      continue;
    }

    // Get registered users
    const userIds = await collectRegisteredUserIds(ev._id);
    if (!userIds.length) {
      if (DEBUG_REMINDERS) {
        console.log(`[reminders] skip "${ev.name}": no registered users`);
      }
      continue;
    }

    // Check which notifications have already been sent
    const existing = await Notification.find({
      user: { $in: userIds },
      "meta.eventId": String(ev._id),
      "meta.kind": { $in: ["t-1h", "t-24h"] },
    })
      .select("user meta.kind")
      .lean();

    const sent1h = new Set(
      existing.filter(n => n.meta?.kind === "t-1h").map(n => String(n.user))
    );
    const sent24h = new Set(
      existing.filter(n => n.meta?.kind === "t-24h").map(n => String(n.user))
    );

    // Send 1-hour reminders (priority)
    if (should1h) {
      const targets = userIds.filter(u => !sent1h.has(String(u)));
      if (targets.length) {
        if (DEBUG_REMINDERS) {
          console.log(`[reminders] sending t-1h for "${ev.name}" to ${targets.length} users`);
        }

        for (const userId of targets) {
          try {
            await pushNotification({
              user: userId,
              title: `Reminder: ${ev.name} starts soon`,
              body: `${ev.eventType || 'Event'} starts in 1 hour.`,
              meta: {
                eventId: String(ev._id),
                kind: "t-1h",
                startAt: ev.startDateTime,
                startAtTs: new Date(ev.startDateTime).getTime(),
                location: ev.location ?? "",
              },
            });
            notifCount += 1;
          } catch (err) {
            // Skip duplicate key errors
            if (!String(err?.message || "").includes("E11000")) {
              console.error(`[reminders] Error sending t-1h notification:`, err.message);
            }
          }
        }
      }
    }

    // Send 24-hour reminders (only if NOT in 1h window to avoid spam)
    if (should24h && !should1h) {
      const targets = userIds.filter(u => !sent24h.has(String(u)));
      if (targets.length) {
        if (DEBUG_REMINDERS) {
          console.log(`[reminders] sending t-24h for "${ev.name}" to ${targets.length} users`);
        }

        for (const userId of targets) {
          try {
            await pushNotification({
              user: userId,
              title: `Reminder: ${ev.name} is tomorrow`,
              body: `${ev.eventType || 'Event'} starts in 24 hours.`,
              meta: {
                eventId: String(ev._id),
                kind: "t-24h",
                startAt: ev.startDateTime,
                startAtTs: new Date(ev.startDateTime).getTime(),
                location: ev.location ?? "",
              },
            });
            notifCount += 1;
          } catch (err) {
            if (!String(err?.message || "").includes("E11000")) {
              console.error(`[reminders] Error sending t-24h notification:`, err.message);
            }
          }
        }
      }
    }
  }

  if (DEBUG_REMINDERS) {
    console.log(
      `[reminders] summary: eventsChecked=${events.length} notifications=${notifCount}`
    );
  }
  return { eventsChecked: events.length, notifications: notifCount };
}

/* ----------------------- explain (debug) endpoint ---------------------- */
export async function explainReminderStatus(eventId, now = new Date()) {
  now = floorToMinute(now);
  const ev = await Event.findById(eventId).lean();
  if (!ev) return { ok: false, reason: "event_not_found" };

  const start = floorToMinute(new Date(ev.startDateTime));
  const t24h = new Date(start.getTime() - 24 * 60 * 60 * 1000);
  const t1h = new Date(start.getTime() - 60 * 60 * 1000);

  const in24hWindow = between(now, t24h, WINDOW_MIN);
  const in1hWindow = between(now, t1h, WINDOW_MIN);
  const past24h = isPastButBefore(now, t24h, t1h);
  const past1h = isPastButBefore(now, t1h, start);

  const should24h = in24hWindow || past24h;
  const should1h = in1hWindow || past1h;

  const userIds = await collectRegisteredUserIds(ev._id);

  const existing = await Notification.find({
    user: { $in: userIds },
    "meta.eventId": String(ev._id),
    "meta.kind": { $in: ["t-1h", "t-24h"] },
  })
    .select("user meta.kind")
    .lean();

  const sent1h = new Set(
    existing.filter(n => n.meta?.kind === "t-1h").map(n => String(n.user))
  );
  const sent24h = new Set(
    existing.filter(n => n.meta?.kind === "t-24h").map(n => String(n.user))
  );

  const candidates1h = should1h ? userIds.filter(u => !sent1h.has(String(u))) : [];
  const candidates24h = (should24h && !should1h) ? userIds.filter(u => !sent24h.has(String(u))) : [];

  return {
    ok: true,
    windowMin: WINDOW_MIN,
    now: now.toISOString(),
    event: {
      id: String(ev._id),
      name: ev.name,
      startDateTime: start.toISOString(),
      location: ev.location ?? "",
    },
    windows: {
      t24h: t24h.toISOString(),
      t1h: t1h.toISOString(),
      start: start.toISOString(),
    },
    flags: {
      in24hWindow,
      in1hWindow,
      past24h,
      past1h,
      should24h,
      should1h,
    },
    counts: {
      registered: userIds.length,
      alreadySent_t1h: sent1h.size,
      alreadySent_t24h: sent24h.size,
      wouldSend_t1h: candidates1h.length,
      wouldSend_t24h: candidates24h.length,
    },
    samples: {
      candidates_t1h: candidates1h.slice(0, 10),
      candidates_t24h: candidates24h.slice(0, 10),
    },
  };
}

/* ---------------------------- scheduler loop --------------------------- */
export function startNotificationsScheduler() {
  // Run immediately on startup
  sendTimeWindowReminders().catch((err) => {
    console.error("[reminders] Initial run error:", err?.message);
  });

  // Then run every WINDOW_MIN minutes
  setInterval(() => {
    sendTimeWindowReminders().catch((err) => {
      console.error("[reminders] Scheduler error:", err?.message);
    });
  }, WINDOW_MIN * 60 * 1000);

  console.log(`[reminders] Scheduler started, interval=${WINDOW_MIN} minutes`);
}

/* ----------------- "new event" broadcast (unchanged) ------------------ */
export async function notifyNewEventToRoles(
  ev,
  roles = ["student", "staff", "ta", "professor", "event_office"]
) {
  if (!ev?._id) return { sent: 0 };

  const mod = await import("../models/User.js");
  const User = mod?.User || mod?.default || mod?.default?.User || null;

  if (!User || typeof User.find !== "function") {
    console.warn("[notifyNewEventToRoles] User model not resolved");
    return { sent: 0 };
  }

  const targetRoles = roles.map((r) => String(r).toLowerCase());

  let users = await User.find({ role: { $in: targetRoles } })
    .select("_id role")
    .lean();

  if (!users?.length) {
    const all = await User.find({}).select("_id role").lean();
    const set = new Set(targetRoles);
    users = all.filter((u) => set.has(String(u.role).toLowerCase()));
  }

  const ids = (users || []).map((u) => u._id);
  console.log(
    `[notifyNewEventToRoles] recipients=${ids.length} for event="${ev?.name ?? ev?._id}"`
  );

  let sent = 0;
  for (const u of ids) {
    try {
      await pushNotification({
        user: u,
        title: `New event: ${ev.name}`,
        body: `${ev.eventType || 'Event'} has been created.`,
        meta: {
          eventId: String(ev._id),
          kind: "new",
          startAt: ev.startDateTime,
          startAtTs: new Date(ev.startDateTime).getTime(),
          location: ev.location ?? "",
        },
      });
      sent += 1;
    } catch (e) {
      if (!String(e?.message || "").includes("E11000")) {
        console.warn("[notifyNewEventToRoles] Push error:", e?.message);
      }
    }
  }
  return { sent };
}