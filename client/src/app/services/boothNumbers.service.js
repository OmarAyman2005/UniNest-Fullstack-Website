// /services/boothNumber.service.js
import { http } from "./http";

/**
 * Client for Booth Numbers & Reservations
 * Server routes:
 *   GET    /api/booths
 *   POST   /api/booths/reserve
 *   GET    /api/booths/:id
 *   POST   /api/booths
 *   POST   /api/booths/bulk
 *   PATCH  /api/booths/:id
 *   DELETE /api/booths/:id
 *
 * NOTE: Do NOT prefix with /api here because API_BASE already ends with /api.
 */

function withQuery(base, query = {}) {
  const q = new URLSearchParams();
  Object.entries(query).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== "") q.append(k, v);
  });
  return q.toString() ? `${base}?${q.toString()}` : base;
}

export const boothNumberService = {
  /** List booths */
  async list(query = {}) {
    const url = withQuery("/booths", query);                 // <-- no /api
    const json = await http.get(url);
    return Array.isArray(json?.data) ? json.data : Array.isArray(json) ? json : [];
  },

  /** Reserve a booth (atomically creates EventApplication on server) */
  async reserve(payload) {
    const body = {
      ...payload,
      boothNumber: String(payload.boothNumber || "").toUpperCase().trim(),
    };
    const json = await http.post("/booths/reserve", body);   // <-- no /api
    return json?.data ?? json;
  },

  /** Get single booth by id */
  async getById(id) {
    const json = await http.get(`/booths/${id}`);            // <-- no /api
    return json?.data ?? json;
  },

  /** Create a booth (admin) */
  async create(payload) {
    const body = {
      ...payload,
      boothNumber: String(payload.boothNumber || "").toUpperCase().trim(),
    };
    const json = await http.post("/booths", body);           // <-- no /api
    return json?.data ?? json;
  },

  /** Bulk create booths (admin) */
  async bulkCreate(payload) {
    const body = {
      ...payload,
      boothNumbers: (payload.boothNumbers || []).map((b) => String(b).toUpperCase().trim()),
    };
    return http.post("/booths/bulk", body);                  // <-- no /api
  },

  /** Update booth (admin) */
  async update(id, payload) {
    const body = { ...payload };
    if (body.boothNumber) body.boothNumber = String(body.boothNumber).toUpperCase().trim();
    const json = await http.patch(`/booths/${id}`, body);    // <-- no /api
    return json?.data ?? json;
  },

  /** Delete booth (admin) — fails if reserved */
  async remove(id) {
    return http.del(`/booths/${id}`);                        // <-- no /api
  },
};

export default boothNumberService;
