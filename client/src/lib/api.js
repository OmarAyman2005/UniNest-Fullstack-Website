/**
 * Tiny fetch wrapper used across the app.
 * ...
 */

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/+$/, "") ||
  "http://localhost:5000/api";

const LOCAL_FALLBACK_BASE =
  (typeof window !== "undefined" &&
    !/^https?:\/\//i.test(API_BASE) &&
    (window.location.hostname === "localhost" ||
      window.location.hostname === "127.0.0.1"))
    ? `http://localhost:${(typeof process !== "undefined" &&
      process.env &&
      process.env.NEXT_PUBLIC_API_PORT) || 5000}`
    : null;

function toUrl(path, base = API_BASE) {
  const p = String(path || "");
  // NEW: if caller passed an absolute URL, use it as-is
  if (/^https?:\/\//i.test(p)) return p;
  return `${base}${p.startsWith("/") ? "" : "/"}${p}`;
}


async function safeJson(res) {
  try { return await res.json(); } catch { return null; }
}

export async function api(path, { method = "GET", body, headers } = {}) {
  const isFormData = typeof FormData !== "undefined" && body instanceof FormData;
  const requestInit = {
    method,
    credentials: "include",
    mode: "cors",
    headers: {
      ...(isFormData ? {} : { "Content-Type": "application/json" }),
      Accept: "application/json",
      ...(headers || {}),
    },
    body: body ? (isFormData ? body : JSON.stringify(body)) : undefined,
  };

  let res, data;
  try {
    res = await fetch(toUrl(path), requestInit);
  } catch (e) {
    if (LOCAL_FALLBACK_BASE) {
      try { res = await fetch(toUrl(path, LOCAL_FALLBACK_BASE), requestInit); }
      catch { throw e; }
    } else { throw e; }
  }

  data = await safeJson(res);
  if (!res.ok) {
    const message = (data && (data.message || data.error)) || `Request failed (${res.status})`;
    const err = new Error(message);
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data ?? {};
}

export const get   = (path, opts) => api(path, { ...(opts || {}), method: "GET" });
export const del   = (path, opts) => api(path, { ...(opts || {}), method: "DELETE" });
export const post  = (path, body, opts) => api(path, { ...(opts || {}), method: "POST", body });
export const patch = (path, body, opts) => api(path, { ...(opts || {}), method: "PATCH", body });

export const sportsBase      = `${API_BASE}/sports`;
export const gymSessionsUrl  = `${sportsBase}/gym/sessions`;
export const gymReserveUrl = (id) => `${gymSessionsUrl}/${encodeURIComponent(id)}/reserve`;
export const reserveGymSession = (id) => post(gymReserveUrl(id));
export const cancelGymSession = (id) => del(gymReserveUrl(id));
// ---- Courts reservations (existing)
export const reservationsUrl = `${sportsBase}/reservations`;
export const fetchReservations      = (courtId, date) => get(`${reservationsUrl}?courtId=${encodeURIComponent(courtId)}&date=${encodeURIComponent(date)}`);
export const createSlotReservation  = (payload) => post(reservationsUrl, payload);
export const cancelSlotReservation  = (payload) => del(reservationsUrl, { body: payload });

// ---- NEW: gym reservations
export const gymReservationsUrl = `${sportsBase}/gym/reservations`;
export const reserveGym     = (sessionId) => post(gymReservationsUrl, { sessionId });
export const cancelGym      = (sessionId) => del(gymReservationsUrl, { body: { sessionId } });

// ---- App logout helper
export async function appLogout(router, { redirectTo = "/welcome?loggedout=1" } = {}) {
  try { await post("/auth/logout"); } catch {}
  try { localStorage.setItem("__logout_broadcast__", String(Date.now())); } catch {}
  if (router?.push) router.push(redirectTo);
  else if (typeof window !== "undefined") window.location.assign(redirectTo);
}
