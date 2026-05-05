"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { gymSessionsUrl, reserveGymSession, cancelGymSession } from "@/lib/api";
import { slugToLabel } from "@/lib/end-user/gymRoutes";
import { CATEGORY_EMOJI } from "@/lib/end-user/gymTaxonomy";

export default function GymTypeTimingsPage({ params }) {
  const { category: catSlug, type: typeSlug } = params;
  const category = slugToLabel(catSlug);
  const type = slugToLabel(typeSlug);
  const emoji = CATEGORY_EMOJI[category] || "🏋️";

  const [selectedISO, setSelectedISO] = useState(todayISO());
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  // modal state
  const [modal, setModal] = useState({
    open: false,
    mode: /** "reserve" | "cancel" */ null,
    session: null,
  });

  const offDay = useMemo(() => {
    const d = new Date(selectedISO).getDay();
    return d === 5 || d === 6 ? d : null; // Fri/Sat
  }, [selectedISO]);

  // TODAY helpers for "completed" logic
  const todayIso = todayISO();
  const isTodaySelected = selectedISO === todayIso;
  const nowMinutes = currentTimeMinutes();

  useEffect(() => {
    let cancel = false;
    (async () => {
      setLoading(true);
      setErr("");
      try {
        const url = new URL(gymSessionsUrl);
        url.searchParams.set("type", type);
        url.searchParams.set("date", selectedISO);
        const res = await fetch(url.toString(), {
          cache: "no-store",
          credentials: "include",
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        if (!cancel) setSessions(Array.isArray(json?.data) ? json.data : []);
      } catch {
        if (!cancel) setErr("Could not load sessions for this day.");
      } finally {
        if (!cancel) setLoading(false);
      }
    })();
    return () => (cancel = true);
  }, [type, selectedISO]);

  const monthLabel = useMemo(() => monthSpanLabel(28), []);

  function openReserve(s) {
    setModal({ open: true, mode: "reserve", session: s });
  }
  function openCancel(s) {
    setModal({ open: true, mode: "cancel", session: s });
  }
  function closeModal() {
    setModal({ open: false, mode: null, session: null });
  }

  async function confirmAction() {
    if (!modal.open || !modal.session) return;
    const s = modal.session;
    try {
      if (modal.mode === "reserve") {
        const payload = await reserveGymSession(s._id);
        const booked = payload?.data?.booked ?? (s.booked + 1);
        updateSession(s._id, { booked, isMine: true });
      } else {
        const payload = await cancelGymSession(s._id);
        const booked = payload?.data?.booked ?? Math.max(0, s.booked - 1);
        updateSession(s._id, { booked, isMine: false });
      }
      closeModal();
    } catch (e) {
      const msg = e?.data?.error || e?.message || "Action failed";
      alert(msg); // small fallback; modal stays open
    }
  }

  function updateSession(id, patch) {
    setSessions((list) =>
      list.map((x) => (String(x._id) === String(id) ? { ...x, ...patch } : x))
    );
  }

  return (
    <div className="py-8">
      <div className="mx-auto w-full max-w-5xl">
        <section className="rounded-2xl bg-neutral-900 ring-2 ring-neutral-800 shadow-[0_20px_40px_rgba(0,0,0,.45)] px-6 sm:px-8 py-8 space-y-6">
          {/* Title */}
          <div className="text-center space-y-1">
            <div className="text-sm text-gray-300">{category}</div>
            <h1 className="text-2xl md:text-3xl font-semibold text-white flex items-center justify-center gap-2">
              <span aria-hidden className="text-xl">
                {emoji}
              </span>
              {type}
            </h1>
            <div className="flex justify-center mt-3">
              <Link
                href={`/gym/${encodeURIComponent(catSlug)}`}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-full ring-1 ring-neutral-700 bg-neutral-800 text-gray-200 hover:ring-neutral-500 hover:text-white transition"
              >
                ← Back to Types
              </Link>
            </div>
          </div>

          {/* Calendar */}
          <section className="rounded-2xl ring-2 ring-neutral-800 bg-neutral-950 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,.04),0_20px_40px_rgba(0,0,0,.45)]">
            <div className="text-gray-300 text-sm mb-2">{monthLabel}</div>
            <MiniCalendar28 value={selectedISO} onChange={setSelectedISO} />
          </section>

          {/* States */}
          {offDay != null && (
            <div className="rounded-md bg-amber-500/10 text-amber-200 ring-1 ring-amber-500/30 px-4 py-3 text-sm text-center">
              {offDay === 6
                ? "🛌 Saturdays are off — no slots. Relax and recharge 😉"
                : "🛌 Fridays are off — no slots. Relax and recharge 😉"}
            </div>
          )}
          {!offDay && err && (
            <div className="rounded-md bg-red-500/10 text-red-200 ring-1 ring-red-500/30 px-4 py-3 text-sm">
              ⚠️ {err}
            </div>
          )}
          {!offDay && loading && <CardsSkeleton />}
          {!offDay && !loading && !err && sessions.length === 0 && (
            <div className="rounded-md bg-neutral-800 text-gray-200 ring-1 ring-neutral-700 px-4 py-3 text-sm">
              No sessions available for this day.
            </div>
          )}
          {!offDay && !loading && !err && sessions.length > 0 && (
            <CardsGrid
              sessions={sessions}
              onReserve={openReserve}
              onCancel={openCancel}
              isTodaySelected={isTodaySelected}
              nowMinutes={nowMinutes}
            />
          )}
        </section>
      </div>

      {/* Confirm/Cancel modal (matching Sports styling) */}
      {modal.open && modal.session && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/60" onClick={closeModal} />
          <div className="relative z-10 w-full max-w-md rounded-2xl bg-neutral-900 ring-1 ring-neutral-700 p-5 text-gray-100 shadow-2xl">
            <h2 className="text-lg font-semibold mb-3">
              {modal.mode === "reserve"
                ? "Confirm Reservation"
                : "Cancel Reservation"}
            </h2>
            <p className="text-sm text-gray-300 mb-5">
              {formatTime12(modal.session.startTime)} –{" "}
              {formatTime12(modal.session.endTime)} with{" "}
              {modal.session.coachName || modal.session.coach || "Coach"} on{" "}
              {new Date(selectedISO).toLocaleDateString()}
            </p>
            <div className="flex gap-3 justify-end">
              <button
                className="px-4 py-2 rounded-md ring-1 ring-neutral-600 bg-neutral-800 hover:ring-neutral-500"
                onClick={closeModal}
              >
                Close
              </button>
              <button
                className={[
                  "px-4 py-2 rounded-md font-medium",
                  modal.mode === "reserve"
                    ? "bg-emerald-600 hover:bg-emerald-500"
                    : "bg-red-600 hover:bg-red-500",
                ].join(" ")}
                onClick={confirmAction}
              >
                {modal.mode === "reserve"
                  ? "Confirm"
                  : "Cancel reservation"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* shake CSS */}
      <style jsx global>{`
        @keyframes shake-kf {
          0% {
            transform: translateX(0);
          }
          15% {
            transform: translateX(-3px);
          }
          30% {
            transform: translateX(3px);
          }
          45% {
            transform: translateX(-3px);
          }
          60% {
            transform: translateX(3px);
          }
          75% {
            transform: translateX(-2px);
          }
          100% {
            transform: translateX(0);
          }
        }
        .shake {
          animation: shake-kf 240ms ease-in-out;
        }
      `}</style>
    </div>
  );
}

/* ---------- Cards / Skeleton / Calendar ---------- */

function CardsGrid({ sessions, onReserve, onCancel, isTodaySelected, nowMinutes }) {
  const btnRefs = useRef({});

  return (
    <ul className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {sessions.map((s) => {
        const key =
          s._id ||
          `${s.type}-${s.date}-${s.startTime}-${s.coachName || s.coach}`;
        const booked = Number(s.booked) || 0;
        const cap = Number(s.capacity) || 0;
        const isFull = cap > 0 && booked >= cap;
        const mine = !!s.isMine;
        const coach = s.coachName || s.coach || "TBA";

        const isPastToday =
          isTodaySelected && hhmmToMinutes(s.startTime) < nowMinutes;

        // Status pill styling + label
        let statusPill = "";
        let statusText = "";
        if (isPastToday) {
          statusPill =
            "bg-neutral-700/40 text-gray-300 ring-neutral-500/70";
          statusText = mine ? "Completed (you)" : "Completed";
        } else if (mine) {
          statusPill =
            "bg-sky-500/15 text-sky-300 ring-sky-500/40";
          statusText = "Reserved (you)";
        } else if (isFull) {
          statusPill =
            "bg-red-500/15 text-red-300 ring-red-500/40";
          statusText = "Fully booked";
        } else {
          statusPill =
            "bg-emerald-500/15 text-emerald-300 ring-emerald-500/40";
          statusText = "Available";
        }

        // Button text + behaviour
        const disabledForPast = isPastToday;
        const disabledForFull = isFull && !mine;
        const btnText = disabledForPast
          ? "Completed"
          : mine
          ? "Cancel"
          : disabledForFull
          ? "Fully booked"
          : "Reserve";

        const handleClick = () => {
          const el = btnRefs.current[key];
          if (disabledForPast || disabledForFull) {
            if (el) {
              el.classList.remove("shake");
              void el.offsetHeight;
              el.classList.add("shake");
            }
            return;
          }
          mine ? onCancel?.(s) : onReserve?.(s);
        };

        return (
          <li
            key={key}
            className={[
              "rounded-2xl p-4 md:p-5",
              "bg-neutral-950 ring-2 ring-neutral-700",
              "bg-gradient-to-b from-neutral-950 to-neutral-900",
              "shadow-[inset_0_1px_0_rgba(255,255,255,.04),0_14px_30px_rgba(0,0,0,.55)]",
              "hover:ring-neutral-500 transition",
            ].join(" ")}
          >
            <div className="space-y-3">
              <p className="text-white font-semibold text-lg">
                {formatTime12(s.startTime)} – {formatTime12(s.endTime)}
              </p>

              <p className="text-gray-300">
                Coach: <span className="text-white">{coach}</span>
              </p>

              <div className="flex items-center justify-between">
                <span className="text-gray-300">
                  {booked}/{cap} booked
                </span>
                <span
                  className={[
                    "inline-flex items-center text-xs font-semibold px-2 py-0.5 rounded-full ring-1",
                    statusPill,
                  ].join(" ")}
                >
                  {statusText}
                </span>
              </div>

              <button
                ref={(el) => (btnRefs.current[key] = el)}
                onClick={handleClick}
                aria-disabled={disabledForPast || disabledForFull}
                className={[
                  "w-full rounded-xl px-4 py-2 text-center transition",
                  disabledForPast || disabledForFull
                    ? "bg-neutral-800 text-gray-400 ring-1 ring-neutral-600 cursor-not-allowed"
                    : mine
                    ? "bg-red-600 hover:bg-red-500 text-white"
                    : "bg-neutral-950 text-white ring-1 ring-neutral-700 hover:ring-neutral-500",
                ].join(" ")}
              >
                {btnText}
              </button>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function CardsSkeleton() {
  return (
    <ul className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <li
          key={i}
          className="rounded-2xl p-4 md:p-5 bg-neutral-950 ring-2 ring-neutral-700 animate-pulse shadow-[inset_0_1px_0_rgba(255,255,255,.04),0_14px_30px_rgba(0,0,0,.55)]"
        >
          <div className="space-y-3">
            <div className="h-6 w-2/3 bg-neutral-800 rounded" />
            <div className="h-4 w-1/2 bg-neutral-800 rounded" />
            <div className="h-4 w-1/3 bg-neutral-800 rounded" />
            <div className="h-9 w-full bg-neutral-800 rounded" />
          </div>
        </li>
      ))}
    </ul>
  );
}

function MiniCalendar28({ value, onChange }) {
  const days = useMemo(() => listNextDays(28), []);
  const isSelected = (iso) => iso === value;

  return (
    <div className="grid grid-cols-7 gap-2">
      {days.map((d) => {
        const day = d.date.getDay();
        const isOff = day === 5 || day === 6;
        const selected = isSelected(d.iso);
        return (
          <button
            key={d.iso}
            type="button"
            onClick={() => onChange(d.iso)}
            className={[
              "flex flex-col items-center justify-center gap-0.5 rounded-lg px-1.5 py-2 text-[11px] md:text-xs ring-1 transition",
              selected
                ? "text-white ring-blue-500 bg-blue-500/20"
                : "text-gray-200 ring-neutral-800 bg-neutral-900 hover:ring-neutral-600",
            ].join(" ")}
            aria-label={`${weekdayName(d.date)} ${d.date.getDate()}`}
          >
            <span className="font-medium leading-none">
              {weekdayShort(d.date)}
            </span>
            <span className="text-sm md:text-[13px] leading-none">
              {d.date.getDate()}
            </span>
            {isOff && (
              <span className="mt-1 text-[10px] px-1 py-0.5 rounded bg-amber-500/20 text-amber-300 ring-1 ring-amber-500/30">
                OFF
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

/* -------------------- helpers -------------------- */

function todayISO() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(
    2,
    "0"
  )}-${String(d.getDate()).padStart(2, "0")}`;
}
function listNextDays(n) {
  const out = [];
  const b = new Date();
  b.setHours(0, 0, 0, 0);
  for (let i = 0; i < n; i++) {
    const d = new Date(b);
    d.setDate(b.getDate() + i);
    const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(
      2,
      "0"
    )}-${String(d.getDate()).padStart(2, "0")}`;
    out.push({ date: d, iso });
  }
  return out;
}
function monthSpanLabel(n) {
  const s = new Date();
  s.setHours(0, 0, 0, 0);
  const e = new Date(s);
  e.setDate(e.getDate() + (n - 1));
  const same =
    s.getMonth() === e.getMonth() && s.getFullYear() === e.getFullYear();
  if (same)
    return s.toLocaleDateString(undefined, {
      month: "long",
      year: "numeric",
    });
  const a = s.toLocaleDateString(undefined, { month: "short" });
  const b = e.toLocaleDateString(undefined, {
    month: "short",
    year: "numeric",
  });
  return `${a}–${b}`;
}
function weekdayShort(d) {
  return ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][d.getDay()];
}
function weekdayName(d) {
  return [
    "Sunday",
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
  ][d.getDay()];
}
function formatTime12(hhmm) {
  if (!hhmm) return "";
  const [hStr, mStr] = hhmm.split(":");
  const h = +hStr;
  const m = +(mStr || 0);
  const ampm = h >= 12 ? "PM" : "AM";
  const hh = h % 12 || 12;
  return `${hh}:${String(m).padStart(2, "0")} ${ampm}`;
}
function hhmmToMinutes(hhmm) {
  if (!hhmm) return 0;
  const [hStr, mStr] = hhmm.split(":");
  const h = Number(hStr) || 0;
  const m = Number(mStr) || 0;
  return h * 60 + m;
}
function currentTimeMinutes() {
  const now = new Date();
  return now.getHours() * 60 + now.getMinutes();
}
