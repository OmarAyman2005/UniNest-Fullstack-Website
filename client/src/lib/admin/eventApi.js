// client/src/lib/admin/eventApi.js
const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api";

/** Low-level fetch that returns {res, json} and never throws by itself */
async function fetchJson(path, opts = {}) {
  const hasBody = opts.body !== undefined && opts.body !== null;

  const res = await fetch(`${API}${path}`, {
    method: opts.method || "GET",
    credentials: "include",
    // ❗ Do NOT set Content-Type unless we actually send a body
    headers: {
      ...(opts.headers || {}),
      ...(hasBody ? { "Content-Type": "application/json" } : {}),
    },
    body: hasBody ? JSON.stringify(opts.body) : undefined,
  });

  const text = await res.text();
  let json = {};
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    json = {};
  }
  return { res, json };
}

/** High level wrapper (compat with your older calls) */
export async function api(path, { method = "GET", body, headers = {} } = {}) {
  const { res, json } = await fetchJson(path, { method, body, headers });
  if (!res.ok) {
    const detail = json?.message || json?.errors?.[0]?.msg || `HTTP ${res.status}`;
    throw new Error(detail);
  }
  return json;
}

/* ---------- Event CRUD (existing) ---------- */
export const getAllBazaars = () => api("/bazaar");
export const getBazaarById = (id) => api(`/bazaar/${id}`);
export const createBazaar = (data) => api("/bazaar", { method: "POST", body: data });
export const updateBazaar = (id, data) => api(`/bazaar/${id}`, { method: "PUT", body: data });
export const deleteBazaar = (id) => api(`/event/${id}`, { method: "DELETE" });

export const getAllConferences = () => api("/conference");
export const getConferenceById = (id) => api(`/conference/${id}`);
export const createConference = (data) => api("/conference", { method: "POST", body: data });
export const updateConference = (id, data) => api(`/conference/${id}`, { method: "PUT", body: data });
export const deleteConference = (id) => api(`/event/${id}`, { method: "DELETE" });

export const getAllTrips = () => api("/trip");
export const getTripById = (id) => api(`/trip/${id}`);
export const createTrip = (data) => api("/trip", { method: "POST", body: data });
export const updateTrip = (id, data) => api(`/trip/${id}`, { method: "PUT", body: data });
export const deleteTrip = (id) => api(`/event/${id}`, { method: "DELETE" });

export const getAllWorkshops = () => api("/workshop");
export const getWorkshopById = (id) => api(`/workshop/${id}`);
export const createWorkshop = (data) => api("/workshop", { method: "POST", body: data });
export const updateWorkshop = (id, data) => api(`/workshop/${id}`, { method: "PUT", body: data });
export const deleteWorkshop = (id) => api(`/event/${id}`, { method: "DELETE" });

/* ---------- Access helpers ---------- */
export async function getEventById(id) {
  const { res, json } = await fetchJson(`/event/${id}`);
  if (!res.ok) throw new Error(json?.message || `HTTP ${res.status}`);
  return json?.data ?? json;
}

export async function getEventAccess(id) {
  const { res, json } = await fetchJson(`/event/${id}/access`);
  if (res.status === 404) {
    return { from: "defaults", data: { allowedRoles: [], externalVisitorsEnabled: false } };
  }
  if (!res.ok) throw new Error(json?.message || `HTTP ${res.status}`);
  return { from: "server", data: json?.data ?? json };
}

export async function updateEventAccess(id, payload) {
  const { res, json } = await fetchJson(`/event/${id}/access`, {
    method: "PUT",
    body: payload,
  });
  if (!res.ok) throw new Error(json?.message || `HTTP ${res.status}`);
  return json;
}

/* ---------- Reports ---------- */
function toQuery(obj = {}) {
  const p = new URLSearchParams();
  Object.entries(obj).forEach(([k, v]) => {
    if (v === undefined || v === null || v === "") return;
    p.set(k, String(v));
  });
  const s = p.toString();
  return s ? `?${s}` : "";
}

export async function getAttendeesReport({ name, eventType, from, to } = {}) {
  const q = toQuery({ name, eventType, from, to });
  const { res, json } = await fetchJson(`/report/attendees${q}`);
  if (!res.ok) throw new Error(json?.message || `HTTP ${res.status}`);
  return json?.data ?? json;
}

export async function getSalesReport({ name, eventType, from, to, sort } = {}) {
  const q = toQuery({ name, eventType, from, to, sort });
  const { res, json } = await fetchJson(`/report/sales${q}`);
  if (!res.ok) throw new Error(json?.message || `HTTP ${res.status}`);
  return json?.data ?? json;
}
// --- Reports -------------------------------------------------
export const fetchReportsSummary = (q) =>
  api(`/reports/summary?${new URLSearchParams(q).toString()}`);

export const fetchReportsAttendees = (q) =>
  api(`/reports/attendees?${new URLSearchParams(q).toString()}`);

export const fetchReportsSales = (q) =>
  api(`/reports/sales?${new URLSearchParams(q).toString()}`);
