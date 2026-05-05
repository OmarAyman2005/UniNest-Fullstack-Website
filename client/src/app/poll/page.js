"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import Toast from "@/components/toast.js";
import { formatLocalTime } from "@/lib/dateFormatter.js";

// Small helper: unwrap Response → JSON safely
async function getJson(maybeResponse) {
  if (!maybeResponse) return {};
  if (typeof maybeResponse.json === "function") {
    try {
      return await maybeResponse.json();
    } catch {
      return {};
    }
  }
  return maybeResponse;
}

// Resolve API base (mirrors the pattern we used elsewhere)
function resolveApiBase() {
  const base =
    process.env.NEXT_PUBLIC_API_BASE ||
    process.env.NEXT_PUBLIC_API_URL ||
    "";
  if (base) return base.replace(/\/+$/, "");
  if (typeof window !== "undefined") {
    return `${window.location.protocol}//${window.location.hostname}:5000/api`;
  }
  return "";
}

export default function PollVotePage() {
  const router = useRouter();
  const params = useParams();
  const pollId = params?.id;

  const [poll, setPoll] = useState(null);
  const [eventInfo, setEventInfo] = useState(null);

  const [loading, setLoading] = useState(true);
  const [votingOptionId, setVotingOptionId] = useState(null);
  const [error, setError] = useState("");

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

  // Load poll (and event info)
  useEffect(() => {
    if (!pollId) return;

    let mounted = true;

    const loadPoll = async () => {
      setLoading(true);
      setError("");
      try {
        const apiBase = resolveApiBase();

        // 1) Fetch poll
        const res = await fetch(`${apiBase}/polls/${encodeURIComponent(pollId)}`, {
          credentials: "include",
        });
        const payload = await getJson(res);

        if (!res.ok || payload?.status === "error") {
          const msg =
            payload?.message ||
            payload?.error ||
            `Failed to load poll (status ${res.status}).`;
          if (!mounted) return;
          setError(msg);
          setPoll(null);
          return;
        }

        const data = payload?.data ?? payload ?? null;
        if (!mounted) return;
        setPoll(data);

        // 2) Fetch event info (optional; just for nicer UI)
        if (data?.eventId) {
          try {
            const evRes = await fetch(
              `${apiBase}/event/${encodeURIComponent(data.eventId)}`,
              { credentials: "include" }
            );
            const evPayload = await getJson(evRes);
            const ev = evPayload?.data ?? evPayload ?? null;
            if (!mounted) return;
            if (ev) {
              setEventInfo({
                id: ev._id || data.eventId,
                name: ev.name || ev.title || "",
                location: ev.location || "",
                startDateTime: ev.startDateTime || null,
              });
            }
          } catch {
            // if event fetch fails, we just skip it
          }
        }
      } catch (err) {
        console.error("PollVotePage load error:", err);
        if (!mounted) return;
        setError(err?.message || "Failed to load poll.");
        setPoll(null);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    loadPoll();

    return () => {
      mounted = false;
      if (toastTimerRef.current) {
        clearTimeout(toastTimerRef.current);
        toastTimerRef.current = null;
      }
    };
  }, [pollId]);

  const handleVote = async (optionId) => {
    if (!poll || !poll._id || !optionId) return;
    if (!poll.isOpen) {
      showToast("This poll is closed.", "error");
      return;
    }

    setVotingOptionId(optionId);
    try {
      const apiBase = resolveApiBase();
      const res = await fetch(
        `${apiBase}/polls/${encodeURIComponent(poll._id)}/vote`,
        {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ optionId }),
        }
      );

      const payload = await getJson(res);

      if (!res.ok || payload?.status === "error") {
        const msg =
          payload?.message ||
          payload?.error ||
          (res.status === 401
            ? "You must be logged in to vote."
            : res.status === 403
            ? "Only Students/Staff/TA/Professors can vote in this poll."
            : `Failed to submit vote (status ${res.status}).`);
        showToast(msg, "error");
        return;
      }

      const data = payload?.data ?? payload ?? null;
      if (data) {
        setPoll(data);
        showToast("Your vote has been recorded.", "success");
      }
    } catch (err) {
      console.error("handleVote error:", err);
      showToast(err?.message || "Failed to submit vote.", "error");
    } finally {
      setVotingOptionId(null);
    }
  };

  if (!pollId) {
    return (
      <main className="p-8 text-root-primary">
        <p>Missing poll id in URL.</p>
      </main>
    );
  }

  if (loading) {
    return (
      <main className="p-8 text-root-primary">
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
        <p>Loading poll…</p>
      </main>
    );
  }

  if (error || !poll) {
    return (
      <main className="p-8 text-root-primary space-y-4">
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
        <h1 className="text-2xl font-semibold">Poll</h1>
        <div className="rounded-2xl bg-surface border border-error/50 text-error px-4 py-3">
          {error || "Poll not found."}
        </div>
        <button
          onClick={() => router.back()}
          className="px-4 py-2 rounded-2xl bg-primary text-root-primary text-sm hover:opacity-90 transition"
        >
          Go back
        </button>
      </main>
    );
  }

  const totalVotes = poll.totalVotes ?? 0;
  const options = Array.isArray(poll.options) ? poll.options : [];
  const isOpen = !!poll.isOpen;

  return (
    <main className="p-6 md:p-8 space-y-6 text-root-primary">
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
          <h1 className="text-3xl font-semibold">
            {poll.title || "Vendor Poll"}
          </h1>
          {eventInfo && (
            <p className="text-sm text-root-secondary mt-1">
              For event{" "}
              <span className="font-medium">
                {eventInfo.name || "Event"}
              </span>
              {eventInfo.location && (
                <> · <span>{eventInfo.location}</span></>
              )}
              {eventInfo.startDateTime && (
                <>
                  {" "}
                  ·{" "}
                  <span>{formatLocalTime(eventInfo.startDateTime)}</span>
                </>
              )}
            </p>
          )}
          {poll.description && (
            <p className="text-sm text-root-secondary mt-2">
              {poll.description}
            </p>
          )}
        </div>

        <div className="flex flex-col items-start md:items-end gap-2">
          <span
            className={`inline-flex items-center px-3 py-1 rounded-full text-xs border ${
              isOpen
                ? "bg-green-500/15 border-green-400/60 text-green-200"
                : "bg-red-500/10 border-red-400/60 text-red-200"
            }`}
          >
            {isOpen ? "Poll Open" : "Poll Closed"}
          </span>
          <span className="text-xs text-root-secondary">
            Total votes:{" "}
            <span className="font-semibold">{totalVotes}</span>
          </span>
          <button
            type="button"
            onClick={() => router.back()}
            className="px-4 py-1.5 rounded-2xl input-surface text-xs hover:opacity-90 transition"
          >
            Go back
          </button>
        </div>
      </div>

      {/* Options */}
      <section className="p-4 rounded-2xl bg-surface border border-root/60 shadow-elevated/40 space-y-3">
        <h2 className="text-lg font-semibold">Choose your preferred vendor</h2>
        <p className="text-xs text-root-secondary">
          You can change your vote later; your latest choice will be counted.
        </p>

        {options.length === 0 ? (
          <p className="text-sm text-root-secondary mt-4">
            This poll has no vendor options configured.
          </p>
        ) : (
          <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
            {options.map((opt) => {
              const idStr = String(opt._id);
              const voteCount = opt.voteCount ?? 0;
              const isMyChoice = !!opt.isMyChoice;

              const percentage =
                totalVotes > 0 ? Math.round((voteCount / totalVotes) * 100) : 0;

              return (
                <div
                  key={idStr}
                  className={`relative rounded-2xl border px-4 py-3 space-y-2 bg-black/30 ${
                    isMyChoice
                      ? "border-primary/80 shadow-[0_0_0_1px_rgba(255,255,255,0.12)]"
                      : "border-root/60"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm">
                          {opt.vendorName || "Vendor"}
                        </span>
                        {isMyChoice && (
                          <span className="px-2 py-0.5 text-[11px] rounded-full bg-primary/20 text-primary border border-primary/60">
                            Your choice
                          </span>
                        )}
                      </div>
                      {opt.boothNumber && (
                        <p className="text-xs text-root-secondary">
                          Booth: <span className="font-medium">{opt.boothNumber}</span>
                        </p>
                      )}
                    </div>

                    <button
                      type="button"
                      disabled={!isOpen || votingOptionId === idStr}
                      onClick={() => handleVote(idStr)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-medium transition
                        ${
                          !isOpen
                            ? "bg-white/5 text-root-secondary cursor-not-allowed opacity-60"
                            : "bg-primary text-root-primary hover:opacity-90"
                        }
                      `}
                    >
                      {votingOptionId === idStr ? "Voting…" : "Vote"}
                    </button>
                  </div>

                  {/* Vote bar */}
                  <div className="mt-2 space-y-1">
                    <div className="w-full h-1.5 rounded-full bg-black/40 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-primary"
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-[11px] text-root-secondary">
                      <span>
                        {voteCount} vote{voteCount === 1 ? "" : "s"}
                      </span>
                      <span>{percentage}%</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {!isOpen && (
          <p className="mt-3 text-xs text-root-secondary">
            This poll is closed; voting is disabled but you can still view the results.
          </p>
        )}
      </section>
    </main>
  );
}
