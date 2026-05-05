"use client";
import { useEffect, useRef, useState, useCallback } from "react";
import { FaBell } from "react-icons/fa";
import { formatLocalTime } from "@/lib/dateFormatter";
import { useNotifications } from "@/hooks/useNotifications";

export default function NotificationsBell() {
  const [open, setOpen] = useState(false);
  const [err, setErr] = useState("");
  const { items, unread, loading, reload, markRead, delOne, markAll, delAll } =
    useNotifications(30000); // poll each 30s

  const panelRef = useRef(null);
  const btnRef = useRef(null);

  const toggle = useCallback(() => setOpen((o) => !o), []);
  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    function onDocClick(e) {
      if (!open) return;
      const p = panelRef.current;
      const b = btnRef.current;
      if (p && p.contains(e.target)) return;
      if (b && b.contains(e.target)) return;
      close();
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [open, close]);

  const safeMarkAll = useCallback(async () => {
    setErr("");
    try {
      if (typeof markAll === "function") {
        await markAll();
      } else {
        const unreadItems = items.filter((n) => !n.read);
        await Promise.allSettled(unreadItems.map((n) => markRead(n._id)));
      }
      await reload();
    } catch (e) {
      setErr(e?.message || "Failed to mark all as read");
    }
  }, [items, markAll, markRead, reload]);

  const safeDeleteAll = useCallback(async () => {
    setErr("");
    try {
      if (typeof delAll === "function") {
        await delAll();
      } else {
        await Promise.allSettled(items.map((n) => delOne(n._id)));
      }
      await reload();
    } catch (e) {
      setErr(e?.message || "Failed to delete all");
    }
  }, [items, delAll, delOne, reload]);

  const onRead = useCallback(
    async (id) => {
      setErr("");
      try {
        await markRead(id);
        await reload();
      } catch (e) {
        setErr(e?.message || "Failed to mark as read");
      }
    },
    [markRead, reload]
  );

  const onDelete = useCallback(
    async (id) => {
      setErr("");
      try {
        await delOne(id);
        await reload();
      } catch (e) {
        setErr(e?.message || "Failed to delete notification");
      }
    },
    [delOne, reload]
  );

  return (
    <div className="relative">
      <button
        ref={btnRef}
        aria-label="Notifications"
        onClick={toggle}
        className="relative rounded-full p-2 hover:bg-black/10 transition"
      >
        <FaBell className="text-root-primary" />
        {!!unread && (
          <span className="absolute -top-0.5 -right-0.5 h-4 min-w-4 px-1 rounded-full bg-error text-[10px] leading-4 text-white text-center">
            {unread}
          </span>
        )}
      </button>

      {open && (
        <div
          ref={panelRef}
          className="absolute right-0 mt-2 w-80 max-h-[70vh] overflow-auto rounded-2xl bg-surface border border-root shadow-elevated z-50"
        >
          <div className="p-3 border-b border-root flex items-center justify-between gap-2">
            <div className="text-sm font-medium text-root-primary">Notifications</div>
            <div className="flex items-center gap-2">
              <button
                onClick={reload}
                className="text-xs text-root-secondary hover:text-root-primary disabled:opacity-60"
                disabled={loading}
              >
                {loading ? "…" : "Refresh"}
              </button>
              {items.length > 0 && (
                <>
                  <button
                    onClick={safeMarkAll}
                    className="text-xs px-2 py-1 rounded bg-white/10 hover:bg-white/20 text-root-primary disabled:opacity-60"
                    disabled={loading}
                    title="Mark all as read"
                  >
                    Mark all
                  </button>
                  {/* ▼ visual fix: make it a red pill, not black */}
                  <button
                    onClick={safeDeleteAll}
                    className="text-xs px-2 py-1 rounded bg-error text-white hover:opacity-90 disabled:opacity-60"
                    disabled={loading}
                    title="Delete all notifications"
                  >
                    Delete all
                  </button>
                </>
              )}
            </div>
          </div>

          {err && (
            <div className="px-3 py-2 text-[11px] text-error border-b border-root">{err}</div>
          )}

          <ul className="divide-y divide-root">
            {items.length === 0 ? (
              <li className="p-3 text-sm text-root-secondary">No notifications</li>
            ) : (
              items.map((n) => {
                const startIso = n?.meta?.startAtTs
                  ? new Date(n.meta.startAtTs).toISOString()
                  : n?.meta?.startAt || "";
                const startDisplay = startIso ? formatLocalTime(startIso) : "";
                const createdDisplay = n?.createdAt ? formatLocalTime(n.createdAt) : "";

                return (
                  <li key={n._id} className="p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="text-sm font-medium text-root-primary truncate">
                          {n.title}
                        </div>
                        <div className="text-xs text-root-secondary break-words">
                          {n.body}
                        </div>
                        {startDisplay && (
                          <div className="text-xs text-root-secondary">
                            Starts: {startDisplay}
                            {n?.meta?.location ? ` — ${n.meta.location}` : ""}
                          </div>
                        )}
                        <div className="text-[10px] text-root-secondary mt-1">
                          {createdDisplay}
                        </div>
                      </div>

                      <div className="shrink-0 flex flex-col items-end gap-1">
                        {!n.read ? (
                          <button
                            onClick={() => onRead(n._id)}
                            className="text-[11px] px-2 py-1 rounded bg-white/10 hover:bg-white/20 text-root-primary transition"
                            title="Mark as read"
                          >
                            Read
                          </button>
                        ) : (
                          <span className="text-[10px] px-2 py-1 rounded bg-white/10 text-root-secondary">
                            Read
                          </span>
                        )}
                        <button
                          onClick={() => onDelete(n._id)}
                          className="text-[11px] px-2 py-1 rounded bg-error text-white hover:opacity-90"
                          title="Delete notification"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  </li>
                );
              })
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
