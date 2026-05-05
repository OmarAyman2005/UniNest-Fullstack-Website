"use client";
import { useEffect, useState, useCallback } from "react";
import {
  getMyNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  deleteNotification,
  deleteAllNotifications,
} from "../app/services/notifications.service.js";

export function useNotifications(pollMs = 30000) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await getMyNotifications();
      setItems(Array.isArray(data) ? data : []);
    } finally {
      setLoading(false);
    }
  }, []);

  const markRead = useCallback(async (id) => {
    await markNotificationRead(id);
    setItems((prev) =>
      prev.map((n) => (n._id === id ? { ...n, read: true } : n))
    );
  }, []);

  const markAll = useCallback(async () => {
    await markAllNotificationsRead();
    setItems((prev) => prev.map((n) => ({ ...n, read: true })));
  }, []);

  const delOne = useCallback(async (id) => {
    await deleteNotification(id);
    setItems((prev) => prev.filter((n) => n._id !== id));
  }, []);

  const delAll = useCallback(async () => {
    await deleteAllNotifications();
    setItems([]);
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, pollMs);
    return () => clearInterval(t);
  }, [load, pollMs]);

  const unread = items.filter((n) => !n.read).length;

  return { items, unread, loading, reload: load, markRead, markAll, delOne, delAll };
}
