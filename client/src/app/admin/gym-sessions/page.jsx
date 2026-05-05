"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { api, gymSessionsUrl, post } from "@/lib/api";
import { FaUndo, FaListAlt } from "react-icons/fa";
import Link from "next/link";
import {
  GYM_CATEGORIES,
  GYM_TYPES,
  CATEGORY_EMOJI,
  TYPE_EMOJI,
  slotsForDateISO,
} from "@/lib/end-user/gymTaxonomy";

const COACHES_BY_TYPE = {
  // Mind–Body
  Yoga: ["Mona Nassar", "Hatem Sayed", "Noura Helal"],
  Pilates: ["Laila Kamal", "Omar Fouad", "Dalia Fares"],
  "Body Balance": ["Rania Tarek", "Hany Saad", "Mira Samir"],
  "Stretch & Flow": ["Yasmine Gaber", "Karim Morsi", "Sarah Adel"],
  Meditation: ["Adel Kamel", "Hanaa Reda", "Youssef Sami"],
  // Dance
  Zumba: ["Mira Hafez", "Karim Wael", "Aya Mansour"],
  "Dance Fitness": ["Sherif Nassar", "Dina Khattab", "Tarek Zaki"],
  "Hip-Hop Dance": ["Ziad Maher", "Layla Ramy", "Mostafa Anwar"],
  Step: ["Heba Emad", "Mahmoud Karam", "Nada Hisham"],
  "Cardio Dance": ["Rami Abou Zeid", "Sara Nabil", "Farah Soliman"],
  // Cardio
  Aerobics: ["Heba Nassar", "Omar Eid", "Nadine Badr"],
  HIIT: ["Ahmed Saber", "Mariam Adel", "Tamer Helmy"],
  Tabata: ["Salma Fekry", "Hazem Fathy", "Ola Tarek"],
  Spin: ["Hossam Magdy", "Rowan Fouda", "Ehab Tarek"],
  Bootcamp: ["Yousef Moneim", "Dina Sherif", "Anas Ezz"],
  "Cardio Circuit": ["Lana Adel", "Khaled Gamal", "Yara Saif"],
  // Strength
  "Cross Circuit": ["Mostafa Hady", "Rana Elwan", "Omar Hossny"],
  BodyPump: ["Nourhan Fathy", "Ali Kassem", "Menna Magdy"],
  "Functional Training": ["Hany Ashraf", "Reem Farouk", "Adham Saeed"],
  "Strength Basics": ["Aya Taha", "Mostafa Nabil", "Habiba Tarek"],
  "Core & Abs": ["Karim Tarek", "Nour Farid", "Lama Hossam"],
  TRX: ["Ola Maher", "Ramy Eid", "Maha Zain"],
  Kettlebell: ["Ibrahim Selim", "Shereen Hamed", "Tala Samy"],
  // Combat
  Kickboxing: ["Ahmed Aboul Fotouh", "Nour Elshenawy", "Bahaa Rady"],
  BoxFit: ["Yara Tamer", "Shady Raouf", "Lina Sherouk"],
  "MMA Fitness": ["Seif Ashour", "Mariam Nader", "Aly Elgamal"],
  "Self-Defense": ["Farida Osama", "Omar Hamdy", "Hager Hussein"],
  // Mobility
  "Stretch & Recovery": ["Nada ElSayed", "Mahmoud Reda", "Salma Hadi"],
  "Foam Rolling": ["Yasser Fares", "Rana Kamal", "Mina Boulos"],
  "Post-Workout Mobility": ["Menna Nasser", "Omar Shawky", "Lobna Kamel"],
  "Active Recovery": ["Khaled Tarek", "Mariam Helmy", "Nadine Omar"],
};

