// server/src/utils/archiveEvents.js
import { Event } from '../models/Event.js';

function parseHHMM(s) {
  // "HH:mm" -> {h, m}
  if (!s || typeof s !== 'string') return { h: 0, m: 0 };
  const [h, m] = s.split(':').map(n => parseInt(n, 10));
  return { h: Number.isFinite(h) ? h : 0, m: Number.isFinite(m) ? m : 0 };
}

function gymEndAsDateUTC(dateOnly, endTime) {
  // dateOnly is stored at 00:00:00.000Z
  const d = new Date(dateOnly);
  const { h, m } = parseHHMM(endTime);
  // Because we store date at midnight Z, use setUTCHours to stay consistent
  d.setUTCHours(h, m || 0, 0, 0);
  return d;
}

/**
 * Archives:
 *  1) Any Event with endDateTime < now && !isArchived
 *  2) Any GymSession whose (date + endTime) < now && !isArchived
 *
 * This is safe to run repeatedly (idempotent).
 */
export async function autoArchiveEvents() {
  const now = new Date();

  // (1) Events
  const eventRes = await Event.updateMany(
    { isArchived: { $ne: true }, endDateTime: { $lt: now } },
    { $set: { isArchived: true, archivedAt: now, archiveReason: 'auto' } }
  );

  // (2) Gym Sessions (optional best-effort; skip if model missing)
  let gymArchived = 0;
  try {
    const mod = await import('../models/GymSession.js');
    const GymSession = mod.default || mod.GymSession || null;
    if (GymSession) {
      const open = await GymSession.find({ isArchived: { $ne: true } })
        .select('_id date endTime');
      const ids = [];
      for (const s of open) {
        const endDate = gymEndAsDateUTC(s.date, s.endTime);
        if (endDate < now) ids.push(s._id);
      }
      if (ids.length) {
        const res = await GymSession.updateMany(
          { _id: { $in: ids } },
          { $set: { isArchived: true, archivedAt: now, archiveReason: 'auto' } }
        );
        gymArchived = res.modifiedCount || 0;
      }
    }
  } catch (e) {
    // Do not crash scheduler if gym module is absent
    console.warn('[archive] GymSession archiver skipped:', e?.message);
  }

  return {
    eventsArchived: eventRes.modifiedCount || 0,
    gymArchived,
    ranAt: now
  };
}

/** Manual trigger (for an admin button/endpoint) */
export async function runArchiveNow(req, res) {
  try {
    const result = await autoArchiveEvents();
    return res.status(200).json({ status: 'success', ...result });
  } catch (err) {
    console.error('[archive] runArchiveNow error:', err);
    return res.status(500).json({ status: 'error', message: err?.message || 'Failed to run archiver' });
  }
}
