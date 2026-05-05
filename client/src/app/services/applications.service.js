// /services/applications.service.js
import { http } from "./http";

function withQuery(base, query = {}) {
  const q = new URLSearchParams();
  Object.entries(query).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== "") q.append(k, v);
  });
  return q.toString() ? `${base}?${q.toString()}` : base;
}

/**
 * Resolve a reliable absolute API base.
 * Order:
 * 1) http helper hints (if your http wrapper already points to backend)
 * 2) NEXT_PUBLIC_API_BASE
 * 3) Fallback to http://localhost:5000/api  (your backend port)
 */
const RESOLVED_API_BASE = (() => {
  const fromHttp =
    (http && (http.baseURL || http.baseUrl || http.origin)) || "";
  const fromEnv =
    (typeof process !== "undefined" && process.env?.NEXT_PUBLIC_API_BASE) || "";
  const fallback = "http://localhost:5000/api";
  const base = (fromHttp || fromEnv || fallback).replace(/\/$/, "");
  return base;
})();

export const applicationsService = {
  // ===== CRUD =====

  // GET /api/application
  list: async (query = {}) => {
    const q = { ...query };
    if (q.eventType === undefined || q.eventType === null || q.eventType === "") {
      q.eventType = "booth,bazaar";
    }
    const json = await http.get(withQuery("/application", q));
    return Array.isArray(json?.data) ? json.data : [];
  },

  listLoyaltyProgram: async (query = {}) => {
    const q = { ...query, applicationKind: "loyaltyProgram" };
    const json = await http.get(withQuery("/application", q));
    return Array.isArray(json?.data) ? json.data : [];
  },

  // GET /api/application?userId=...
  listByUser: async (userId, extraFilters = {}) => {
    const query = { userId, ...extraFilters };
    const json = await http.get(withQuery("/application", query));
    return Array.isArray(json?.data) ? json.data : [];
  },

  // GET /api/application/:id
  getById: async (id) => {
    const json = await http.get(`/application/${id}`);
    return json?.data ?? json;
  },

  // POST /api/application
  create: async (payload) => {
    const json = await http.post("/application", payload);
    return json?.data ?? json;
  },

  // PATCH /api/application/:id
  update: async (id, payload) => {
    const json = await http.patch(`/application/${id}`, payload);
    return json?.data ?? json;
  },

  // DELETE /api/application/:id
  remove: async (id) => {
    return http.del(`/application/${id}`);
  },

  // ===== Status transitions =====

  // POST /api/application/:id/accept
  accept: async (id, reason) => {
    const body = reason ? { reason } : {};
    const json = await http.post(`/application/${id}/accept`, body);
    return json?.data ?? json;
  },

  // POST /api/application/:id/reject
  reject: async (id, reason) => {
    const body = reason ? { reason } : {};
    const json = await http.post(`/application/${id}/reject`, body);
    return json?.data ?? json;
  },

  // POST /api/application/:id/cancel
  cancel: async (id, reason) => {
    const body = reason ? { reason } : {};
    const json = await http.post(`/application/${id}/cancel`, body);
    return json?.data ?? json;
  },

  // POST /api/application/:id/cancel
  cancelEvent: async (id, reason) => {
    const body = reason ? { reason } : {};
    const json = await http.post(`/application/${id}/cancelEvent`, body);
    return json?.data ?? json;
  },

  // 👉 POST /api/application/loyalty
  createLoyalty: async ({
    userId,
    eventId,
    discountRate,
    promoCode,
    terms,
    participants = [],
    applicationKind = "loyaltyProgram", // 🔹 default from service
  }) => {
    const body = {
      userId,
      eventId,
      participants,
      applicationKind, // 🔹 Joi schema expects this
      loyalty: {
        discountRate: Number(discountRate),
        promoCode: String(promoCode).trim(),
        terms: String(terms).trim(),
      },
    };

    const json = await http.post("/application/loyalty", body);
    return json?.data ?? json;
  },

  // ===== Booth lookups =====

  // GET /api/application/by-booth?eventId=...&boothNumber=...
  byBooth: async (eventId, boothNumber) => {
    const json = await http.get(
      withQuery("/application/by-booth", { eventId, boothNumber })
    );
    // { status, count, data: { applications, boothLinkedApplications, reservations, booth } }
    return json;
  },

  // ===== ID uploads (multipart) =====

  /**
   * Upload a single ID file (image/PDF) for a participant.
   * Tries singular then plural route bases:
   *   POST {API_BASE}/application/:id/participants/:index/id
   *   POST {API_BASE}/applications/:id/participants/:index/id
   */
  uploadParticipantId: async (applicationId, participantIndex, fileOrFormData) => {
    // Build a FormData if a raw File/Blob is passed
    let body = fileOrFormData;
    if (typeof FormData !== "undefined" && !(fileOrFormData instanceof FormData)) {
      const fd = new FormData();
      fd.append("file", fileOrFormData);
      body = fd;
    }

    // Try singular first
    const singularUrl = `${RESOLVED_API_BASE}/application/${applicationId}/participants/${participantIndex}/id`;
    let res = await fetch(singularUrl, {
      method: "POST",
      body,
      credentials: "include",
    });

    // If singular 404s, try plural
    if (res.status === 404) {
      const pluralUrl = `${RESOLVED_API_BASE}/applications/${applicationId}/participants/${participantIndex}/id`;
      res = await fetch(pluralUrl, {
        method: "POST",
        body,
        credentials: "include",
      });
    }

    if (!res.ok) {
      const msg = await res.text().catch(() => "");
      const err = new Error(msg || `Upload failed (${res.status})`);
      err.status = res.status;
      throw err;
    }
    return res.json(); // { status, data }
  },

  /**
   * Optional: attach already-hosted file metadata (no upload).
   * PATCH {API_BASE}/application/:id/participants/:index/id/meta
   *        or /applications/...
   */
  attachParticipantIdMeta: async (applicationId, participantIndex, fileMeta) => {
    // Attempt singular path via http wrapper (it will prepend whatever base it uses)
    try {
      const json = await http.patch(
        `/application/${applicationId}/participants/${participantIndex}/id/meta`,
        { file: fileMeta }
      );
      return json?.data ?? json;
    } catch (e) {
      // If your backend is mounted as /api/applications, fallback to plural
      const url = `${RESOLVED_API_BASE}/applications/${applicationId}/participants/${participantIndex}/id/meta`;
      const res = await fetch(url, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ file: fileMeta }),
      });
      if (!res.ok) {
        const msg = await res.text().catch(() => "");
        const err = new Error(msg || `Attach meta failed (${res.status})`);
        err.status = res.status;
        throw err;
      }
      const json = await res.json();
      return json?.data ?? json;
    }
  },
};
