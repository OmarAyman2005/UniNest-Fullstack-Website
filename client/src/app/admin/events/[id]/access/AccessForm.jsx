"use client";

import { useEffect, useMemo, useState, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Toast from "@/components/toast";
import { eventsService } from "@/app/services/events.service";

const ALL_ROLES = ["student", "staff", "ta", "professor", "vendor"];

export default function AccessForm({ eventId, initialAllowedRoles = [] }) {
  const router = useRouter();

  const [selected, setSelected] = useState(() =>
    (initialAllowedRoles || []).map((r) => String(r).toLowerCase())
  );
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);
  const toastTimerRef = useRef(null);
  const DEFAULT_TOAST_DURATION = 3500;

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) {
        clearTimeout(toastTimerRef.current);
        toastTimerRef.current = null;
      }
    };
  }, []);

  const openToAll = useMemo(() => selected.length === 0, [selected]);

  const showToast = (message, type = "success", duration = DEFAULT_TOAST_DURATION) => {
    if (toastTimerRef.current) {
      clearTimeout(toastTimerRef.current);
      toastTimerRef.current = null;
    }
    setToast({ message, type });
    if (duration > 0) {
      toastTimerRef.current = setTimeout(() => {
        setToast(null);
        toastTimerRef.current = null;
      }, duration);
    }
  };

  const toggleRole = (role) => {
    const r = String(role).toLowerCase();
    setSelected((prev) =>
      prev.includes(r) ? prev.filter((x) => x !== r) : [...prev, r]
    );
  };

  const selectAll = () => setSelected([...ALL_ROLES]);
  const clearAll = () => setSelected([]);

  const save = async () => {
    try {
      setSaving(true);
      await eventsService.setAllowedRoles(eventId, selected);
      showToast("Allowed roles updated.", "success");
      // optionally refresh the list page cache and stay
      // router.refresh();  // uncomment if you want a full refresh
    } catch (e) {
      const msg = e?.message || "Failed to save roles";
      showToast(msg, "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-2xl bg-surface border border-root p-6 space-y-6 max-w-2xl">
      {toast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50">
          <Toast
            message={toast.message}
            type={toast.type}
            duration={DEFAULT_TOAST_DURATION}
            onClose={() => {
              if (toastTimerRef.current) {
                clearTimeout(toastTimerRef.current);
                toastTimerRef.current = null;
              }
              setToast(null);
            }}
          />
        </div>
      )}

      <p className="text-sm text-root-secondary">
        Choose which roles are allowed to register for this event. Leaving all roles unchecked
        makes the event <span className="text-root-primary font-medium">open to all</span>.
      </p>

      <div className="space-y-3">
        <div className="flex items-center gap-3">
          <span className="text-xs uppercase tracking-wide opacity-70">Quick actions</span>
          <button
            type="button"
            onClick={selectAll}
            className="px-3 py-1.5 rounded-xl input-surface text-sm hover:opacity-90"
            disabled={saving}
          >
            Select all
          </button>
          <button
            type="button"
            onClick={clearAll}
            className="px-3 py-1.5 rounded-xl input-surface text-sm hover:opacity-90"
            disabled={saving}
          >
            Clear all
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {ALL_ROLES.map((r) => {
            const checked = selected.includes(r);
            return (
              <label
                key={r}
                className="flex items-center gap-3 px-3 py-2 rounded-xl input-surface cursor-pointer select-none"
                title={`Allow ${r} to register`}
              >
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-current"
                  checked={checked}
                  onChange={() => toggleRole(r)}
                  disabled={saving}
                />
                <span className="capitalize">{r}</span>
              </label>
            );
          })}
        </div>

        <div className="pt-2">
          <span className="text-sm">
            Current mode:{" "}
            {openToAll ? (
              <span className="font-medium text-root-primary">Open to all</span>
            ) : (
              <span className="font-medium text-root-primary">
                Restricted ({selected.join(", ")})
              </span>
            )}
          </span>
        </div>
      </div>

      <div className="flex items-center justify-between pt-4">
        <Link
          href="/admin/events"
          className="px-4 py-2 rounded-2xl input-surface hover:opacity-90 transition"
        >
          ← Back to Events
        </Link>

        <button
          onClick={save}
          disabled={saving}
          className="px-5 py-2 rounded-2xl bg-primary text-root-primary hover:opacity-90 disabled:opacity-60 transition"
        >
          {saving ? "Saving…" : "Save changes"}
        </button>
      </div>
    </div>
  );
}
