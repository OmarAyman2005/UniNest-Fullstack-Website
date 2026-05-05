"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { get, post, del } from "@/lib/api";

export default function SportsPage() {
  const [courts, setCourts] = useState([]);
  const [courtId, setCourtId] = useState("");
  const [date, setDate] = useState(todayISO());
  const [slots, setSlots] = useState([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState(null);

  const shakeRef = useRef(new Map());

  // modal state
  const [modal, setModal] = useState({
    open: false,
    mode: /** "reserve" | "cancel" */ null,
    slot: null,
  });

  // allow only students to access this page
  const router = useRouter();
  const [allowed, setAllowed] = useState(null); // null = checking, true = allowed, false = denied

  /* ---------------- Load courts once ---------------- */
  useEffect(() => {
    let cancel = false;
    (async () => {
      try {
        const json = await get("/sports/courts"); // { data: [...] }
        if (!cancel) setCourts(json?.data || []);
      } catch {
        if (!cancel) setCourts([]);
      }
    })();
    return () => {
      cancel = true;
    };
  }, []);

  /* -------- Load availability + current reservations on change -------- */
  useEffect(() => {
    if (!courtId || !date) return;

    let cancel = false;
    setLoading(true);
    setErr(null);

    (async () => {
      try {
        // 1) base availability (possible time windows)
        const availJson = await get(
          `/sports/courts/${encodeURIComponent(
            courtId
          )}/availability?date=${encodeURIComponent(date)}`
        ); // { data: [{start,end,premium?}, ...] }
        const avail = availJson?.data || [];

        // 2) reservations for that court/day (requires auth cookie; helper includes it)
        let reservations = [];
        try {
          const resJson = await get(
            `/sports/reservations?courtId=${encodeURIComponent(
              courtId
            )}&date=${encodeURIComponent(date)}`
          );
          reservations = resJson?.data || [];
        } catch {
          reservations = []; // unauthenticated -> treat as no reservations by me
        }

        // 3) merge – backend already gives reserverName + reserverGucId
        const reservedMap = new Map(
          reservations.map((r) => [
            `${r.start}-${r.end}`,
            {
              isMine: !!r.isMine,
              reserverName: r.reserverName || null,
              reserverGucId: r.reserverGucId || null,
            },
          ])
        );

        const merged = avail.map((s) => {
          const key = `${s.start}-${s.end}`;
          const hit = reservedMap.get(key);
          if (!hit) {
            return {
              ...s,
              reserved: false,
              isMine: false,
              reserverName: null,
              reserverGucId: null,
            };
          }

          const base = {
            ...s,
            reserved: true,
            isMine: !!hit.isMine,
            reserverName: null,
            reserverGucId: null,
          };

          // Only show name + id to *other* viewers, not to yourself
          if (!hit.isMine) {
            base.reserverName = hit.reserverName;
            base.reserverGucId = hit.reserverGucId;
          }

          return base;
        });

        if (!cancel) setSlots(merged);
      } catch {
        if (!cancel) {
          setErr("Could not load availability.");
          setSlots([]);
        }
      } finally {
        if (!cancel) setLoading(false);
      }
    })();

    return () => {
      cancel = true;
    };
  }, [courtId, date]);

  const minDate = todayISO();
  const maxDate = addDaysISO(14);

  // TODAY helpers for “completed/passed” logic
  const todayIso = todayISO();
  const isTodaySelected = date === todayIso;
  const nowMinutes = currentTimeMinutes();

  // actions
  const onSlotClick = (slot, key) => {
    const el = shakeRef.current.get(key);

    // If today & slot start time has already passed & not reserved -> completed, vibrate only
    const isPastToday =
      isTodaySelected &&
      !slot.reserved &&
      hhmmToMinutes(slot.start) < nowMinutes;

    if (isPastToday) {
      animateShake(el);
      return;
    }

    if (slot.reserved) {
      if (slot.isMine) {
        setModal({ open: true, mode: "cancel", slot });
      } else {
        // reserved by someone else -> vibrate only
        animateShake(el);
      }
    } else {
      setModal({ open: true, mode: "reserve", slot });
    }
  };

  const confirmAction = async () => {
    if (!modal.open || !modal.slot) return;
    const s = modal.slot;

    try {
      if (modal.mode === "reserve") {
        await post("/sports/reservations", {
          courtId,
          date,
          startTime: s.start,
          endTime: s.end,
        });
        // optimistic update
        setSlots((prev) =>
          prev.map((x) =>
            x.start === s.start && x.end === s.end
              ? {
                  ...x,
                  reserved: true,
                  isMine: true,
                  // hide name/id for yourself
                  reserverName: null,
                  reserverGucId: null,
                }
              : x
          )
        );
      } else if (modal.mode === "cancel") {
        await del("/sports/reservations", {
          body: { courtId, date, startTime: s.start },
          headers: { "Content-Type": "application/json" },
        });
        setSlots((prev) =>
          prev.map((x) =>
            x.start === s.start && x.end === s.end
              ? {
                  ...x,
                  reserved: false,
                  isMine: false,
                  reserverName: null,
                  reserverGucId: null,
                }
              : x
          )
        );
      }
      setModal({ open: false, mode: null, slot: null });
    } catch (e) {
      const status = e?.status ?? 0;
      if (status === 401) alert("You must be logged in to do this.");
      else if (status === 409) alert("This slot was already reserved.");
      else alert(e?.message || "Action failed.");
      setModal({ open: false, mode: null, slot: null });

      // soft refresh (re-pull availability + reservations)
      try {
        const [a, r] = await Promise.all([
          get(`/sports/courts/${courtId}/availability?date=${date}`),
          get(`/sports/reservations?courtId=${courtId}&date=${date}`),
        ]);
        const avail = a?.data || [];
        const resv = r?.data || [];

        const map = new Map(
          resv.map((x) => [
            `${x.start}-${x.end}`,
            {
              isMine: !!x.isMine,
              reserverName: x.reserverName || null,
              reserverGucId: x.reserverGucId || null,
            },
          ])
        );

        setSlots(
          avail.map((s) => {
            const key = `${s.start}-${s.end}`;
            const hit = map.get(key);
            if (!hit) {
              return {
                ...s,
                reserved: false,
                isMine: false,
                reserverName: null,
                reserverGucId: null,
              };
            }
            const base = {
              ...s,
              reserved: true,
              isMine: !!hit.isMine,
              reserverName: null,
              reserverGucId: null,
            };
            if (!hit.isMine) {
              base.reserverName = hit.reserverName;
              base.reserverGucId = hit.reserverGucId;
            }
            return base;
          })
        );
      } catch {
        /* ignore */
      }
    }
  };

  const closeModal = () => setModal({ open: false, mode: null, slot: null });

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const json = await get("/auth/me");
        const role = json?.user?.role ?? json?.role ?? null;
        if (!mounted) return;
        if (role === "student") setAllowed(true);
        else {
          setAllowed(false);
          router.replace("/404");
        }
      } catch (e) {
        if (!mounted) return;
        setAllowed(false);
        router.replace("/404");
      }
    })();

    return () => {
      mounted = false;
    };
  }, [router]);

  if (allowed === null) {
    return (
      <div className="py-8">
        <div className="mx-auto w-full max-w-5xl text-center text-gray-300">
          Checking access...
        </div>
      </div>
    );
  }

  if (!allowed) return null;

  return (
    <div className="py-8">
      <div className="mx-auto w-full max-w-5xl">
        <div className="rounded-2xl bg-neutral-900 ring-1 ring-neutral-800 shadow-[0_20px_40px_rgba(0,0,0,.45)]">
          {/* Header */}
          <div className="px-6 sm:px-8 pt-6">
            <h1 className="text-center text-2xl sm:text-3xl font-semibold text-white">
              Sports Courts Reservation
            </h1>

            {/* 🔹 Updated: split message into two centered lines */}
            <div className="mt-3 rounded-md bg-amber-500/10 text-amber-200 ring-1 ring-amber-500/30 px-4 py-2 text-sm text-center leading-relaxed">
              <p className="font-medium">
                Pick a court and a date to view the available 1-hour slots.
              </p>
              <p className="mt-1">
                Thursdays extend until 10 PM. Fridays have a single Premium block (2–4 PM).
                Saturdays are off.
              </p>
            </div>
          </div>

          {/* Controls + Calendar */}
          <div className="px-6 sm:px-8 pb-6 pt-4 space-y-6">
            {/* Court select */}
            <div className="flex flex-wrap items-center gap-3">
              <div className="w-full sm:w-80">
                <label htmlFor="court" className="sr-only">
                  Court
                </label>
                <div className="relative">
                  <select
                    id="court"
                    className="appearance-none w-full rounded-md bg-neutral-950 text-gray-100 ring-1 ring-neutral-700 focus:outline-none focus:ring-neutral-500 px-3 py-2"
                    value={courtId}
                    onChange={(e) => setCourtId(e.target.value)}
                  >
                    {!courtId && (
                      <option value="" disabled hidden>
                        Select a court…
                      </option>
                    )}
                    {courts.map((c) => (
                      <option key={c._id} value={c._id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                  <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-gray-400">
                    ▾
                  </span>
                </div>
              </div>
            </div>

            {/* Calendar */}
            <div className="rounded-xl ring-1 ring-neutral-800 bg-neutral-950 p-3">
              <MiniCalendar
                value={date}
                minISO={minDate}
                maxISO={maxDate}
                onChange={setDate}
              />
            </div>

            {/* Messages */}
            {!courtId && (
              <div className="rounded-md bg-amber-500/10 text-amber-200 ring-1 ring-amber-500/30 px-4 py-3 text-sm text-center leading-relaxed">
                Please select a court to view availability.
              </div>
            )}

            {courtId &&
              !loading &&
              !err &&
              slots.length === 0 &&
              isSaturday(date) && (
                <div className="rounded-md bg-amber-500/10 text-amber-200 ring-1 ring-amber-500/30 px-4 py-3 text-sm text-center">
                  🛌 Saturdays are off — no slots. Relax and recharge 😉
                </div>
              )}

            {loading && <SkeletonSlots />}

            {!loading && err && (
              <div className="rounded-md bg-red-500/10 text-red-200 ring-1 ring-red-500/30 px-4 py-3 text-sm">
                ⚠️ {err}
              </div>
            )}

            {!loading &&
              !err &&
              courtId &&
              slots.length === 0 &&
              !isSaturday(date) && (
                <div className="rounded-md bg-neutral-800 text-gray-200 ring-1 ring-neutral-700 px-4 py-3 text-sm">
                  No free slots for this day.
                </div>
              )}

            {/* Slots */}
            {!loading && !err && courtId && slots.length > 0 && (
              <ul className="grid gap-4 md:grid-cols-2">
                {slots.map((s, idx) => {
                  const key = `${s.start}-${s.end}-${idx}`;
                  const reserved = !!s.reserved;
                  const premium = !!s.premium;

                  const isPastToday =
                    isTodaySelected &&
                    !reserved &&
                    hhmmToMinutes(s.start) < nowMinutes;

                  // status label + pill colour
                  let statusLabel = "";
                  let statusClass = "";
                  if (isPastToday) {
                    statusLabel = "Completed";
                    statusClass =
                      "bg-neutral-700/40 text-gray-300 ring-neutral-500/70";
                  } else if (reserved) {
                    if (s.isMine) {
                      statusLabel = "Reserved (you)";
                      statusClass =
                        "bg-sky-500/15 text-sky-300 ring-sky-500/40";
                    } else {
                      statusLabel = "Reserved";
                      statusClass =
                        "bg-red-500/15 text-red-300 ring-red-500/40";
                    }
                  } else {
                    statusLabel = "Available";
                    statusClass =
                      "bg-emerald-500/15 text-emerald-300 ring-emerald-500/40";
                  }

                  const disableButton =
                    isPastToday || (reserved && !s.isMine);

                  return (
                    <li key={key}>
                      <button
                        ref={(el) => shakeRef.current.set(key, el)}
                        onClick={() => onSlotClick(s, key)}
                        className={[
                          "w-full text-left rounded-2xl px-4 py-3",
                          "bg-neutral-950 ring-2 ring-neutral-700",
                          "shadow-[inset_0_1px_0_rgba(255,255,255,.05),0_14px_30px_rgba(0,0,0,.55)]",
                          "hover:ring-neutral-500 transition",
                          "bg-gradient-to-b from-neutral-950 to-neutral-900",
                          disableButton ? "cursor-not-allowed" : "",
                        ].join(" ")}
                      >
                        <div className="flex items-center justify-between">
                          <div className="space-y-1">
                            <p className="text-white font-medium">
                              {formatTime12(s.start)} – {formatTime12(s.end)}
                            </p>

                            {premium && (
                              <span className="inline-flex items-center text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 ring-1 ring-amber-500/40">
                                ⭐ Premium (Fri)
                              </span>
                            )}

                            {/* show reserver name + GUC id for other users' reservations */}
                            {reserved &&
                              !s.isMine &&
                              (s.reserverName || s.reserverGucId) && (
                                <p className="text-[11px] text-gray-300/90">
                                  Reserved by{" "}
                                  {s.reserverName && (
                                    <span className="font-medium text-white">
                                      {s.reserverName}
                                    </span>
                                  )}
                                  {s.reserverGucId && (
                                    <>
                                      {" "}
                                      <span className="text-gray-400">
                                        ({s.reserverGucId})
                                      </span>
                                    </>
                                  )}
                                </p>
                              )}
                          </div>

                          <span
                            className={[
                              "inline-flex items-center text-xs font-semibold px-2.5 py-1 rounded-full ring-1",
                              statusClass,
                            ].join(" ")}
                          >
                            {statusLabel}
                          </span>
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      </div>

      {/* Confirm/Cancel modal */}
      {modal.open && modal.slot && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/60" onClick={closeModal} />
          <div className="relative z-10 w-full max-w-md rounded-2xl bg-neutral-900 ring-1 ring-neutral-700 p-5 text-gray-100 shadow-2xl">
            <h2 className="text-lg font-semibold mb-3">
              {modal.mode === "reserve"
                ? "Confirm Reservation"
                : "Cancel Reservation"}
            </h2>
            <p className="text-sm text-gray-300 mb-5">
              {formatTime12(modal.slot.start)} – {formatTime12(modal.slot.end)}{" "}
              on {new Date(date).toLocaleDateString()}
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
                {modal.mode === "reserve" ? "Confirm" : "Cancel reservation"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* local CSS */}
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

        /* Native dropdown theme (black) & single chevron */
        #court {
          appearance: none;
          background-color: #0a0a0a;
          color: #e5e7eb;
          border: 1px solid #3f3f46;
        }
        #court:focus {
          outline: none;
        }
        #court option {
          background-color: #0a0a0a !important;
          color: #e5e7eb !important;
          padding: 8px 12px !important;
          line-height: 1.6 !important;
          box-shadow: inset 0 -1px #2a2a2a !important;
        }
        #court option:checked {
          background-color: #27272a !important;
          color: #ffffff !important;
        }
        #court option:hover {
          background-color: #3f3f46 !important;
        }
      `}</style>
    </div>
  );
}

/* ------------ Mini 14-day calendar (unchanged) ------------ */
function MiniCalendar({ value, minISO, maxISO, onChange }) {
  const days = useMemo(() => listNextDays(14), []);
  const monthLabel = useMemo(() => {
    const d = new Date(value || todayISO());
    return d.toLocaleDateString(undefined, {
      month: "long",
      year: "numeric",
    });
  }, [value]);

  const isDisabled = (iso) => iso < minISO || iso > maxISO;

  return (
    <div>
      <div className="mb-2 text-sm text-gray-300">{monthLabel}</div>
      <div className="grid grid-cols-7 gap-2">
        {days.map((d) => {
          const iso = d.iso;
          const disabled = isDisabled(iso);
          const selected = iso === value;
          const isSat = d.date.getDay() === 6;

          return (
            <button
              key={iso}
              type="button"
              disabled={disabled}
              onClick={() => !disabled && onChange(iso)}
              className={[
                "flex flex-col items-center justify-center gap-0.5 rounded-lg px-2 py-2 text-xs ring-1 transition",
                disabled
                  ? "text-gray-500 ring-neutral-900 bg-neutral-950 cursor-not-allowed"
                  : selected
                  ? "text-white ring-blue-500 bg-blue-500/20"
                  : "text-gray-200 ring-neutral-800 bg-neutral-900 hover:ring-neutral-600",
              ].join(" ")}
              aria-label={`${weekdayName(d.date)} ${d.date.getDate()}`}
            >
              <span className="font-medium">{weekdayShort(d.date)}</span>
              <span className="text-sm">{d.date.getDate()}</span>
              {isSat && (
                <span className="mt-1 text-[10px] px-1 py-0.5 rounded bg-amber-500/20 text-amber-300 ring-1 ring-amber-500/30">
                  OFF
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ---------------- helpers ---------------- */
function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(
    2,
    "0"
  )}-${String(d.getDate()).padStart(2, "0")}`;
}
function addDaysISO(n) {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(
    2,
    "0"
  )}-${String(d.getDate()).padStart(2, "0")}`;
}
function isSaturday(iso) {
  return new Date(iso).getDay() === 6;
}
function formatTime12(hhmm) {
  if (!hhmm || typeof hhmm !== "string") return "";
  const [hStr, mStr] = hhmm.split(":");
  const h = Number(hStr);
  const m = Number(mStr);
  const ampm = h >= 12 ? "PM" : "AM";
  const hh = h % 12 || 12;
  return `${hh}:${String(m).padStart(2, "0")} ${ampm}`;
}
function listNextDays(n) {
  const out = [];
  const base = new Date();
  base.setHours(0, 0, 0, 0);
  for (let i = 0; i < n; i++) {
    const d = new Date(base);
    d.setDate(base.getDate() + i);
    const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(
      2,
      "0"
    )}-${String(d.getDate()).padStart(2, "0")}`;
    out.push({ date: d, iso });
  }
  return out;
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
function animateShake(el) {
  if (!el) return;
  el.classList.remove("shake");
  // force reflow
  // eslint-disable-next-line no-unused-expressions
  el.offsetWidth;
  el.classList.add("shake");
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

function SkeletonSlots() {
  return (
    <ul className="grid gap-4 md:grid-cols-2">
      {Array.from({ length: 6 }).map((_, i) => (
        <li
          key={i}
          className="rounded-2xl p-4 ring-1 ring-neutral-800 bg-neutral-950 animate-pulse shadow-[inset_0_1px_0_rgba(255,255,255,.04),0_12px_28px_rgba(0,0,0,.55)]"
        >
          <div className="h-5 w-1/2 bg-neutral-800 rounded mb-2" />
          <div className="h-4 w-1/3 bg-neutral-800 rounded" />
        </li>
      ))}
    </ul>
  );
}
