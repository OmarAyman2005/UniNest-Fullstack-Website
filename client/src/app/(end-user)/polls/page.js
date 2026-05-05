"use client";

import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import Toast from "@/components/toast.js";
import { formatLocalTime } from "@/lib/dateFormatter.js";

function getApiBase() {
  const base =
    process.env.NEXT_PUBLIC_API_BASE || process.env.NEXT_PUBLIC_API_URL || "";
  if (base) return base.replace(/\/+$/, "");
  if (typeof window !== "undefined") {
    return `${window.location.protocol}//${window.location.hostname}:5000/api`;
  }
  return "http://localhost:5000/api";
}

async function safeJson(res) {
  try {
    return await res.json();
  } catch {
    return {};
  }
}

export default function PollsListPage() {
  const searchParams = useSearchParams();
  const eventId = searchParams.get("eventId") || "";
  const eventName = searchParams.get("eventName") || "";

  const [loading, setLoading] = useState(false);
  const [polls, setPolls] = useState([]);
  const [eventsById, setEventsById] = useState({}); // store fetched event details keyed by id
  const [toast, setToast] = useState(null);
  const toastTimerRef = useRef(null);
  const DEFAULT_TOAST_DURATION = 4000;

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

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      try {
        const apiBase = getApiBase();

        const qs = eventId ? `?eventId=${encodeURIComponent(eventId)}` : "";
        const url = `${apiBase}/polls${qs}`;

        const res = await fetch(url, {
          method: "GET",
          credentials: "include",
        });

        const payload = await safeJson(res);

        if (!res.ok || payload?.status === "error") {
          const msg =
            payload?.message ||
            payload?.error ||
            `Failed to load polls (status ${res.status}).`;
          if (!cancelled) {
            setPolls([]);
            showToast(msg, "error");
          }
          return;
        }

        const list = payload?.data ?? [];
        if (!cancelled) {
          setPolls(Array.isArray(list) ? list : []);
        }
      } catch (err) {
        console.error("PollsListPage load error:", err);
        if (!cancelled) {
          setPolls([]);
          showToast(err?.message || "Failed to load polls.", "error");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();

    return () => {
      cancelled = true;
      if (toastTimerRef.current) {
        clearTimeout(toastTimerRef.current);
        toastTimerRef.current = null;
      }
    };
  }, [eventId]);

  // fetch event details for polls (by eventId) and cache into eventsById
  useEffect(() => {
    if (!polls || polls.length === 0) return;
    const ids = Array.from(new Set(polls.map((p) => p.eventId).filter(Boolean)));
    if (ids.length === 0) return;

    let cancelled = false;
    const apiBase = getApiBase();

    const fetchForId = async (id) => {
      try {
        // try event endpoint for single id
        const res = await fetch(`${apiBase}/event/${encodeURIComponent(id)}`, {
          method: "GET",
          credentials: "include",
        });
        const payload = await safeJson(res);
        const data = payload?.data ?? payload ?? null;
        if (res.ok && data) {
          setEventsById((prev) => ({ ...prev, [id]: data }));
        } else {
          // fallback: try list endpoint with id filter (some APIs use ?_id=)
          const res2 = await fetch(`${apiBase}/event?eventId=${encodeURIComponent(id)}&limit=1`, {
            method: "GET",
            credentials: "include",
          });
          const payload2 = await safeJson(res2);
          const list = payload2?.data ?? payload2 ?? [];
          const ev = Array.isArray(list) && list.length ? list[0] : null;
          if (ev) setEventsById((prev) => ({ ...prev, [id]: ev }));
        }
      } catch (err) {
        console.debug("failed to fetch event", id, err);
      }
    };

    ids.forEach((id) => {
      if (!eventsById[id]) fetchForId(id);
    });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [polls]);

  const headerTitle = eventId ? "Vendor Polls" : "All Vendor Polls";
  const headerSubtitle = eventId
    ? `Event: ${eventName || "Selected Event"}`
    : "Open polls created by the Events Office for current Booth clashes.";

  return (
    <main className="p-8 space-y-6">
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

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold text-root-primary">{headerTitle}</h1>
          <p className="text-sm text-root-secondary mt-1">{headerSubtitle}</p>
        </div>

        <Link
          href="/home"
          className="px-4 py-2 rounded-2xl bg-primary text-root-primary text-sm font-medium hover:opacity-90 transition"
        >
          Back to Home
        </Link>
      </div>

      {/* Polls list - cleaner, modern card UI */}
      <section className="space-y-4">
        {loading ? (
          <div className="p-6 rounded-2xl bg-surface/60 text-root-secondary shadow-elevated animate-pulse">
            Loading polls…
          </div>
        ) : polls.length === 0 ? (
          <div className="p-6 rounded-2xl bg-root/5 text-root-secondary flex items-center justify-center">
            <div className="text-center max-w-lg">
              <p className="text-lg font-medium mb-2">No open vendor polls</p>
              <p className="text-sm">There are no open vendor polls at the moment. Check back later.</p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {polls.map((poll) => {
              const myChoice = (poll.options || []).find((o) => o.isMyChoice);
              const ev = poll.event || eventsById[poll.eventId] || null;
              // try several common date fields
              const startRaw = ev?.startDateTime ?? ev?.startDate ?? ev?.start ?? null;
              const endRaw = ev?.endDateTime ?? ev?.endDate ?? ev?.end ?? null;
              return (
                <article
                  key={poll._id}
                  className="group relative rounded-2xl bg-gradient-to-b from-surface to-surface/95 p-5 shadow-lg hover:shadow-xl transition transform hover:-translate-y-1"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <h2 className="text-lg font-semibold text-root-primary truncate">
                        {poll.title || "Vendor Poll"}
                      </h2>

                      {/* Description */}
                      {poll.description && (
                        <p className="text-sm text-root-secondary mt-1 line-clamp-3">
                          {poll.description}
                        </p>
                      )}

                      {/* Event details */}
                      {ev && (
                        <div className="mt-3 text-sm text-root-secondary space-y-1">
                          <div>
                            <span className="font-medium text-root-primary">Event:</span>{" "}
                            <span>{ev.name || ev.title || ev._id || poll.eventId}</span>
                          </div>
                          <div>
                            <span className="font-medium text-root-primary">Start:</span>{" "}
                            <span>{startRaw ? formatLocalTime(startRaw) : "Unknown"}</span>
                          </div>
                          <div>
                            <span className="font-medium text-root-primary">End:</span>{" "}
                            <span>{endRaw ? formatLocalTime(endRaw) : "Unknown"}</span>
                          </div>
                        </div>
                      )}

                      <div className="flex items-center gap-2 mt-3 flex-wrap text-xs">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full ${
                            poll.isOpen
                              ? "bg-green-500/10 text-green-400 border border-green-400/30"
                              : "bg-red-500/10 text-red-400 border border-red-400/30"
                          }`}
                        >
                          {poll.isOpen ? "Open" : "Closed"}
                        </span>

                        <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-root/5 text-root-secondary border border-root/30">
                          {poll.totalVotes ?? 0} vote{(poll.totalVotes ?? 0) === 1 ? "" : "s"}
                        </span>

                        {myChoice && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/30">
                            You voted: <span className="font-semibold ml-2">{myChoice.vendorName || "Vendor"}</span>
                          </span>
                        )}
                      </div>

                     
                    </div>
                  </div>

                  <div className="mt-4 flex justify-end">
                    <Link
                      href={`/polls/${poll._id}`}
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-2xl bg-primary text-root-primary text-sm font-medium hover:opacity-95 transition"
                    >
                      {myChoice ? "View Details" : "Open Poll"}
                    </Link>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}
