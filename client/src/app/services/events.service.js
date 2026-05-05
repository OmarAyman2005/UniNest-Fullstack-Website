"use client";

import { http } from "./http";

/** Normalize an event coming from the API into a UI-friendly shape */
export function mapApiEvent(e) {
  const fmt = (iso) => {
    try { return iso ? new Date(iso).toLocaleString() : "—"; }
    catch { return iso || "—"; }
  };
  return {
    id: e._id,
    vendorId: e.vendorId || "",
    event: e.name || e.title || "—",
    type: (e.eventType || e.type || "").toString(),
    start: fmt(e.startDateTime || e.startsAt),
    end: fmt(e.endDateTime || e.endsAt),
    location: e.location || "—",
    description: e.description || e.shortDescription,
    status: e.status || "Pending",
    participants: e.participants || [],
    boothSize: e.boothSize,
    boothNumber: e.boothNumber,
    boothSetupDurationWeeks: e.setupDurationWeeks || e.boothSetupDurationWeeks,
    boothSetupLocation: e.setupLocation || e.boothSetupLocation,

    // archive awareness
    isArchived: !!e.isArchived,
    archivedAt: e.archivedAt ? fmt(e.archivedAt) : null,

    // allowed roles awareness (for UI)
    allowedRoles: Array.isArray(e.allowedRoles) ? e.allowedRoles : [],
  };
}

/** GET /event (supports filters in query) */
async function listRaw(query = {}) {
  const qp = new URLSearchParams(
    Object.entries(query).filter(([, v]) => v !== undefined && v !== null && v !== "")
  ).toString();
  const url = qp ? `/event?${qp}` : "/event";
  const json = await http.get(url);
  const arr = Array.isArray(json?.data) ? json.data : Array.isArray(json) ? json : [];
  return arr;
}

/** GET /event mapped */
async function list(query = {}) {
  const arr = await listRaw(query);
  return arr.map(mapApiEvent);
}

/** GET /event/:id */
async function getById(id) {
  const json = await http.get(`/event/${id}`);
  return json?.data ?? json;
}

/** POST /event — create an event */
async function create(data) {
  const json = await http.post("/event", data);
  return json?.data ?? json;
}

/** GET /event/:eventId/participants — accepted vendor names for this event */
async function getParticipants(eventId) {
  const json = await http.get(`/event/${eventId}/participants`);
  if (Array.isArray(json?.data)) return json.data;
  if (Array.isArray(json?.items)) return json.items;
  if (Array.isArray(json)) return json;
  return [];
}

/** GET /application/by-booth?eventId=...&boothNumber=... */
async function getBoothReservations(eventId, boothNumber) {
  const qp = new URLSearchParams({ eventId, boothNumber }).toString();
  return http.get(`/application/by-booth?${qp}`).then((json) => json?.data ?? json);
}

/** GET /application?eventId=... — all applications for an event (any status) */
async function getEventApplications(eventId, extra = {}) {
  const qp = new URLSearchParams({ eventId, ...extra }).toString();
  const json = await http.get(`/application?${qp}`);
  if (Array.isArray(json?.data)) return json.data;
  if (Array.isArray(json?.items)) return json.items;
  if (Array.isArray(json)) return json;
  return [];
}

/** POST /event/archive/run — manual trigger */
async function runArchiveNow() {
  return http.post(`/event/archive/run`).then((json) => json);
}

/** PATCH /event/:id/allowed-roles — #50 */
async function setAllowedRoles(eventId, roles = []) {
  return http.patch(`/event/${eventId}/allowed-roles`, { roles }).then((json) => json);
}

export const eventsService = {
  // events
  listRaw,
  list,
  getById,
  create,

  // event-related extras
  getParticipants,

  // booth/application helpers tied to events
  getBoothReservations,
  getEventApplications,

  // archive
  runArchiveNow,

  // restrict registration roles
  setAllowedRoles,
};
