"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { FaUndo } from "react-icons/fa";
import { BsArchive } from "react-icons/bs";
import { api } from "../../../lib/admin/eventApi.js";
import { formatLocalTime } from "@/lib/dateFormatter.js";
import Pagination from "@/components/pagination.js";
import { ActionsDropdown, DropdownProvider } from "@/components/actionDropdown.js";
import { EventDetailsModal } from "./eventDetails.js";
import Toast from "@/components/toast.js";
import { FaFileExcel } from "react-icons/fa";

// ----- small helper: always get JSON out of api() no matter what it returns
async function getJson(maybeResponse) {
  if (!maybeResponse) return {};
  if (typeof maybeResponse.json === "function") {
    try {
      return await maybeResponse.json();
    } catch {
      // some endpoints return buffers/files
      return {};
    }
  }
  return maybeResponse; // already parsed
}

export default function EventsAdmin() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [banner, setBanner] = useState({ text: "", tone: "info" });
  const [confirmDelete, setConfirmDelete] = useState({ visible: false, id: null });
  const [hasAccess, setHasAccess] = useState(null);

  const DEFAULT_TOAST_DURATION = 4000;
  const toastTimerRef = useRef(null);
  const [toast, setToast] = useState(null);

  const [professors, setProfessors] = useState([]);

  const initialIncludeArchived = useMemo(
    () => (String(searchParams.get("includeArchived") || "false").toLowerCase() === "true"),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  const [filters, setFilters] = useState({
    name: "",
    location: "",
    startDateTime: "",
    endDateTime: "",
    page: 1,
    limit: 5,
    sortBy: "name",
    sortOrder: "asc",
    eventType: "",
    professor: "",
    includeArchived: initialIncludeArchived,
  });
  const [totalCount, setTotalCount] = useState(0);

  const eventHasProfessor = (event, profId) => {
    if (!event || !profId) return false;
    // Only consider professors for Workshop events
    const type = String(event?.eventType || "").toLowerCase();
    if (type !== "workshop") return false;
    const arr = event.professors || event.professor || event.professorsIds || [];
    if (!Array.isArray(arr)) return false;
    return arr.some((p) => {
      if (!p) return false;
      if (typeof p === "string" || typeof p === "number") return String(p) === String(profId);
      const pid = p._id ?? p.id ?? p.professorId ?? null;
      return pid && String(pid) === String(profId);
    });
  };

  // load professors for filter
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await api("/public/professors");
        const payload = await getJson(res);
        const list = payload?.data ?? payload ?? [];
        if (!mounted) return;
        setProfessors(Array.isArray(list) ? list : []);
      } catch {
        if (mounted) setProfessors([]);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  // check permission
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await api("/auth/me");
        const payload = await getJson(res);
        const me = payload?.data ?? payload?.user ?? payload;
        if (!mounted) return;
        if (me?.role !== "event_office" && me?.role !== "admin") {
          setHasAccess(false);
          router.replace("/404");
          return;
        }
        setHasAccess(true);
      } catch {
        setHasAccess(false);
        router.replace("/404");
      }
    })();
    return () => void (mounted = false);
  }, [router]);

  const syncUrl = (nextFilters) => {
    const sp = new URLSearchParams(window.location.search);
    if (nextFilters.includeArchived) sp.set("includeArchived", "true");
    else sp.delete("includeArchived");
    const qs = sp.toString();
    const base = window.location.pathname;
    window.history.replaceState(null, "", qs ? `${base}?${qs}` : base);
  };

  const showToast = (text = "", type = "success", timeout = DEFAULT_TOAST_DURATION) => {
    if (toastTimerRef.current) {
      clearTimeout(toastTimerRef.current);
      toastTimerRef.current = null;
    }
    setToast({ message: text || "", type: type || "success" });
    if (timeout > 0) {
      toastTimerRef.current = setTimeout(() => {
        setToast(null);
        toastTimerRef.current = null;
      }, timeout);
    }
  };

  const load = async () => {
    setLoading(true);
    setBanner({ text: "", tone: "info" });
    try {
      // build params for initial page request (don't send sortBy/sortOrder directly)
      const params = new URLSearchParams();
      Object.entries(filters).forEach(([key, value]) => {
        if (value === "" || value === null || value === undefined) return;
        if (key === "sortBy" || key === "sortOrder") return;
        params.append(key, value);
      });

      // backend sort field mapping
      const sortFieldMap = {
        name: "name",
        location: "location",
        eventType: "eventType",
        startDateTime: "startDateTime",
        endDateTime: "endDateTime",
      };
      if (filters.sortBy) {
        const mapped = sortFieldMap[filters.sortBy] || filters.sortBy;
        params.append("sort", `${filters.sortOrder === "desc" ? "-" : ""}${mapped}`);
      }

      // request initial page to obtain total and page-of-data
      const res = await api(`/event?${params.toString()}`);
      const data = await getJson(res);

      let eventsList = data?.data ?? data ?? [];
      if (!Array.isArray(eventsList)) eventsList = [];

      // helpers: stable, case/diacritic-insensitive text sorting and date sorting
      const applyTextSort = (items, field, order = "asc") => {
        const collator = new Intl.Collator(undefined, { sensitivity: "base", numeric: true });
        const mapped = items.map((v, i) => {
          const raw = String(v?.[field] ?? "");
          const key = raw
            .normalize("NFD")
            .replace(/\p{M}/gu, "")
            .trim()
            .toLowerCase()
            .replace(/\s+/g, " ");
          return { v, i, key };
        });
        mapped.sort((a, b) => {
          const cmp = collator.compare(a.key, b.key);
          if (cmp !== 0) return cmp;
          return a.i - b.i;
        });
        if (order === "desc") mapped.reverse();
        return mapped.map((m) => m.v);
      };

      const applyDateSort = (items, field, order = "asc") => {
        const parseTime = (val) => {
          if (!val) return null;
          const t = Date.parse(val);
          return Number.isFinite(t) ? t : null;
        };
        const mapped = items.map((v, i) => ({ v, i }));
        const compareDates = (a, b) => {
          const ta = parseTime(a.v?.[field]);
          const tb = parseTime(b.v?.[field]);
          if (ta === null && tb === null) return a.i - b.i;
          if (ta === null) return 1;
          if (tb === null) return -1;
          if (ta < tb) return -1;
          if (ta > tb) return 1;
          return a.i - b.i;
        };
        mapped.sort((a, b) => (order === "desc" ? -compareDates(a, b) : compareDates(a, b)));
        return mapped.map((m) => m.v);
      };

      // determine total and current page items
      const total = Number(data?.pagination?.total) || Number(data?.totalEvents) || Number(data?.total) || eventsList.length || 0;

      // apply professor filter (server may not support professor filtering)
      // Only filter by professor for Workshop events — professor selection
      // should not filter other event types.
      if (filters.professor) {
        eventsList = eventsList.filter((ev) => {
          const type = String(ev?.eventType || "").toLowerCase();
          if (type !== "workshop") return false;
          return eventHasProfessor(ev, filters.professor);
        });
      }

      // page / limit
      const page = Number(filters.page || 1);
      const limit = Number(filters.limit || 5);

      // If global sort requested and dataset spans multiple pages, fetch full set, sort, then slice
      let items = eventsList.slice();
      if (filters.sortBy && total > limit) {
        const allParams = new URLSearchParams();
        Object.entries(filters).forEach(([key, value]) => {
          if (value === "" || value === null || value === undefined) return;
          if (key === "sortBy" || key === "sortOrder") return;
          allParams.append(key, value);
        });
        allParams.set("page", "1");
        allParams.set("limit", String(Math.max(1, total)));
        const mapped = sortFieldMap[filters.sortBy] || filters.sortBy;
        allParams.set("sort", `${filters.sortOrder === "desc" ? "-" : ""}${mapped}`);

        const allData = await api(`/event?${allParams.toString()}`);
        const allPayload = await getJson(allData);
        let allItems = Array.isArray(allPayload?.data) ? allPayload.data.slice() : [];
        if (!Array.isArray(allItems)) allItems = [];

        // If user filtered by professor, apply same professor-only (workshop) filter
        if (filters.professor) {
          allItems = allItems.filter((ev) => {
            const type = String(ev?.eventType || "").toLowerCase();
            if (type !== "workshop") return false;
            return eventHasProfessor(ev, filters.professor);
          });
        }

        if (["name", "location", "eventType"].includes(filters.sortBy)) {
          allItems = applyTextSort(allItems, filters.sortBy, filters.sortOrder);
        } else if (["startDateTime", "endDateTime"].includes(filters.sortBy)) {
          allItems = applyDateSort(allItems, filters.sortBy, filters.sortOrder);
        }

        const start = (page - 1) * limit;
        items = allItems.slice(start, start + limit);
      } else {
        // fallback: sort only current page
        if (["name", "location", "eventType"].includes(filters.sortBy)) {
          items = applyTextSort(items, filters.sortBy, filters.sortOrder);
        } else if (["startDateTime", "endDateTime"].includes(filters.sortBy)) {
          items = applyDateSort(items, filters.sortBy, filters.sortOrder);
        }
      }

      setEvents(items);
      setTotalCount(total);
    } catch (e) {
      showToast(e?.message || "Failed to load events", "error", DEFAULT_TOAST_DURATION);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (hasAccess) load();
  }, [filters, hasAccess]); // eslint-disable-line react-hooks/exhaustive-deps

  if (hasAccess === null) return <main className="p-8">Checking permissions...</main>;
  if (hasAccess === false) return null;

  const Banner = ({ text, tone }) => {
    if (!text) return null;
    const toneClass =
      tone === "error"
        ? "bg-red-600/25 text-red-200 border-red-400/40"
        : tone === "success"
        ? "bg-green-600/25 text-green-200 border-green-400/40"
        : "bg-black/30 text-secondary border-white/10";
    return <div className={`mb-3 rounded-xl px-3 py-2 text-sm border ${toneClass}`}>{text}</div>;
  };

  const confirmDeleteBazaar = (id) => setConfirmDelete({ visible: true, id });

  const handleDelete = async () => {
    try {
      const res = await api(`/event/${confirmDelete.id}`, { method: "DELETE" });
      const payload = await getJson(res);
      if (payload && payload.status === "error") {
        showToast(payload.message || "Failed to delete event", "error");
      } else {
        showToast("Event deleted successfully", "success");
        await load();
      }
    } catch (e) {
      showToast(e?.message || "Failed to delete event", "error");
    } finally {
      setConfirmDelete({ visible: false, id: null });
    }
  };

  const handleView = (event) => {
    if (event && (event._id || event.id)) {
      router.push(`/admin/events/${event._id || event.id}`);
    }
  };

  const totalPages = Math.ceil(totalCount / filters.limit);

  const ConfirmModal = ({ visible, onCancel, onConfirm }) => {
    if (!visible) return null;
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-black/40 z-50 p-4">
        <div className="bg-surface text-root-primary rounded-2xl p-6 w-96 text-center space-y-4 shadow-elevated border border-root">
          <p className="text-lg font-medium">Are you sure you want to delete this Event?</p>
          <div className="flex justify-center gap-4">
            <button
              className="px-4 py-2 rounded-lg input-surface hover:opacity-90 transition hover:cursor-pointer"
              onClick={onCancel}
            >
              Cancel
            </button>
            <button
              className="px-4 py-2 rounded-lg bg-error text-root-primary hover:opacity-90 transition hover:cursor-pointer"
              onClick={onConfirm}
            >
              Delete
            </button>
          </div>
        </div>
      </div>
    );
  };

  const runArchiveNow = async () => {
    try {
      setLoading(true);
      const res = await api(`/event/archive/run`, { method: "POST" });
      const payload = await getJson(res);
      const msg = (payload && (payload.message || payload.status)) || "Archiver executed";
      showToast(`Archive done. ${msg}`, "success");
      await load();
    } catch (e) {
      showToast(e?.message || "Failed to run archive", "error");
    } finally {
      setLoading(false);
    }
  };

  const formatDateOnly = (iso) => {
    try {
      if (!iso) return null;
      const d = new Date(iso);
      return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
    } catch {
      return iso;
    }
  };

  const ArchivedPill = ({ whenISO }) => (
    <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs border border-white/15 bg-black/30 text-secondary animate-in fade-in zoom-in-95 duration-200">
      Archived{whenISO ? ` · ${formatDateOnly(whenISO)}` : ""}
    </span>
  );

  return (
    <DropdownProvider>
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

        <ConfirmModal
          visible={confirmDelete.visible}
          onCancel={() => setConfirmDelete({ visible: false, id: null })}
          onConfirm={handleDelete}
        />

        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <h1 className="text-3xl font-semibold text-root-primary hover:opacity-80 transition">Events</h1>
          <div className="flex gap-2">
            <button
              onClick={runArchiveNow}
              disabled={loading}
              title="Archive all past events"
              aria-label="Archive past events"
              className="flex items-center gap-2 px-4 py-2 rounded-2xl input-surface text-root-primary border border-root hover:bg-highlight transition"
            >
              <BsArchive className="text-lg" />
              <span>Archive Past Events</span>
            </button>

            <Link
              href="/admin"
              className="flex items-center gap-2 px-4 py-2 rounded-2xl btn-primary text-root-primary hover:opacity-90 transition"
            >
              <FaUndo className="text-lg" />
              <span>Dashboard</span>
            </Link>
          </div>
        </div>

        <Banner text={banner.text} tone={banner.tone} />

        <div className="p-4 rounded-2xl bg-surface text-root-secondary">
          <div className="grid grid-cols-1 md:grid-cols-7 gap-4">
            <div className="flex flex-col gap-1">
              <label className="text-xs uppercase opacity-80">Search</label>
              <input
                className="px-3 py-2 rounded input-surface"
                placeholder="Event name…"
                value={filters.name}
                onChange={(e) => setFilters((f) => ({ ...f, name: e.target.value, page: 1 }))}
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs uppercase opacity-80">Event type</label>
              <select
                className="px-3 py-2 rounded input-surface"
                value={filters.eventType || ""}
                onChange={(e) => setFilters((f) => ({ ...f, eventType: e.target.value || "", page: 1 }))}
              >
                <option value="">All</option>
                <option value="booth">Booth</option>
                <option value="bazaar">Bazaar</option>
                <option value="conference">Conference</option>
                <option value="trip">Trip</option>
                <option value="workshop">Workshop</option>
              </select>
            </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs uppercase opacity-80">Professor</label>
            <select
              className="px-3 py-2 rounded input-surface"
              value={filters.professor || ""}
              onChange={(e) => setFilters((f) => ({ ...f, professor: e.target.value || "", page: 1 }))}
            >
              <option value="">All</option>
              {professors.map((p) => (
                <option key={p._id ?? p.id ?? String(p)} value={p._id ?? p.id ?? p}>
                  {p.fullName ?? p.name ?? String(p)}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs uppercase opacity-80">Location</label>
            <input
              className="px-3 py-2 rounded input-surface"
              placeholder="Location…"
              value={filters.location || ""}
              onChange={(e) => setFilters((f) => ({ ...f, location: e.target.value || "", page: 1 }))}
            />
          </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs uppercase opacity-80">Start Date From</label>
              <input
                type="datetime-local"
                className="px-3 py-2 rounded input-surface"
                value={filters.startDateTime || ""}
                onChange={(e) => setFilters((f) => ({ ...f, startDateTime: e.target.value || "", page: 1 }))}
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs uppercase opacity-80">End Date To</label>
              <input
                type="datetime-local"
                className="px-3 py-2 rounded input-surface"
                value={filters.endDateTime || ""}
                onChange={(e) => setFilters((f) => ({ ...f, endDateTime: e.target.value || "", page: 1 }))}
              />
            </div>

            <div className="hidden md:block" />

            <div className="flex flex-col justify-end">
              <button
                onClick={() => {
                  setFilters((f) => {
                    const next = { ...f, includeArchived: !f.includeArchived, page: 1 };
                    syncUrl(next);
                    return next;
                  });
                }}
                className={`inline-flex items-center gap-3 px-3 py-1.5 rounded-full text-sm font-medium transition ${
                  filters.includeArchived
                    ? "bg-primary text-root-primary border border-primary"
                    : "input-surface border border-root text-root-secondary"
                }`}
              >
                <span
                  className={`relative inline-block w-9 h-5 rounded-full p-0.5 ${
                    filters.includeArchived ? "bg-primary/80" : "bg-white/5"
                  }`}
                >
                  <span
                    className={`block w-3 h-3 rounded-full bg-white transition-transform ${
                      filters.includeArchived ? "translate-x-4" : "translate-x-0"
                    }`}
                  />
                </span>
                <span>Include archived</span>
              </button>
            </div>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-surface text-root-primary">
          {loading ? (
            <p>Loading...</p>
          ) : events.length === 0 ? (
            <p className="opacity-70">No Events Found.</p>
          ) : (
            <div className="overflow-auto">
              <table className="w-full text-sm">
                <thead className="text-root-secondary opacity-80">
                  <tr>
                    {[
                      { key: "name,archived", label: "Name" },
                      { key: "location", label: "Location" },
                      { key: "startDateTime", label: "Start" },
                      { key: "endDateTime", label: "End" },
                      { key: "eventType", label: "Event Type" },
                      { key: "actions", label: "Actions" },
                    ].map(({ key, label }) => {
                      if (key === "actions") {
                        return (
                          <th key={key} className="p-2 text-center">
                            {label}
                          </th>
                        );
                      }
                      const k = key.split(",")[0];
                      return (
                        <th
                          key={key}
                          onClick={() =>
                            setFilters((prev) => ({
                              ...prev,
                              sortBy: k,
                              sortOrder:
                                prev.sortBy === k && prev.sortOrder === "asc" ? "desc" : "asc",
                            }))
                          }
                          className="text-left p-2 cursor-pointer select-none hover:opacity-80 transition"
                        >
                          {label}
                          {filters.sortBy === k && (
                            <span className="ml-1 text-xs">
                              {filters.sortOrder === "asc" ? "▲" : "▼"}
                            </span>
                          )}
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody>
                  {events.map((e) => {
                    const isArchived = !!e.isArchived;
                    const isConference = String(e.eventType).toLowerCase() === "conference";
                    const isBazaar = String(e.eventType).toLowerCase() === "bazaar";
                    const isBooth = String(e.eventType).toLowerCase() === "booth";
                    const isCareerFair = /career\s*fair/i.test(String(e.name || ""));
                    const isVisitorQrAllowedType = isBazaar || isBooth || isCareerFair;
                    const isVisitorQrVisible = Boolean(
                      isVisitorQrAllowedType && e.externalVisitorsEnabled
                    );

                    return (
                      <tr
                        key={e._id}
                        className={`border-t border-root transition opacity-100`}
                      >
                        <td className="p-2 text-root-primary">
                          <div className="flex items-center">
                            <span>{e.name}</span>
                            {isArchived && <ArchivedPill whenISO={e.archivedAt} />}
                          </div>
                        </td>
                        <td className="p-2 text-root-primary">{e.location}</td>
                        <td className="p-2 text-root-primary">
                          {formatLocalTime(e.startDateTime)}
                        </td>
                        <td className="p-2 text-root-primary">
                          {formatLocalTime(e.endDateTime)}
                        </td>
                        <td className="p-2 text-root-primary">
                          {e.eventType
                            ? e.eventType.charAt(0).toUpperCase() + e.eventType.slice(1)
                            : ""}
                        </td>
                        <td className="p-2">
                          <div className="flex justify-center items-center gap-2">
  {(() => {
    const base =
      process?.env?.NEXT_PUBLIC_API_BASE ||
      process?.env?.NEXT_PUBLIC_API_URL ||
      "";
    const apiBase = base
      ? base.replace(/\/+$/, "")
      : typeof window !== "undefined"
      ? `${window.location.protocol}//${window.location.hostname}:5000/api`
      : "";
    const exportUrl = `${apiBase}/event/${e._id}/export-registrations.xlsx`;

    const actions = [
      {
        label: "Details",
        onClick: () => handleView(e),
      },
      ...(isConference
        ? []
        : [
            {
              label: "Export Excel",
              onClick: () =>
                window.open(exportUrl, "_blank", "noopener,noreferrer"),
            },
          ]),
      {
        label: "Delete",
        onClick: () => confirmDeleteBazaar(e._id),
        danger: true,
      },
    ];

    return (
      <ActionsDropdown
        event={e}
        onDelete={() => confirmDeleteBazaar(e._id)}
        onView={handleView}
        actions={actions}
        disabled={isArchived}
        allowedActions={isArchived ? ["view"] : undefined}
      />
    );
  })()}

  {/* Manage Access button */}
  <Link
    href={`/admin/events/${e._id}/access`}
    className="px-3 py-1.5 rounded-xl input-surface text-xs hover:opacity-90 transition"
    title="Manage registration access"
  >
    Manage Access
  </Link>

  {/* Vendor Poll button – only for Booth events */}
  {isBooth && (
    <Link
      href={`/admin/events/${e._id}/vendor-poll`}
      className="px-3 py-1.5 rounded-xl input-surface text-xs hover:opacity-90 transition"
      title="Create vendor poll for this Booth event"
    >
      Vendor Poll
    </Link>
  )}

  {/* Visitor QR button (if visible) */}
  {isVisitorQrVisible && (
    <Link
      href={`/admin/events/${e._id}/external-qr`}
      className="px-3 py-1.5 rounded-xl bg-highlight text-xs text-root-primary hover:opacity-90 transition"
      title="External visitor QR"
    >
      Visitor QR
    </Link>
  )}
</div>

                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              <Pagination
                page={filters.page}
                limit={filters.limit}
                totalCount={totalCount}
                onPageChange={(newPage) => setFilters((f) => ({ ...f, page: newPage }))}
                onLimitChange={(newLimit) =>
                  setFilters((f) => ({ ...f, limit: newLimit, page: 1 }))
                }
              />
            </div>
          )}
        </div>

    </main>
    </DropdownProvider>
  );
}
