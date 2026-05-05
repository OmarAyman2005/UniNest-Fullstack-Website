"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  FaUndo,
  FaTrash,
  FaEdit,
  FaTimesCircle,
  FaFilter,
  FaSortAlphaDown,
  FaSortAlphaUp,
} from "react-icons/fa";
import { api } from "@/lib/api";

/* ================== TIME / SLOT HELPERS ================== */

function pad(n) {
  return String(n).padStart(2, "0");
}
function toMinutes(hhmm) {
  const [h, m] = String(hhmm).split(":").map(Number);
  return h * 60 + m;
}
function fromMinutes(mins) {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${pad(h)}:00`;
}
function nextHour(hhmm) {
  const [hStr] = String(hhmm).split(":");
  const h = Number(hStr);
  const next = (h + 1) % 24;
  return `${pad(next)}:00`;
}
function formatTime12(hhmm) {
  if (!hhmm) return "";
  const [hStr, mStr] = String(hhmm).split(":");
  const h = Number(hStr);
  const m = Number(mStr || 0);
  const ampm = h >= 12 ? "PM" : "AM";
  const hh = h % 12 || 12;
  return `${hh}:${pad(m)} ${ampm}`;
}
function formatSlotLabel(start) {
  const end = nextHour(start);
  return `${formatTime12(start)} – ${formatTime12(end)}`;
}

function buildHourRange(fromHour, toHour) {
  const arr = [];
  for (let h = fromHour; h < toHour; h++) {
    arr.push(`${pad(h)}:00`);
  }
  return arr;
}

function todayMidnight() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * Slots for a single concrete date (used in edit modal)
 * - Sun–Wed: 8–16
 * - Thu: 8–22
 * - Fri/Sat: OFF
 * - If the chosen date is TODAY → only return future time slots
 */
function slotsForDateISO(dateISO) {
  if (!dateISO) return [];
  const d = new Date(dateISO);
  const dow = d.getDay(); // 0 Sun .. 6 Sat

  // Fri / Sat off
  if (dow === 5 || dow === 6) return [];

  // base slots by weekday
  let baseSlots;
  if (dow === 4) {
    baseSlots = buildHourRange(8, 22); // Thu 8–9 ... 9–10pm
  } else {
    baseSlots = buildHourRange(8, 16); // Sun–Wed 8–9 ... 3–4pm
  }

  // if not today → return all valid slots
  const now = new Date();
  const isToday =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();

  if (!isToday) return baseSlots;

  // if TODAY → filter out slots whose start time has already passed
  const nowMinutes = now.getHours() * 60 + now.getMinutes();

  return baseSlots.filter((start) => {
    const [hStr] = start.split(":");
    const slotMinutes = Number(hStr) * 60;
    return slotMinutes > nowMinutes; // only future slots are editable
  });
}

const EMPTY_FILTERS = { from: "", to: "", timing: "" };

/* ================== MAIN PAGE ================== */

export default function ManageGymSessionsPage() {
  const router = useRouter();

  const [allSessions, setAllSessions] = useState([]);
  const [upcoming, setUpcoming] = useState([]);
  const [past, setPast] = useState([]);
  const [cancelled, setCancelled] = useState([]);

  const [filters, setFilters] = useState({
    upcoming: { ...EMPTY_FILTERS },
    past: { ...EMPTY_FILTERS },
    cancelled: { ...EMPTY_FILTERS },
  });

  const [sorts, setSorts] = useState({
    upcoming: { field: "date", asc: true },
    past: { field: "date", asc: true },
    cancelled: { field: "date", asc: true },
  });

  // array of messages per table
  const [errors, setErrors] = useState({
    upcoming: [],
    past: [],
    cancelled: [],
  });

  const [applied, setApplied] = useState({
    upcoming: false,
    past: false,
    cancelled: false,
  });

  // centred toast
  const [toast, setToast] = useState({ kind: "", text: "" });

  const [loading, setLoading] = useState(false);

  // modals
  const [editing, setEditing] = useState(null); // {session, dateISO, timing, errors, saving}
  const [confirmCancel, setConfirmCancel] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [confirmBulkDelete, setConfirmBulkDelete] = useState(null);

  /* ---------- initial fetch: ALL sessions (admin endpoint) ---------- */
  useEffect(() => {
    let cancelledFlag = false;
    (async () => {
      try {
        setLoading(true);
        const json = await api("/sports/gym/sessions/admin");
        const list = Array.isArray(json?.data) ? json.data : [];
        if (cancelledFlag) return;
        setAllSessions(list);
      } catch (e) {
        if (cancelledFlag) return;
        console.error(e);
        showToast("error", "Could not load gym sessions list.");
      } finally {
        if (!cancelledFlag) setLoading(false);
      }
    })();
    return () => {
      cancelledFlag = true;
    };
  }, []);

  /* ---------- split into upcoming / past / cancelled whenever allSessions changes ---------- */
  useEffect(() => {
    const nowMid = todayMidnight();
    const up = [];
    const pa = [];
    const can = [];

    for (const s of allSessions) {
      const d = new Date(s.date);
      d.setHours(0, 0, 0, 0);

      if (s.status === "cancelled") {
        can.push(s);
      } else if (d < nowMid) {
        pa.push(s);
      } else {
        up.push(s);
      }
    }

    setUpcoming(up);
    setPast(pa);
    setCancelled(can);
  }, [allSessions]);

  /* ================== GENERAL HELPERS ================== */

  function showToast(kind, text) {
    setToast({ kind, text });
    if (text) {
      setTimeout(() => {
        setToast((t) => (t.text === text ? { kind: "", text: "" } : t));
      }, 2200);
    }
  }

  function onFilterChange(tableKey, field, value) {
    setFilters((prev) => {
      const nextTable = { ...prev[tableKey], [field]: value };
      const next = { ...prev, [tableKey]: nextTable };
      setApplied((old) => ({ ...old, [tableKey]: true }));
      setErrors((old) => ({
        ...old,
        [tableKey]: validateFilters(tableKey, nextTable),
      }));
      return next;
    });
  }

  function applyDateTimingFilter(list, tableKey) {
    const { from, to, timing } = filters[tableKey];

    return list.filter((s) => {
      const d = new Date(s.date);
      d.setHours(0, 0, 0, 0);

      if (from) {
        const f = new Date(from);
        f.setHours(0, 0, 0, 0);
        if (d < f) return false;
      }
      if (to) {
        const t = new Date(to);
        t.setHours(0, 0, 0, 0);
        if (d > t) return false;
      }
      if (timing && s.startTime !== timing) return false;

      return true;
    });
  }

  function sortList(list, tableKey) {
    const { field, asc } = sorts[tableKey];
    const copy = [...list];

    copy.sort((a, b) => {
      let va = a[field];
      let vb = b[field];

      if (field === "date") {
        va = new Date(a.date).getTime();
        vb = new Date(b.date).getTime();
      }

      if (va < vb) return asc ? -1 : 1;
      if (va > vb) return asc ? 1 : -1;
      return 0;
    });

    return copy;
  }

  function validateFilters(tableKey, f) {
    const { from, to } = f;
    const msgs = [];
    if (!from && !to) return msgs;

    const now = todayMidnight();
    const fDate = from ? new Date(from) : null;
    const tDate = to ? new Date(to) : null;
    if (fDate) fDate.setHours(0, 0, 0, 0);
    if (tDate) tDate.setHours(0, 0, 0, 0);

    if (tableKey === "upcoming") {
      if (fDate && fDate < now)
        msgs.push("For upcoming sessions, ‘From’ must not be in the past.");
      if (tDate && tDate < now)
        msgs.push("For upcoming sessions, ‘To’ must not be in the past.");
    } else if (tableKey === "past") {
      if (fDate && fDate >= now)
        msgs.push("For past sessions, ‘From’ must be in the past.");
      if (tDate && tDate >= now)
        msgs.push("For past sessions, ‘To’ must be in the past.");
    }

    if (fDate && tDate && tDate < fDate) {
      msgs.push("‘To’ date cannot be before ‘From’ date.");
    }

    return msgs;
  }

  // timing dropdown options per table, based on date range
  function computeTimingOptions(tableKey) {
    const { from, to } = filters[tableKey];
    if (!from && !to) {
      return buildHourRange(8, 22); // generic default
    }

    const start = new Date(from || to);
    const end = new Date(to || from);
    start.setHours(0, 0, 0, 0);
    end.setHours(0, 0, 0, 0);
    if (end < start) return buildHourRange(8, 22);

    let hasSunWed = false;
    let hasThu = false;
    let onlyFriSat = true;

    const cur = new Date(start);
    while (cur <= end) {
      const dow = cur.getDay();
      if (dow >= 0 && dow <= 3) {
        hasSunWed = true;
        onlyFriSat = false;
      } else if (dow === 4) {
        hasThu = true;
        onlyFriSat = false;
      } else if (dow === 5 || dow === 6) {
        // Fri/Sat
      } else {
        onlyFriSat = false;
      }
      cur.setDate(cur.getDate() + 1);
    }

    if (onlyFriSat) return [];
    if (hasThu) return buildHourRange(8, 22);
    if (hasSunWed) return buildHourRange(8, 16);
    return buildHourRange(8, 22);
  }

  /* ================== EDIT / CANCEL / DELETE LOGIC ================== */

  function handleEditClick(session) {
    setEditing({
      session,
      dateISO: "", // start empty, like filters
      timing: "",
      errors: [],
      saving: false,
    });
  }

  async function handleEditSave() {
    if (!editing || editing.saving) return;
    const { session, dateISO, timing } = editing;
    const newErrors = [];

    const today = todayMidnight();

    // Date validations
    if (!dateISO) {
      newErrors.push("Please choose a new date for the session.");
    } else {
      const d = new Date(dateISO);
      d.setHours(0, 0, 0, 0);
      if (Number.isNaN(d.getTime())) {
        newErrors.push("The chosen date is invalid.");
      } else if (d < today) {
        newErrors.push("Date cannot be in the past.");
      } else {
        // if same day, timing must be in future
        if (timing) {
          const now = new Date();
          const nowMinutes = now.getHours() * 60 + now.getMinutes();
          const slotMinutes = toMinutes(timing);
          const isSameDay =
            d.getFullYear() === today.getFullYear() &&
            d.getMonth() === today.getMonth() &&
            d.getDate() === today.getDate();

          if (isSameDay && slotMinutes <= nowMinutes) {
            newErrors.push(
              "For today, please choose a timing that has not already passed."
            );
          }
        }
      }
    }

    if (!timing) {
      newErrors.push("Please choose a new timing slot.");
    }

    if (newErrors.length) {
      setEditing((ed) => ({ ...ed, errors: newErrors }));
      return;
    }

    try {
      setEditing((ed) => ({ ...ed, saving: true, errors: [] }));

      const payload = {
        date: dateISO,
        startTime: timing,
        endTime: nextHour(timing),
      };

      const json = await api(`/sports/gym/sessions/${session._id}/admin`, {
        method: "PATCH",
        body: payload,
      });

      const updated = json?.data ?? json;

      setAllSessions((prev) =>
        prev.map((s) => (String(s._id) === String(updated._id) ? updated : s))
      );

      setEditing(null);
      showToast("edit", "Session updated successfully.");
    } catch (e) {
      console.error(e);
      const msg =
        e?.message ||
        "Could not update session. Slot may already exist for this type/date.";
      setEditing((ed) => ({
        ...ed,
        saving: false,
        errors: [msg],
      }));
    }
  }

  function handleCancelClick(session) {
    setConfirmCancel(session);
  }

  async function confirmCancelSession() {
    if (!confirmCancel) return;
    const s = confirmCancel;
    try {
      const json = await api(`/sports/gym/sessions/${s._id}/admin-cancel`, {
        method: "POST",
      });
      const updated = json?.data ?? json;

      setAllSessions((prev) =>
        prev.map((x) => (String(x._id) === String(updated._id) ? updated : x))
      );
      showToast("cancel", "Session cancelled and moved to Cancelled Sessions.");
    } catch (e) {
      console.error(e);
      showToast("error", "Failed to cancel session.");
    } finally {
      setConfirmCancel(null);
    }
  }

  function handleDeleteClick(session) {
    setConfirmDelete(session);
  }

  async function confirmDeleteSession() {
    if (!confirmDelete) return;
    const s = confirmDelete;
    try {
      await api(`/sports/gym/sessions/${s._id}/admin`, {
        method: "DELETE",
      });
      setAllSessions((prev) =>
        prev.filter((x) => String(x._id) !== String(s._id))
      );
      showToast("delete-one", "Session permanently deleted.");
    } catch (e) {
      console.error(e);
      showToast("error", "Failed to delete session.");
    } finally {
      setConfirmDelete(null);
    }
  }

  function handleDeleteAll(tableKey) {
    const scope = tableKey === "past" ? "past" : "cancelled";
    setConfirmBulkDelete({ tableKey, scope });
  }

  async function confirmDeleteAllSessions() {
    if (!confirmBulkDelete) return;
    const { scope } = confirmBulkDelete;
    try {
      const json = await api(`/sports/gym/sessions/admin?scope=${scope}`, {
        method: "DELETE",
      });
      const deletedCount = json?.deletedCount ?? json?.data?.deletedCount;

      if (deletedCount >= 0) {
        setAllSessions((prev) =>
          prev.filter((s) => {
            const d = new Date(s.date);
            d.setHours(0, 0, 0, 0);
            const now = todayMidnight();

            if (scope === "past") {
              return !(s.status === "active" && d < now);
            }
            return s.status !== "cancelled";
          })
        );
      }

      showToast(
        "delete-all",
        deletedCount
          ? `Deleted ${deletedCount} ${scope} session(s).`
          : "No sessions matched this scope."
      );
    } catch (e) {
      console.error(e);
      showToast("error", "Failed to delete sessions.");
    } finally {
      setConfirmBulkDelete(null);
    }
  }

  /* ================== TABLE RENDERING ================== */

  function renderTable(title, tableKey, baseList) {
    const timingOptions = computeTimingOptions(tableKey);
    const timingDisabled = timingOptions.length === 0;
    const tableErrors = errors[tableKey];
    const hasApplied = applied[tableKey];
    const sortObj = sorts[tableKey];
    const f = filters[tableKey];
    const showDeleteAll = tableKey === "past" || tableKey === "cancelled";

    // ✅ NEW: only consider filters "active" when both dates are chosen
    const bothDatesChosen = Boolean(f.from && f.to);

    const filtered =
      hasApplied && tableErrors.length === 0 && bothDatesChosen
        ? sortList(applyDateTimingFilter(baseList, tableKey), tableKey)
        : [];

    return (
      <section className="mb-12">
        {/* header row */}
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xl font-semibold">{title}</h2>
          {showDeleteAll && (
            <button
              type="button"
              onClick={() => handleDeleteAll(tableKey)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-2xl bg-red-500/20 text-red-200 hover:bg-red-500/30 text-sm"
            >
              <FaTrash /> Delete All
            </button>
          )}
        </div>

        {/* filters + sorting card */}
        <div className="bg-[#1E2533] border-2 border-white/70 rounded-2xl p-4 md:p-5 mb-3 space-y-4 shadow-[0_0_0_1px_rgba(255,255,255,0.06)]">
          {/* filters label row */}
          <div className="flex items-center justify-between gap-3 mb-1">
            <span className="text-xs uppercase tracking-wide text-root-secondary flex items-center gap-2">
              <FaFilter className="text-[11px]" />
              FILTERS
            </span>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-highlight/70 text-root-secondary">
              Live — applied instantly
            </span>
          </div>

          {/* filters row */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-root-secondary">
                From
              </label>
              <input
                type="date"
                className="input-surface h-9 text-sm"
                value={f.from}
                onChange={(e) =>
                  onFilterChange(tableKey, "from", e.target.value)
                }
                placeholder="dd/mm/yyyy"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-root-secondary">
                To
              </label>
              <input
                type="date"
                className="input-surface h-9 text-sm"
                value={f.to}
                onChange={(e) =>
                  onFilterChange(tableKey, "to", e.target.value)
                }
                placeholder="dd/mm/yyyy"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-root-secondary">
                Timing
              </label>
              <select
                className="input-surface h-9 text-sm"
                value={f.timing}
                disabled={timingDisabled}
                onChange={(e) =>
                  onFilterChange(tableKey, "timing", e.target.value)
                }
              >
                <option value="">All</option>
                {timingOptions.map((start) => (
                  <option key={start} value={start}>
                    {formatSlotLabel(start)}
                  </option>
                ))}
              </select>
              {timingDisabled && (
                <p className="mt-1 text-[11px] text-amber-300">
                  Range includes only Fri/Sat → no available timing slots.
                </p>
              )}
            </div>
          </div>

          {/* separator + sorting */}
          <div className="border-t-2 border-white/80 pt-3 grid grid-cols-1 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-4">
            {/* sorting row */}
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-root-secondary">
                Sort by
              </label>
              <select
                className="input-surface h-9 text-sm"
                value={sortObj.field}
                onChange={(e) =>
                  setSorts((prev) => ({
                    ...prev,
                    [tableKey]: {
                      ...prev[tableKey],
                      field: e.target.value,
                    },
                  }))
                }
              >
                <option value="category">Category</option>
                <option value="type">Type</option>
                <option value="coachName">Coach</option>
                <option value="date">Date</option>
                <option value="startTime">Timing</option>
                <option value="booked">Current Capacity</option>
                <option value="capacity">Max Capacity</option>
              </select>
            </div>
            <div className="flex flex-col gap-1 sm:items-start">
              <label className="text-xs font-medium text-root-secondary">
                Order
              </label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() =>
                    setSorts((prev) => ({
                      ...prev,
                      [tableKey]: { ...prev[tableKey], asc: true },
                    }))
                  }
                  className={
                    "px-3 h-9 rounded-full text-xs font-medium border flex items-center justify-center gap-1 " +
                    (sortObj.asc
                      ? "bg-primary text-root-primary border-primary"
                      : "bg-transparent text-root-secondary border-neutral-700 hover:border-neutral-500")
                  }
                >
                  <FaSortAlphaDown className="text-[11px]" />
                  A–Z
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setSorts((prev) => ({
                      ...prev,
                      [tableKey]: { ...prev[tableKey], asc: false },
                    }))
                  }
                  className={
                    "px-3 h-9 rounded-full text-xs font-medium border flex items-center justify-center gap-1 " +
                    (!sortObj.asc
                      ? "bg-primary text-root-primary border-primary"
                      : "bg-transparent text-root-secondary border-neutral-700 hover:border-neutral-500")
                  }
                >
                  <FaSortAlphaUp className="text-[11px]" />
                  Z–A
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* error boxes */}
        {tableErrors.length > 0 && hasApplied && (
          <div className="mb-3 space-y-2">
            {tableErrors.map((msg, idx) => (
              <div
                key={idx}
                className="rounded-xl p-3 bg-red-500/15 text-red-200 ring-1 ring-red-500/40 text-sm"
              >
                {msg}
              </div>
            ))}
          </div>
        )}

        {/* table content */}
        <div className="overflow-x-auto border border-root rounded-xl">
          {!hasApplied || !bothDatesChosen ? (
            <div className="p-4 text-center text-root-secondary">
              Use filters to display corresponding sessions.
            </div>
          ) : tableErrors.length > 0 ? (
            <div className="p-4 text-center text-red-200 text-sm">
              Please fix the filter errors above.
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-4 text-center text-root-secondary text-sm">
              No sessions found for the selected filters.
            </div>
          ) : (
            <table className="w-full text-sm border-collapse">
              <thead className="bg-highlight text-left text-root-secondary">
                <tr>
                  <th className="px-3 py-2">Category</th>
                  <th className="px-3 py-2">Type</th>
                  <th className="px-3 py-2">Coach</th>
                  <th className="px-3 py-2">Date</th>
                  <th className="px-3 py-2">Timing</th>
                  <th className="px-3 py-2">Current Capacity</th>
                  <th className="px-3 py-2">Max Capacity</th>
                  <th className="px-3 py-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((s) => (
                  <tr
                    key={s._id}
                    className="border-t border-neutral-800 hover:bg-surface/40 transition"
                  >
                    <td className="px-3 py-2">{s.category}</td>
                    <td className="px-3 py-2">{s.type}</td>
                    <td className="px-3 py-2">{s.coachName}</td>
                    <td className="px-3 py-2">
                      {new Date(s.date).toLocaleDateString()}
                    </td>
                    <td className="px-3 py-2">
                      {formatTime12(s.startTime)} –{" "}
                      {formatTime12(s.endTime)}
                    </td>
                    <td className="px-3 py-2">{s.booked ?? 0}</td>
                    <td className="px-3 py-2">{s.capacity}</td>
                    <td className="px-3 py-2">
                      <div className="flex justify-end gap-2">
                        {tableKey === "upcoming" && (
                          <>
                            <button
                              type="button"
                              onClick={() => handleEditClick(s)}
                              className="p-1.5 rounded-full bg-blue-500/15 text-blue-300 hover:bg-blue-500/25"
                              title="Edit session"
                            >
                              <FaEdit />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleCancelClick(s)}
                              className="p-1.5 rounded-full bg-yellow-500/15 text-yellow-300 hover:bg-yellow-500/25"
                              title="Cancel session"
                            >
                              <FaTimesCircle />
                            </button>
                          </>
                        )}
                        {tableKey !== "upcoming" && (
                          <button
                            type="button"
                            onClick={() => handleDeleteClick(s)}
                            className="p-1.5 rounded-full bg-red-500/15 text-red-300 hover:bg-red-500/25"
                            title="Delete session"
                          >
                            <FaTrash />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>
    );
  }

  /* ================== MAIN RENDER ================== */

  const upcomingList = useMemo(() => upcoming, [upcoming]);
  const pastList = useMemo(() => past, [past]);
  const cancelledList = useMemo(() => cancelled, [cancelled]);

  return (
    <main className="manage-gym-sessions min-h-[calc(100vh-4rem)] p-6 md:p-10 text-root-primary">
      {/* title + back */}
      <div className="mb-8 text-center">
        <h1 className="text-2xl md:text-3xl font-semibold">
          Manage Gym Sessions
        </h1>
        <div className="mt-4 flex justify-center">
          <Link
            href="/admin/gym-sessions"
            className="flex items-center gap-2 px-4 py-2 rounded-2xl btn-primary text-root-primary hover:bg-primary-hover transition"
          >
            <FaUndo className="text-lg" /> Back
          </Link>
        </div>
      </div>

      {/* centred toast */}
      {toast.text && (
        <div className="fixed inset-0 z-40 flex items-center justify-center pointer-events-none">
          <div className="pointer-events-auto w-full max-w-md px-4">
            <ToastInner kind={toast.kind} text={toast.text} />
          </div>
        </div>
      )}

      {loading ? (
        <div className="text-center text-root-secondary">
          Loading sessions…
        </div>
      ) : (
        <>
          {renderTable("Ongoing / Upcoming Sessions", "upcoming", upcomingList)}
          {renderTable("Past Sessions", "past", pastList)}
          {renderTable("Cancelled Sessions", "cancelled", cancelledList)}
        </>
      )}

      {/* Edit modal */}
      {editing && (
        <div className="fixed inset-0 z-40 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/60" />
          <div className="relative z-50 w-full max-w-md bg-surface border border-root rounded-2xl p-6">
            <h2 className="text-xl font-semibold mb-1">Edit Session</h2>
            <p className="text-xs text-root-secondary mb-4">
              Current:{" "}
              {new Date(editing.session.date).toLocaleDateString()} ·{" "}
              {formatTime12(editing.session.startTime)} –{" "}
              {formatTime12(editing.session.endTime)}
            </p>
            <div className="space-y-4 mb-4">
              <div>
                <label className="block text-sm mb-1 text-root-secondary">
                  Date
                </label>
                <input
                  type="date"
                  className="input-surface w-full"
                  placeholder="dd/mm/yyyy"
                  value={editing.dateISO}
                  onChange={(e) =>
                    setEditing((ed) => ({
                      ...ed,
                      dateISO: e.target.value,
                      timing: "",
                      errors: [],
                    }))
                  }
                />
              </div>
              <div>
                <label className="block text-sm mb-1 text-root-secondary">
                  Timing
                </label>
                <select
                  className="input-surface w-full"
                  value={editing.timing}
                  disabled={
                    !editing.dateISO ||
                    slotsForDateISO(editing.dateISO).length === 0
                  }
                  onChange={(e) =>
                    setEditing((ed) => ({
                      ...ed,
                      timing: e.target.value,
                      errors: [],
                    }))
                  }
                >
                  <option value="">Choose…</option>
                  {slotsForDateISO(editing.dateISO).map((start) => (
                    <option key={start} value={start}>
                      {formatSlotLabel(start)}
                    </option>
                  ))}
                </select>
                {editing.dateISO &&
                  slotsForDateISO(editing.dateISO).length === 0 && (
                    <p className="mt-1 text-xs text-amber-300">
                      Fridays and Saturdays are OFF, or all slots for today
                      have already passed. Choose another date/time.
                    </p>
                  )}
              </div>
              {editing.errors.length > 0 && (
                <div className="space-y-2">
                  {editing.errors.map((msg, idx) => (
                    <div
                      key={idx}
                      className="rounded-md bg-red-500/15 text-red-200 text-xs px-3 py-2 ring-1 ring-red-500/40"
                    >
                      {msg}
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setEditing(null)}
                className="px-4 py-2 rounded-2xl bg-neutral-700 hover:bg-neutral-600"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleEditSave}
                className="px-4 py-2 rounded-2xl bg-primary hover:bg-primary-hover disabled:opacity-60"
                disabled={editing.saving}
              >
                {editing.saving ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cancel modal */}
      {confirmCancel && (
        <div className="fixed inset-0 z-40 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/60" />
          <div className="relative z-50 w-full max-w-md bg-surface border border-root rounded-2xl p-6 text-center">
            <h2 className="text-lg font-semibold mb-3">Cancel Session</h2>
            <p className="mb-6 text-sm text-root-secondary">
              Are you sure you want to cancel{" "}
              <b>{confirmCancel.type}</b> with{" "}
              <b>{confirmCancel.coachName}</b> on{" "}
              {new Date(confirmCancel.date).toLocaleDateString()} at{" "}
              {formatTime12(confirmCancel.startTime)}?
            </p>
            <div className="flex justify-center gap-4">
              <button
                type="button"
                onClick={() => setConfirmCancel(null)}
                className="px-4 py-2 rounded-2xl bg-neutral-700 hover:bg-neutral-600"
              >
                Close
              </button>
              <button
                type="button"
                onClick={confirmCancelSession}
                className="px-4 py-2 rounded-2xl bg-amber-600 hover:bg-amber-500"
              >
                Cancel session
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete-one modal */}
      {confirmDelete && (
        <div className="fixed inset-0 z-40 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/60" />
          <div className="relative z-50 w-full max-w-md bg-surface border border-root rounded-2xl p-6 text-center">
            <h2 className="text-lg font-semibold mb-3">Delete Session</h2>
            <p className="mb-6 text-sm text-root-secondary">
              This will permanently delete <b>{confirmDelete.type}</b> with{" "}
              <b>{confirmDelete.coachName}</b> on{" "}
              {new Date(confirmDelete.date).toLocaleDateString()} at{" "}
              {formatTime12(confirmDelete.startTime)}. This action cannot be
              undone.
            </p>
            <div className="flex justify-center gap-4">
              <button
                type="button"
                onClick={() => setConfirmDelete(null)}
                className="px-4 py-2 rounded-2xl bg-neutral-700 hover:bg-neutral-600"
              >
                Close
              </button>
              <button
                type="button"
                onClick={confirmDeleteSession}
                className="px-4 py-2 rounded-2xl bg-red-600 hover:bg-red-500"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete-all modal */}
      {confirmBulkDelete && (
        <div className="fixed inset-0 z-40 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/60" />
          <div className="relative z-50 w-full max-w-md bg-surface border border-root rounded-2xl p-6 text-center">
            <h2 className="text-lg font-semibold mb-3">Delete All Sessions</h2>
            <p className="mb-6 text-sm text-root-secondary">
              Are you sure you want to permanently delete{" "}
              <b>all {confirmBulkDelete.scope} sessions</b>? This will remove
              them completely from the system.
            </p>
            <div className="flex justify-center gap-4">
              <button
                type="button"
                onClick={() => setConfirmBulkDelete(null)}
                className="px-4 py-2 rounded-2xl bg-neutral-700 hover:bg-neutral-600"
              >
                Close
              </button>
              <button
                type="button"
                onClick={confirmDeleteAllSessions}
                className="px-4 py-2 rounded-2xl bg-red-600 hover:bg-red-500"
              >
                Delete all
              </button>
            </div>
          </div>
        </div>
      )}

      {/* page-scoped styles for custom white date icons */}
      <style jsx global>{`
        .manage-gym-sessions input[type="date"] {
          color-scheme: dark;
          position: relative;
          padding-right: 2.2rem;
          background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24'%3E%3Crect x='3' y='4' width='18' height='18' rx='2' ry='2' fill='none' stroke='%23ffffff' stroke-width='2'/%3E%3Cline x1='8' y1='2' x2='8' y2='6' stroke='%23ffffff' stroke-width='2'/%3E%3Cline x1='16' y1='2' x2='16' y2='6' stroke='%23ffffff' stroke-width='2'/%3E%3Cline x1='3' y1='10' x2='21' y2='10' stroke='%23ffffff' stroke-width='2'/%3E%3C/svg%3E");
          background-repeat: no-repeat;
          background-position: right 0.6rem center;
          background-size: 14px 14px;
        }

        .manage-gym-sessions input[type="date"]::-webkit-calendar-picker-indicator {
          position: absolute;
          right: 0.5rem;
          width: 18px;
          height: 18px;
          cursor: pointer;
          background: transparent;
          color: transparent;
          opacity: 0;
        }
      `}</style>
    </main>
  );
}

/* ------------ Toast inner styling by kind ------------ */

function ToastInner({ kind, text }) {
  let title = "";
  let subtitle = "";

  switch (kind) {
    case "edit":
      title = "Session updated";
      subtitle = "Your gym session has been updated successfully.";
      break;
    case "cancel":
      title = "Session cancelled";
      subtitle = "Your gym session has been cancelled successfully.";
      break;
    case "delete-one":
      title = "Session deleted";
      subtitle = "Session permanently deleted.";
      break;
    case "delete-all":
      title = "Sessions deleted";
      subtitle =
        text || "All matching sessions have been deleted permanently.";
      break;
    case "success":
      title = "Success";
      subtitle = text || "Action completed successfully.";
      break;
    case "error":
      title = "Error";
      subtitle = text || "Something went wrong. Please try again.";
      break;
    default:
      title = text || "Notification";
      subtitle = "";
  }

  let classes =
    "rounded-3xl px-8 py-5 bg-black/90 text-center border shadow-[0_0_35px_rgba(0,0,0,0.7)] text-sm sm:text-base";

  if (kind === "edit") {
    classes +=
      " border-blue-500/70 text-blue-50 shadow-[0_0_35px_rgba(59,130,246,0.45)]";
  } else if (kind === "cancel") {
    classes +=
      " border-amber-400/80 text-amber-50 shadow-[0_0_35px_rgba(245,158,11,0.45)]";
  } else if (kind === "delete-one" || kind === "delete-all") {
    classes +=
      " border-red-500/80 text-red-50 shadow-[0_0_35px_rgba(239,68,68,0.5)]";
  } else if (kind === "success") {
    classes +=
      " border-emerald-500/80 text-emerald-50 shadow-[0_0_35px_rgba(16,185,129,0.5)]";
  } else if (kind === "error") {
    classes +=
      " border-red-500/80 text-red-50 shadow-[0_0_35px_rgba(248,113,113,0.5)]";
  } else {
    classes += " border-neutral-500/70 text-root-primary";
  }

  return (
    <div className={classes}>
      <div className="font-semibold text-lg sm:text-xl mb-1">{title}</div>
      {subtitle && (
        <div className="text-xs sm:text-sm opacity-90">{subtitle}</div>
      )}
    </div>
  );
}
