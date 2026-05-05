// client/src/app/services/notifications.service.js
import { api } from "@/lib/admin/eventApi";

/** Small helper to unwrap either a fetch Response or a plain JSON object */
async function unwrap(res, fallbackError = "Request failed") {
  // If it's a real Response, parse and check res.ok
  if (res && typeof res.json === "function") {
    const json = await res.json();
    if (!res.ok) throw new Error(json?.message || fallbackError);
    // If your controllers use { status: "success" }, also respect that:
    if (json?.status && json.status !== "success") {
      throw new Error(json?.message || fallbackError);
    }
    return json;
  }
  // Already-parsed object (your api wrapper may do this)
  const json = res;
  if (json?.status && json.status !== "success") {
    throw new Error(json?.message || fallbackError);
  }
  return json;
}

/**
 * Fetch all notifications for the current user.
 * Returns { data: [...] } because useNotifications expects that shape.
 */
export async function getMyNotifications() {
  const res = await api("/notifications", { method: "GET" });
  const json = await unwrap(res, "Failed to load notifications");
  // When controller responds with { status, data }, keep that shape:
  return { data: json?.data ?? (Array.isArray(json) ? json : []) };
}

/** Mark a single notification as read. */
export async function markNotificationRead(id) {
  const res = await api(`/notifications/${id}/read`, { method: "PATCH" });
  return await unwrap(res, "Failed to mark as read");
}

/** Mark all notifications as read. */
export async function markAllNotificationsRead() {
  const res = await api("/notifications/read-all", { method: "PATCH" });
  return await unwrap(res, "Failed to mark all as read");
}

/** Delete a single notification. */
export async function deleteNotification(id) {
  const res = await api(`/notifications/${id}`, { method: "DELETE" });
  return await unwrap(res, "Failed to delete notification");
}

/** Delete all notifications for the current user. */
export async function deleteAllNotifications() {
  const res = await api("/notifications", { method: "DELETE" });
  return await unwrap(res, "Failed to delete all notifications");
}
