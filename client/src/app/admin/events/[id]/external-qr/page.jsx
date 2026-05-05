"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import Link from "next/link";
import { getEventById, api } from "@/lib/admin/eventApi.js";

export default function ExternalQrPageAdminAlias() {
  const { id } = useParams();
  const sp = useSearchParams();

  const [img, setImg] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [eventType, setEventType] = useState("");
  const [eventName, setEventName] = useState("");

  const name = useMemo(() => sp.get("name") || "", [sp]);
  const email = useMemo(() => sp.get("email") || "", [sp]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      setErr("");
      try {
        // 1) Get event details to check type
        const ev = await getEventById(String(id));
        const type = String(ev?.eventType || "").toLowerCase();
        const name = String(ev?.name || "");
        setEventType(type);
        setEventName(name);

        // 2) Check if this event type supports external visitor QR
        const isBooth = type === "booth";
        const supportedTypes = ["bazaar"];
        if (!supportedTypes.includes(type) && !isBooth) {
          if (!mounted) return;
          setErr("QR is allowed except for bazaar/booth");
          setLoading(false);
          return;
        }

        // 3) Generate QR
        const qs = new URLSearchParams();
        if (name) qs.set("name", name);
        if (email) qs.set("email", email);

        const res = await api(`/event/${id}/external-visitor-qr?${qs.toString()}`);
        const payload = res?.json ? await res.json() : res;
        if (!mounted) return;

        if (payload?.status === "success" && payload.dataUrl) {
          setImg(payload.dataUrl);
        } else {
          setErr(payload?.message || "Failed to generate QR");
        }
      } catch (e) {
        if (mounted) setErr(e?.message || "Failed to generate QR");
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [id, name, email]);

  return (
    <main className="p-6 md:p-8 space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl md:text-3xl font-semibold text-root-primary">External Visitor QR</h1>
        <Link
          href="/admin/events"
          className="px-3 py-2 rounded-2xl input-surface border border-root hover:opacity-90"
        >
          ← Back to Events
        </Link>
      </div>

      <div className="p-4 rounded-2xl bg-surface border border-root">
        {loading ? (
          <div className="text-root-secondary">Generating…</div>
        ) : err ? (
          <div className="px-3 py-2 rounded-lg bg-red-600/20 text-red-200 border border-red-400/40">
            {err}
          </div>
        ) : img ? (
          <div className="flex flex-col items-center gap-3">
            <img
              src={img}
              alt="Visitor QR"
              className="w-[280px] h-[280px] object-contain rounded-lg shadow"
            />
            <div className="text-xs text-root-secondary">
              Scan to check in external visitors for this event.
            </div>
          </div>
        ) : (
          <div className="text-root-secondary">No QR generated.</div>
        )}
      </div>
    </main>
  );
}
