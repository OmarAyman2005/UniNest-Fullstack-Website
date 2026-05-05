"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/admin/eventApi";
import Toast from "@/components/toast";
import { formatLocalTime } from "@/lib/dateFormatter.js";

function formatDate(iso) {
  if (!iso) return "";
  try {
    return formatLocalTime(iso);
  } catch {
    return iso;
  }
}

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

export default function PollDetailsPage({ params }) {
  const { id } = params || {};
  const router = useRouter();

  const [poll, setPoll] = useState(null);
  const [loading, setLoading] = useState(true);
  const [voting, setVoting] = useState(false);
  const [error, setError] = useState(null);

  // toast
  const DEFAULT_TOAST_DURATION = 4000;
  const toastTimerRef = useRef(null);
  const [toast, setToast] = useState(null);

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

  /* ---------------------- Load poll details ---------------------- */
  useEffect(() => {
    let mounted = true;

    const load = async () => {
      if (!id) return;
      setLoading(true);
      setError(null);
      try {
        // first load poll (use api helper)
        const res = await api(`/polls/${encodeURIComponent(id)}`);
        const payload = res?.data ?? res ?? {};
        if (!mounted) return;

        if (!payload || payload?.status === "error") {
          setError(payload?.message || "Poll not found.");
          setPoll(null);
          setLoading(false);
          return;
        }

        const data = payload.data ?? payload;

        // If event details missing but eventId present, fetch event info (best-effort)
        if (data?.eventId && !data.event) {
          try {
            const apiBase = getApiBase();
            // try single-event endpoint first
            const evRes = await fetch(`${apiBase}/event/${encodeURIComponent(data.eventId)}`, {
              method: "GET",
              credentials: "include",
            });
            let evPayload = await safeJson(evRes);
            let ev = evPayload?.data ?? evPayload ?? null;

            // fallback to list endpoint when single not available
            if (!ev) {
              const listRes = await fetch(`${apiBase}/event?eventId=${encodeURIComponent(data.eventId)}&limit=1`, {
                method: "GET",
                credentials: "include",
              });
              const listPayload = await safeJson(listRes);
              const list = listPayload?.data ?? listPayload ?? [];
              ev = Array.isArray(list) && list.length ? list[0] : null;
            }

            if (ev) data.event = ev;
          } catch (err) {
            // ignore, don't block showing poll
            console.debug("failed to fetch event details for poll:", err);
          }
        }

        setPoll(data);
      } catch (err) {
        if (!mounted) return;
        setError(err?.message || "Failed to load poll.");
        setPoll(null);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    load();

    return () => {
      mounted = false;
      if (toastTimerRef.current) {
        clearTimeout(toastTimerRef.current);
        toastTimerRef.current = null;
      }
    };
  }, [id]);

  /* -------------------------- Vote handler ------------------------ */
  const handleVote = async (optionId) => {
    if (!poll || !poll.isOpen) return;

    setVoting(true);
    try {
      const body = { optionId };

      const base =
        process.env.NEXT_PUBLIC_API_BASE ||
        process.env.NEXT_PUBLIC_API_URL ||
        "";
      const apiBase = base
        ? base.replace(/\/+$/, "")
        : `${window.location.protocol}//${window.location.hostname}:5000/api`;

      const res = await fetch(`${apiBase}/polls/${poll._id}/vote`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      let payload = {};
      try {
        payload = await res.json();
      } catch {
        payload = {};
      }

      if (!res.ok || payload?.status === "error") {
        const msg =
          payload?.message ||
          payload?.error ||
          `Failed to submit vote (status ${res.status}).`;
        showToast(msg, "error");
        return;
      }

      // API returns { status, data } from votePoll
      const updated = payload.data || payload;
      setPoll(updated);
      showToast("Your vote has been recorded.", "success");
    } catch (err) {
      showToast(err?.message || "Failed to submit vote.", "error");
    } finally {
      setVoting(false);
    }
  };

  const handleBack = () => router.push("/polls");

  if (!id) {
    return (
      <main className="p-8 space-y-6">
        <div className="max-w-5xl mx-auto">
          <div className="rounded-2xl bg-surface p-6 text-root-secondary shadow-elevated">
            <p className="text-red-400">Invalid poll id.</p>
          </div>
        </div>
      </main>
    );
  }

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

      <div className="max-w-5xl mx-auto space-y-6">
        {/* header */}
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-3xl font-semibold text-root-primary">Vendor Poll</h1>
            <p className="text-sm text-root-secondary mt-1">
              Vote for the vendor you’d like to see at this booth.
            </p>
          </div>
          <button
            type="button"
            onClick={handleBack}
            className="px-4 py-2 rounded-2xl bg-primary text-root-primary text-sm font-medium hover:opacity-90 transition"
          >
            Back to polls
          </button>
        </div>

        {loading ? (
          <div className="p-6 rounded-2xl bg-surface/60 text-root-secondary shadow-elevated animate-pulse">
            Loading poll…
          </div>
        ) : error ? (
          <div className="p-6 rounded-2xl bg-surface text-red-400 shadow-elevated">
            {error}
          </div>
        ) : !poll ? (
          <div className="p-6 rounded-2xl bg-surface text-root-secondary shadow-elevated">Poll not found.</div>
        ) : (
          <div className="space-y-6">
            {/* Poll card */}
            <section className="rounded-2xl bg-surface p-6 shadow-elevated">
              <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                <div className="flex-1">
                  <h2 className="text-2xl font-semibold text-root-primary mb-1">
                    {poll.title || "Vendor Poll"}
                  </h2>

                  {/* Description (under title) */}
                  {poll.description && (
                    <p className="text-sm text-root-secondary mb-2">{poll.description}</p>
                  )}

                  {/* Event details (replace previous "Created / Event ID") */}
                  <div className="mt-2 text-sm text-root-secondary space-y-1">
                    <div>
                      <span className="font-medium text-root-primary">Event:</span>{" "}
                      <span>
                        {(poll.event && (poll.event.name || poll.event.title)) ||
                          poll.event?.name ||
                          poll.event?.title ||
                          "Loading..."}
                      </span>
                    </div>
                    <div>
                      <span className="font-medium text-root-primary">Start:</span>{" "}
                      <span>
                        {poll.event
                          ? poll.event.startDateTime
                            ? formatDate(poll.event.startDateTime)
                            : poll.event.startDate ?? "Unknown"
                          : "Loading..."}
                      </span>
                    </div>
                    <div>
                      <span className="font-medium text-root-primary">End:</span>{" "}
                      <span>
                        {poll.event
                          ? poll.event.endDateTime
                            ? formatDate(poll.event.endDateTime)
                            : poll.event.endDate ?? "Unknown"
                          : "Loading..."}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <span
                    className={`inline-flex items-center px-3 py-1 rounded-full text-xs ${
                      poll.isOpen
                        ? "bg-green-500/10 border border-green-400/30 text-green-400"
                        : "bg-red-500/10 border border-red-400/30 text-red-400"
                    }`}
                  >
                    {poll.isOpen ? "Open" : "Closed"}
                  </span>
                  <span className="text-xs text-root-secondary">
                    Total votes: <span className="font-semibold">{poll.totalVotes ?? 0}</span>
                  </span>
                </div>
              </div>
            </section>

            {/* Options & voting */}
            <section className="rounded-2xl bg-surface p-6 shadow-elevated space-y-4">
              <h3 className="text-lg font-semibold text-root-primary mb-2">
                Choose one vendor
              </h3>

              {(!poll.options || poll.options.length === 0) && (
                <p className="text-sm text-root-secondary">No vendors in this poll.</p>
              )}

              <div className="space-y-3">
                {poll.options?.map((opt) => {
                  const isMine = opt.isMyChoice;
                  const voteCount = opt.voteCount ?? 0;

                  return (
                    <div
                      key={opt._id}
                      className={`flex flex-col md:flex-row md:items-center md:justify-between gap-3 px-4 py-3 rounded-xl ${
                        isMine ? "bg-green-500/5" : "bg-surface/50"
                      }`}
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-root-primary">
                            {opt.vendorName || "Vendor"}
                          </span>
                          {opt.boothNumber && (
                            <span className="text-xs px-2 py-0.5 rounded-full bg-root/5 text-root-secondary border border-root/30">
                              Booth {opt.boothNumber}
                            </span>
                          )}
                          {isMine && (
                            <span className="text-[11px] px-2 py-0.5 rounded-full bg-green-500/10 text-green-400 border border-green-400/30">
                              Your vote
                            </span>
                          )}
                        </div>
                        {opt.description && <div className="text-xs text-root-secondary mt-1">{opt.description}</div>}
                      </div>

                      <div className="flex items-center gap-3">
                        <span className="text-xs text-root-secondary">
                          {voteCount} vote{voteCount === 1 ? "" : "s"}
                        </span>
                        <button
                          type="button"
                          disabled={!poll.isOpen || voting}
                          onClick={() => handleVote(opt._id)}
                          className={`px-4 py-1.5 rounded-lg text-sm font-medium transition ${
                            !poll.isOpen
                              ? "bg-root/10 text-root-secondary cursor-not-allowed"
                              : isMine
                              ? "bg-green-500 text-white"
                              : "bg-primary text-root-primary hover:opacity-90"
                          }`}
                        >
                          {poll.isOpen ? (isMine ? "Change vote" : "Vote") : "Poll closed"}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>

            {/* Event details removed — details are shown under the poll title already */}
          </div>
        )}
      </div>
    </main>
  );
}
