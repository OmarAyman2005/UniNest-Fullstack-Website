"use client";
import { useNotifications } from "../../hooks/useNotifications";

export default function NotificationsPage() {
  const { items, loading, markRead } = useNotifications(15000);

  return (
    <div className="max-w-3xl mx-auto p-4 space-y-4">
      <h1 className="text-2xl font-semibold">Notifications</h1>
      {loading && <div className="opacity-60">Loading…</div>}
      <div className="divide-y border rounded">
        {items.length === 0 && <div className="p-4 opacity-60">No notifications</div>}
        {items.map((n) => (
          <div key={n._id} className="p-4 hover:bg-black/5 transition">
            <div className="flex items-center justify-between">
              <div className="font-medium">{n.title}</div>
              {!n.read && (
                <button className="text-xs underline" onClick={() => markRead(n._id)}>
                  Mark as read
                </button>
              )}
            </div>
            <div className="text-sm">{n.body}</div>
            {n?.meta?.eventId && (
              <a className="text-xs underline" href={`/app/(end-user)/events/${n.meta.eventId}`}>
                View event
              </a>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