export default function AdminGymSessionsPage() {
  const today = todayLocalISO();

  // access control: only event_office may view this page
  const router = useRouter();
  const [hasAccess, setHasAccess] = useState(null); // null = checking, true = allowed, false = denied

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await api("/auth/me");
        let payload = res;
        if (res && typeof res.json === "function") payload = await res.json();
        const me = payload?.data ?? payload?.user ?? payload;
        if (!mounted) return;
        if (me?.role !== "event_office") {
          setHasAccess(false);
          router.replace("/404");
          return;
        }
        setHasAccess(true);
      } catch (err) {
        setHasAccess(false);
        router.replace("/404");
      }
    })();
    return () => {
      mounted = false;
    };
  }, [router]);

  const [category, setCategory] = useState("");
  const [type, setType] = useState("");
  const [coach, setCoach] = useState("");
  const [dateISO, setDateISO] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [capacity, setCapacity] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [msg, setMsg] = useState({ tone: "", text: "" });
  const [capacityErr, setCapacityErr] = useState("");
  const [showSuccess, setShowSuccess] = useState(false);

  const [bookedSet, setBookedSet] = useState(new Set());
  const shakeRef = useRef(new Map());

  const { minISO, maxISO, days } = useMemo(
    () => buildRollingDays28(today),
    [today]
  );

  const coaches = useMemo(
    () => (type ? COACHES_BY_TYPE[type] || [] : []),
    [type]
  );
  const isFriSat = useMemo(() => {
    if (!dateISO) return false;
    const d = new Date(dateISO);
    const g = d.getDay();
    return g === 5 || g === 6;
  }, [dateISO]);
  const slots = useMemo(
    () => (dateISO && !isFriSat ? slotsForDateISO(dateISO) : []),
    [dateISO, isFriSat]
  );

  const step1Category = Boolean(category);
  const step2Type = Boolean(step1Category && type);
  const step3Coach = Boolean(step2Type && coach);
  const step4Date = Boolean(step3Coach && dateISO);
  const step5Timing = Boolean(step4Date && startTime && endTime);

  const isTodaySelected = dateISO === today;
  const nowMinutes = currentTimeMinutes();

  function showOrderMsg(text) {
    setMsg({ tone: "error", text });
  }

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setBookedSet(new Set());
      if (!type || !dateISO) return;

      try {
        const url = new URL(gymSessionsUrl);
        url.searchParams.set("type", type);
        url.searchParams.set("date", dateISO);
        const res = await fetch(url.toString(), { cache: "no-store" });
        const raw = await safeJson(res);
        const list = Array.isArray(raw?.data) ? raw.data : [];
        const next = new Set(list.map((s) => `${s.startTime}-${s.endTime}`));
        if (!cancelled) setBookedSet(next);
      } catch {
        /* ignore */
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [type, dateISO]);

  function pickSlot([s, e], key) {
    if (!step4Date) {
      showOrderMsg(
        "Please choose a Date after selecting Category, Type, and Coach—then pick a timing."
      );
      return;
    }

    // TODAY: past timings vibrate & are not selectable
    if (isTodaySelected) {
      const mins = hhmmToMinutes(s);
      if (mins < nowMinutes) {
        const el = shakeRef.current.get(key);
        if (el) {
          el.classList.remove("shake");
          void el.offsetWidth;
          el.classList.add("shake");
        }
        return;
      }
    }

    const token = `${s}-${e}`;
    if (bookedSet.has(token)) {
      const el = shakeRef.current.get(key);
      if (el) {
        el.classList.remove("shake");
        void el.offsetWidth;
        el.classList.add("shake");
      }
      return;
    }
    setStartTime(s);
    setEndTime(e);
  }

  function validCapacity(v) {
    if (v === "" || v === null || typeof v === "undefined") return false;
    const n = Number(v);
    return Number.isInteger(n) && n >= 1 && n <= 30;
  }
  function handleCapacityChange(e) {
    const raw = e.target.value;
    setCapacity(raw);
    if (raw === "") return setCapacityErr("Capacity is required.");
    const n = Number(raw);
    if (!Number.isInteger(n)) setCapacityErr("Capacity must be an integer.");
    else if (n < 1 || n > 30)
      setCapacityErr("Capacity must be between 1 and 30.");
    else setCapacityErr("");
  }

  const canCreate =
    step5Timing &&
    validCapacity(capacity) &&
    !submitting &&
    !isFriSat &&
    !bookedSet.has(`${startTime}-${endTime}`);

  function handleCalendarPick(iso) {
    if (!step3Coach) {
      showOrderMsg(
        "Please choose Category, Type, and Coach before picking a date."
      );
      return;
    }
    setMsg({ tone: "", text: "" });
    setDateISO(iso);
    setStartTime("");
    setEndTime("");
  }

  async function submit(e) {
    e.preventDefault();
    setMsg({ tone: "", text: "" });

    if (!step1Category) return showOrderMsg("Please select a Category first.");
    if (!step2Type)
      return showOrderMsg("Please select a Type after choosing a Category.");
    if (!step3Coach)
      return showOrderMsg("Please select a Coach after choosing a Type.");
    if (!step4Date)
      return showOrderMsg("Please pick a Date after selecting a Coach.");
    if (isFriSat)
      return showOrderMsg(
        "Fridays and Saturdays are non-schedulable (policy). Choose Sunday–Thursday."
      );

    if (!step5Timing)
      return showOrderMsg("Please pick a Timing slot after selecting a Date.");
    if (!validCapacity(capacity)) {
      return showOrderMsg(
        capacityErr || "Capacity must be an integer between 1 and 30."
      );
    }

    if (bookedSet.has(`${startTime}-${endTime}`)) {
      return showOrderMsg(
        "This timing is already created for the selected type and date."
      );
    }

    setSubmitting(true);
    try {
      // ✅ cleanest way — your helper automatically adds credentials + base URL
      const data = await post("/sports/gym/sessions", {
        category,
        type,
        coachName: coach.trim(), // ✅ required by backend
        date: dateISO,
        startTime,
        endTime,
        capacity: Number(capacity),
      });

      setShowSuccess(true);

      setStartTime("");
      setEndTime("");
      setCapacity("");
      setCapacityErr("");

      setBookedSet((prev) => {
        const p = new Set(prev);
        p.add(`${data?.data?.startTime}-${data?.data?.endTime}`);
        return p;
      });

      setTimeout(() => setShowSuccess(false), 1600);
    } catch (e2) {
      setMsg({ tone: "error", text: String(e2.message || e2) });
    } finally {
      setSubmitting(false);
    }
  }

  // render while checking permissions
  if (hasAccess === null) return <main className="p-8">Checking permissions...</main>;
  if (hasAccess === false) return null;

  return (
    <div className="min-h-[calc(100vh-4rem)] py-8">
      {/* Back button in top-right */}
      <div className="flex items-center justify-end mb-4 px-4">
        <Link
          href="/admin"
          className="flex items-center gap-2 px-4 py-2 rounded-2xl btn-primary text-root-primary hover:bg-primary-hover transition"
        >
          <FaUndo className="text-lg" /> Home
        </Link>
      </div>

      {/* success overlay */}
      {showSuccess && (
        <div className="fixed inset-0 flex items-center justify-center z-50">
          <div className="absolute inset-0 bg-black/50" />
          <div className="relative z-10 rounded-2xl border border-emerald-500/40 bg-neutral-900 text-emerald-100 text-center px-8 py-6 shadow-xl">
            <div className="text-2xl font-semibold mb-1">Session created</div>
            <div className="text-sm opacity-90">
              Your gym session has been saved successfully.
            </div>
          </div>
        </div>
      )}

      {/* Dark panel wrapper to contrast the white page */}
      <section className="mx-auto max-w-4xl rounded-2xl bg-surface text-root-primary border border-root shadow-elevated p-6 md:p-8">
        {/* Title + Manage button row */}
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between mb-6">
          <h1 className="text-center md:text-left text-2xl md:text-3xl font-semibold">
            Create Gym Session
          </h1>
          <Link
            href="/admin/gym-sessions/manage"
            className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-2xl bg-highlight text-root-primary ring-1 ring-root hover:ring-primary-hover hover:text-white transition"
          >
            <FaListAlt className="text-base" />
            <span className="text-sm font-medium">Manage Gym Sessions</span>
          </Link>
        </div>

        {msg.text && (
          <div
            className={[
              "mb-6 rounded-xl p-4 ring-1",
              msg.tone === "error"
                ? "ring-red-500/40 bg-red-500/10 text-red-200"
                : "ring-emerald-500/40 bg-emerald-500/10 text-emerald-100",
            ].join(" ")}
          >
            {msg.text}
          </div>
        )}

        <form onSubmit={submit} className="space-y-6">
          {/* Category & Type */}
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block mb-1 text-sm text-root-secondary">
                Category
              </label>
              <select
                className="input-surface w-full"
                value={category}
                onChange={(e) => {
                  setCategory(e.target.value);
                  setType("");
                  setCoach("");
                  setDateISO("");
                  setStartTime("");
                  setEndTime("");
                  setMsg({ tone: "", text: "" });
                }}
              >
                <option value="" disabled hidden>
                  Choose…
                </option>
                {GYM_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {CATEGORY_EMOJI[c]} {c}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block mb-1 text-sm text-root-secondary">
                Type
              </label>
              <Gate
                blocked={!step1Category}
                reason="Select a Category first, then choose a Type."
                show={showOrderMsg}
              >
                <select
                  className={`input-surface w-full ${
                    !step1Category ? "opacity-60 cursor-not-allowed" : ""
                  }`}
                  value={type}
                  onChange={(e) => {
                    setType(e.target.value);
                    setCoach("");
                    setDateISO("");
                    setStartTime("");
                    setEndTime("");
                    setMsg({ tone: "", text: "" });
                  }}
                >
                  <option value="" disabled hidden>
                    Choose…
                  </option>
                  {(category ? GYM_TYPES[category] : []).map((t) => (
                    <option key={t} value={t}>
                      {TYPE_EMOJI[t]} {t}
                    </option>
                  ))}
                </select>
              </Gate>
            </div>
          </div>

          {/* Coach */}
          <div>
            <label className="block mb-1 text-sm text-root-secondary">
              Coach
            </label>
            <Gate
              blocked={!step2Type}
              reason="Select a Type after Category, then pick a Coach."
              show={showOrderMsg}
            >
              <select
                className={`input-surface w-full ${
                  !step2Type ? "opacity-60 cursor-not-allowed" : ""
                }`}
                value={coach}
                onChange={(e) => {
                  setCoach(e.target.value);
                  setDateISO("");
                  setStartTime("");
                  setEndTime("");
                  setMsg({ tone: "", text: "" });
                }}
              >
                <option value="" disabled hidden>
                  Choose…
                </option>
                {(coaches || []).map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </Gate>
          </div>

          {/* 28-day mini calendar */}
          <MiniCalendar28
            value={dateISO || today}
            days={days}
            minISO={minISO}
            maxISO={maxISO}
            disabled={!step3Coach}
            onTryBeforeEnabled={() =>
              showOrderMsg(
                "Please choose Category, Type, and Coach before picking a date."
              )
            }
            onChange={(iso) => handleCalendarPick(iso)}
          />

          {/* Availability */}
          {!step3Coach ? (
            <div className="rounded-xl border border-root bg-surface/60 p-4 text-root-primary">
              Please select a gym session (<b>category</b>, <b>type</b>, and{" "}
              <b>coach</b>) to view availability.
            </div>
          ) : !dateISO ? (
            <div className="rounded-xl border border-root bg-surface/60 p-4 text-root-primary">
              Pick a <b>date</b> to view its fixed timing slots.
            </div>
          ) : isFriSat ? (
            <div className="rounded-xl ring-1 ring-yellow-500/30 bg-yellow-500/10 p-4 text-yellow-100">
              ⚠️ Fridays and Saturdays are <b>non-schedulable</b> (policy).
              Please choose a day from <b>Sunday to Thursday</b>.
            </div>
          ) : (
            <div>
              <label className="block mb-2 text-sm text-primary">
                Pick a fixed timing
              </label>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2 max-w-2xl">
                {slots.map(([s, e], idx) => {
                  const key = `${s}-${e}-${idx}`;
                  const token = `${s}-${e}`;
                  const booked = bookedSet.has(token);
                  const selected = !booked && s === startTime && e === endTime;

                  const isPastToday =
                    isTodaySelected && hhmmToMinutes(s) < nowMinutes;

                  const buttonClasses = [
                    "rounded-full px-4 py-2 ring-1 transition flex items-center justify-between gap-3 bg-highlight",
                    isPastToday
                      ? "bg-highlight text-gray-400 ring-neutral-700 cursor-not-allowed opacity-70"
                      : booked
                      ? "bg-highlight text-gray-400 ring-neutral-700 cursor-not-allowed"
                      : selected
                      ? "bg-primary text-white ring-blue-500"
                      : "bg-highlight text-gray-200 ring-neutral-600 hover:ring-neutral-400",
                  ].join(" ");

                  let pillClass = "";
                  let pillLabel = "";
                  if (isPastToday) {
                    pillClass =
                      "bg-neutral-700/40 text-gray-300 ring-neutral-500/70";
                    pillLabel = "Completed";
                  } else if (booked) {
                    pillClass =
                      "bg-amber-500/15 text-amber-300 ring-amber-500/40";
                    pillLabel = "Booked";
                  } else {
                    pillClass =
                      "bg-emerald-500/15 text-emerald-300 ring-emerald-500/40";
                    pillLabel = "Available";
                  }

                  return (
                    <button
                      key={key}
                      ref={(el) => shakeRef.current.set(key, el)}
                      type="button"
                      onClick={() => pickSlot([s, e], key)}
                      className={buttonClasses}
                    >
                      <span>
                        {to12(s)} – {to12(e)}
                      </span>
                      <span
                        className={[
                          "text-[11px] px-2 py-0.5 rounded-full ring-1",
                          pillClass,
                        ].join(" ")}
                      >
                        {pillLabel}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Capacity */}
          <div>
            <label className="block mb-1 text-sm text-root-secondary">
              Max Participants
            </label>
            <Gate
              blocked={!step5Timing}
              reason="Pick a Date and a Timing slot before entering Capacity."
              show={showOrderMsg}
            >
              <input
                className={`input-surface w-full ${
                  !step5Timing ? "opacity-60 cursor-not-allowed" : ""
                }`}
                type="number"
                min={1}
                max={30}
                step={1}
                placeholder="1–30"
                value={capacity}
                onChange={handleCapacityChange}
              />
            </Gate>
            {capacityErr && (
              <p className="text-sm mt-1 text-red-300">{capacityErr}</p>
            )}
          </div>

          <button
            type="submit"
            className="btn btn-primary w-full disabled:opacity-60"
            disabled={!canCreate}
          >
            {submitting ? "Creating…" : "Create"}
          </button>
        </form>
      </section>

      {/* shake animation */}
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

/* ---------------- Gate ---------------- */
function Gate({ blocked, reason, show, children }) {
  return (
    <div className="relative">
      {children}
      {blocked && (
        <button
          type="button"
          onClick={() => show?.(reason)}
          title={reason}
          aria-label={reason}
          className="absolute inset-0 cursor-not-allowed bg-transparent"
          style={{ pointerEvents: "auto" }}
        />
      )}
    </div>
  );
}

/* ---------------- MiniCalendar28 ---------------- */
function MiniCalendar28({
  value,
  days,
  minISO,
  maxISO,
  disabled,
  onTryBeforeEnabled,
  onChange,
}) {
  const label = useMemo(() => labelForRange(days), [days]);

  return (
    <section>
      <div className="mb-2 text-sm text-primary text-left">{label}</div>
      <div
        className={`rounded-xl ring-1 ring-neutral-700 bg-highlight p-3 ${
          disabled ? "opacity-60" : ""
        }`}
      >
        <div className="grid grid-cols-7 gap-2">
          {days.map((d) => {
            const iso = d.iso;
            const selected = iso === value;
            const isOff = d.dow === 5 || d.dow === 6;
            const outOfRange = iso < minISO || iso > maxISO;
            const isDisabled = disabled || outOfRange;

            return (
              <button
                key={iso}
                type="button"
                disabled={isDisabled}
                onClick={() =>
                  !isDisabled ? onChange(iso) : onTryBeforeEnabled?.()
                }
                className={[
                  "flex flex-col items-center justify-center gap-0.5 bg-highlight rounded-lg px-2 py-2 text-xs ring-1 transition",
                  isDisabled
                    ? "text-gray-500 ring-neutral-800 bg-highlight cursor-not-allowed"
                    : selected
                    ? "text-white ring-blue-500 bg-primary"
                    : "text-gray-200 ring-neutral-700 bg-highlight hover:ring-neutral-500",
                ].join(" ")}
                aria-label={`${weekdayName(d.date)} ${d.date.getDate()}`}
                title={
                  isOff
                    ? "Friday/Saturday (non-schedulable)"
                    : d.date.toDateString()
                }
              >
                <span className="font-medium">{weekdayShort(d.date)}</span>
                <span className="text-sm">{d.date.getDate()}</span>
                {isOff && (
                  <span className="mt-0.5 text-[10px] px-1 rounded-full bg-highlight text-gray-300">
                    OFF
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}

/* ---------------- helpers ---------------- */
function todayLocalISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(
    2,
    "0"
  )}-${String(d.getDate()).padStart(2, "0")}`;
}
function buildRollingDays28(startISO) {
  const start = isoToLocalDate(startISO);
  const out = [];
  for (let i = 0; i < 28; i++) {
    const di = new Date(start);
    di.setDate(start.getDate() + i);
    out.push({ date: di, iso: localDateToISO(di), dow: di.getDay() });
  }
  return { minISO: out[0].iso, maxISO: out[out.length - 1].iso, days: out };
}
function isoToLocalDate(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d, 0, 0, 0, 0);
}
function localDateToISO(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(
    2,
    "0"
  )}-${String(d.getDate()).padStart(2, "0")}`;
}
function to12(hhmm) {
  const [h, m] = hhmm.split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  const hh = h % 12 || 12;
  return `${hh}:${String(m).padStart(2, "0")} ${ampm}`;
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
function labelForRange(days) {
  const first = days[0].date,
    last = days[days.length - 1].date;
  const sameMonth =
    first.getMonth() === last.getMonth() &&
    first.getFullYear() === last.getFullYear();
  if (sameMonth)
    return first.toLocaleDateString(undefined, {
      month: "long",
      year: "numeric",
    });
  const a = first.toLocaleDateString(undefined, { month: "short" });
  const b = last.toLocaleDateString(undefined, {
    month: "short",
    year: "numeric",
  });
  return `${a}–${b}`;
}
async function safeJson(res) {
  try {
    return await res.json();
  } catch {
    return null;
  }
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
