"use client";

import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { getEventById, getEventAccess, updateEventAccess } from "@/lib/admin/eventApi";

const ROLE_CHOICES = [
  { value: "student", label: "Student" },
  { value: "staff", label: "Staff" },
  { value: "ta", label: "Ta" },
  { value: "professor", label: "Professor" },
  { value: "vendor", label: "Vendor" },
];

export default function AccessPage() {
  const { id: eventId } = useParams();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [eventName, setEventName] = useState("");
  const [eventType, setEventType] = useState("");

  const [externalVisitorsEnabled, setExternalVisitorsEnabled] = useState(false);
  const [selectedRoles, setSelectedRoles] = useState([]);

  // banner is hidden until first load finishes;
  // we also suppress it for 404 → default access
  const hasLoadedOnce = useRef(false);
  const [banner, setBanner] = useState(null); // { tone: "error"|"success"|"info", text: string }

  const isBazaar = useMemo(
    () => String(eventType || "").toLowerCase() === "bazaar",
    [eventType]
  );

  const isBooth = useMemo(
    () => String(eventType || "").toLowerCase() === "booth",
    [eventType]
  );

  const canEnableExternalVisitors = useMemo(() => isBazaar || isBooth, [isBazaar, isBooth]);

  const inSelected = (v) => selectedRoles.includes(v);
  const toggleRole = (v) =>
    setSelectedRoles((prev) => (prev.includes(v) ? prev.filter((r) => r !== v) : [...prev, v]));
  const selectAll = () => setSelectedRoles(ROLE_CHOICES.map((r) => r.value));
  const clearAll = () => setSelectedRoles([]);

  const load = useCallback(async () => {
    if (!eventId) return;
    setLoading(true);
    try {
      // 1) get event name + type
      const ev = await getEventById(String(eventId));
      setEventName(ev?.name || "");
      setEventType(ev?.eventType || ev?.type || "");

      // 2) get access (404 becomes defaults, without error banner)
      const { from, data } = await getEventAccess(String(eventId));
      setExternalVisitorsEnabled(!!data.externalVisitorsEnabled);
      const roles = Array.isArray(data.allowedRoles) ? data.allowedRoles : [];
      setSelectedRoles(roles.map((r) => String(r).toLowerCase()));

      if (from === "server") setBanner(null);
      // if from === "defaults" we intentionally don't show an error
    } catch (e) {
      // Real error (not 404)
      setBanner({ tone: "error", text: e?.message || "Failed to load access settings" });
    } finally {
      hasLoadedOnce.current = true;
      setLoading(false);
    }
  }, [eventId]);

  useEffect(() => {
    load();
  }, [load]);

  const onSave = async () => {
    if (!eventId) return;
    try {
      setSaving(true);
      setBanner(null);

      // Always write roles; only write externalVisitors if the event is bazaar or booth
      // (server can ignore the field for non-bazaar/booth, but we keep payload clean)
      const payload = {
        allowedRoles: selectedRoles.map((r) => String(r).toLowerCase()),
      };
      if (canEnableExternalVisitors) payload.externalVisitorsEnabled = !!externalVisitorsEnabled;

      await updateEventAccess(String(eventId), payload);

      // Re-fetch to reflect persisted state when page is reopened
      await load();

      setBanner({ tone: "success", text: "Saved" });
    } catch (e) {
      setBanner({ tone: "error", text: e?.message || "Failed to save" });
    } finally {
      setSaving(false);
    }
  };

  const currentMode = useMemo(
    () => (selectedRoles.length === 0 ? "Open to all" : `Restricted to: ${selectedRoles.join(", ")}`),
    [selectedRoles]
  );

  return (
    <main className="p-6 md:p-8 space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl md:text-3xl font-semibold text-root-primary">
          Registration Access{eventName ? <> — <span className="opacity-90">{eventName}</span></> : ""}
        </h1>

        <Link
          href="/admin/events"
          className="px-3 py-2 rounded-2xl input-surface border border-root hover:opacity-90"
        >
          ← Back to Events
        </Link>
      </div>

      {/* Show banners only after first load */}
      {hasLoadedOnce.current && banner?.text && (
        <div
          className={`rounded-xl border px-3 py-2 text-sm ${
            banner.tone === "error"
              ? "bg-red-600/20 text-red-200 border-red-400/40"
              : banner.tone === "success"
              ? "bg-green-600/20 text-green-200 border-green-400/40"
              : "bg-black/30 text-secondary border-white/10"
          }`}
        >
          {banner.text}
        </div>
      )}

      <section className="rounded-2xl bg-surface border border-white/10 p-4 md:p-5 space-y-5">
        {/* External visitors (QR) — Bazaar and Booth only */}
        {canEnableExternalVisitors && (
          <>
            <div className="space-y-2">
              <h2 className="text-base md:text-lg font-medium text-root-primary">
                External visitors (QR check-in)
              </h2>
              <label className="flex items-center gap-3 select-none">
                <input
                  type="checkbox"
                  className="h-5 w-5 rounded accent-current"
                  checked={externalVisitorsEnabled}
                  onChange={(e) => setExternalVisitorsEnabled(e.target.checked)}
                  disabled={loading}
                />
                <span className="text-sm text-root-secondary">
                  Allow external visitors to check in using a QR code.
                </span>
              </label>
            </div>

            <hr className="border-root/60" />
          </>
        )}

        {/* Roles + bulk actions (always visible) */}
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm text-root-secondary">
            Choose which roles are allowed to register for this event. Leaving all roles unchecked makes the event{" "}
            <strong>open to all</strong>.
          </p>
          <div className="flex gap-2 shrink-0">
            <button
              className="px-3 py-1.5 rounded-xl input-surface border border-root hover:opacity-90"
              onClick={selectAll}
              disabled={loading}
            >
              Select all
            </button>
            <button
              className="px-3 py-1.5 rounded-xl input-surface border border-root hover:opacity-90"
              onClick={clearAll}
              disabled={loading}
            >
              Clear all
            </button>
          </div>
        </div>

        {/* Roles grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {ROLE_CHOICES.map((r) => (
            <label
              key={r.value}
              className="flex items-center gap-3 px-4 py-3 rounded-xl input-surface border border-root cursor-pointer"
            >
              <input
                type="checkbox"
                className="h-5 w-5 rounded accent-current"
                checked={inSelected(r.value)}
                onChange={() => toggleRole(r.value)}
                disabled={loading}
              />
              <span className="text-root-primary font-medium">{r.label}</span>
            </label>
          ))}
        </div>

        {/* Current mode — white pill */}
        <div className="pt-1">
          <span className="text-sm text-root-secondary mr-2">Current mode:</span>
          <span className="inline-flex items-center px-3 py-1.5 rounded-full text-sm font-medium border bg-white text-black border-white/40">
            {currentMode}
          </span>
        </div>

        <div className="flex items-center justify-end pt-2">
          <button
            onClick={onSave}
            disabled={saving || loading}
            className="px-5 py-2 rounded-2xl bg-primary text-root-primary disabled:opacity-60 hover:opacity-90"
          >
            {saving ? "Saving…" : "Save changes"}
          </button>
        </div>
      </section>
    </main>
  );
}
