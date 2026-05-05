// /services/auth.service.js
import { http } from "./http";

/** Always include cookies for cross-origin requests to the API */
const withCreds = (init) => ({ credentials: "include", ...init });

export const authService = {
  /**
   * Register a new user
   * payload: { fullName, email, password, role, studentId?, staffId? }
   * returns server JSON (message, flags)
   */
  async register(payload) {
    return http.post("/api/auth/register", payload, withCreds());
  },

  /**
   * Login (sets HttpOnly cookie on success)
   * payload: { email, password }
   * returns { message, user: { id, fullName, role, ... } }
   */
  async login(payload) {
    return http.post("/api/auth/login", payload, withCreds());
  },

  /**
   * Logout (clears cookie)
   * returns { message }
   */
  async logout() {
    return http.post("/api/auth/logout", null, withCreds());
  },

  /**
   * Who am I? (requires cookie)
   * returns { ok: true, user: {...} }
   */
  async me() {
    return http.get("/api/auth/me", withCreds());
  },

  /**
   * Verify email via token (usually linked from email)
   * returns { message: 'Email verified' } or 4xx
   */
  async verifyEmail(token) {
    const qs = new URLSearchParams({ token }).toString();
    return http.get(`/api/auth/verify?${qs}`, withCreds());
  },
};

export default authService;
