// app/services/public.service.js
import { http } from "./http";

function withQuery(base, query = {}) {
  const q = new URLSearchParams();
  Object.entries(query || {}).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== "") q.append(k, v);
  });
  const qs = q.toString();
  return qs ? `${base}?${qs}` : base;
}

export const publicService = {
  // GET /api/public/professors
  getProfessors: async (query) => {
    const json = await http.get(withQuery("/public/professors", query));
    return Array.isArray(json?.data) ? json.data : json?.data ?? [];
  },

  // GET /api/public/professors/:id
  // - Returns null when the user is missing or not a professor (404 upstream)
  getProfessorById: async (id) => {
    try {
      const json = await http.get(`/public/professors/${id}`);
      return json?.data ?? null;
    } catch {
      return null;
    }
  },
};
