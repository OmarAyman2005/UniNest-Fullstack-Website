// client/src/app/admin/vendor-polls/page.js
"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { FaUndo } from "react-icons/fa";

import { api } from "../../../lib/admin/eventApi.js";
import Toast from "@/components/toast.js";
import { formatLocalTime } from "@/lib/dateFormatter.js";
import { VendorPollAccordionForm } from "./VendorPollAccordionForm.jsx";
import Pagination from "@/components/pagination";

// small helper: always unwrap api() result into JSON
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

function resolveApiBase() {
  const base =
    process.env.NEXT_PUBLIC_API_BASE ||
    process.env.NEXT_PUBLIC_API_URL ||
    "";
  if (base) return base.replace(/\/+$/, "");
  if (typeof window === "undefined") return "";
  return `${window.location.protocol}//${window.location.hostname}:5000/api`;
}

export default function VendorPollsPage() {
  const router = useRouter();
  const [hasAccess, setHasAccess] = useState(null);

  const [polls, setPolls] = useState([]);
  const [pollsLoading, setPollsLoading] = useState(false);

  const [events, setEvents] = useState([]);
  const [eventsLoading, setEventsLoading] = useState(false);

  const [selectedEventId, setSelectedEventId] = useState("");

  const [eligibleVendors, setEligibleVendors] = useState([]);
  const [eligibleMeta, setEligibleMeta] = useState(null);
  const [eligibleLoading, setEligibleLoading] = useState(false);

  const [selectedVendorIds, setSelectedVendorIds] = useState([]);
  const [pollTitle, setPollTitle] = useState("");
  const [pollDescription, setPollDescription] = useState("");
  const [creating, setCreating] = useState(false);

  const [accordionOpen, setAccordionOpen] = useState(false);

  // filters & pagination state (used by FilterPanel & Pagination)
  const [filters, setFilters] = useState({
    q: "",
    eventId: "",
    status: "",
    page: 1,
    limit: 10,
    sortBy: "createdAt",
    sortOrder: "desc",
  });
  const [totalCount, setTotalCount] = useState(0);

  // ---- modal / details state for "View" ----
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [selectedPoll, setSelectedPoll] = useState(null);
  const [pollLoading, setPollLoading] = useState(false);
  const [pollVotes, setPollVotes] = useState([]);
  const [pollOptions, setPollOptions] = useState([]);

  const toastTimerRef = useRef(null);
  const DEFAULT_TOAST_DURATION = 4000;
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

  /* ----------------------- auth / role check ----------------------- */
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await api("/auth/me");
        const payload = await getJson(res);
        const me = payload?.data ?? payload?.user ?? payload;
        if (!mounted) return;

        const role = String(me?.role || "").toLowerCase();
        if (role !== "event_office" && role !== "admin") {
          setHasAccess(false);
          router.replace("/404");
          return;
        }
        setHasAccess(true);
      } catch (err) {
        console.error("VendorPollsPage /auth/me error:", err);
        if (!mounted) return;
        setHasAccess(false);
        router.replace("/404");
      }
    })();

    return () => {
      mounted = false;
      if (toastTimerRef.current) {
        clearTimeout(toastTimerRef.current);
        toastTimerRef.current = null;
      }
    };
  }, [router]);

  /* ----------------------- load existing polls -------------------- */
  const loadPolls = async () => {
    setPollsLoading(true);
    try {
      // build base params for first page request
      const params = new URLSearchParams();
      if (filters.q) params.set("q", filters.q);
      if (filters.eventId) params.set("eventId", filters.eventId);
      if (filters.status) params.set("status", filters.status);
      params.set("page", String(filters.page || 1));
      params.set("limit", String(filters.limit || 10));
      if (filters.sortBy) params.set("sortBy", filters.sortBy);
      if (filters.sortOrder) params.set("sortOrder", filters.sortOrder);

      // initial request to get page and total
      const res = await api(`/polls?${params.toString()}`);
      const payload = await getJson(res);
      let list = payload?.data ?? payload ?? [];
      if (!Array.isArray(list)) list = [];
      const total = Number(payload?.totalCount ?? payload?.total ?? payload?.meta?.total ?? list.length) || 0;

      // helpers: stable, case/diacritic-insensitive text sorting and robust date/number sorting
      const applyTextSort = (items, field, order = "asc") => {
        const collator = new Intl.Collator(undefined, { sensitivity: "base", numeric: true });
        const mapped = items.map((v, i) => {
          let raw = "";
          if (field === "eventId") {
            // resolve event name from events list if available
            const ev = events.find((e) => String(e.id || e._id) === String(v.eventId));
            raw = ev?.name ?? ev?.title ?? v.eventName ?? String(v.eventId ?? "");
          } else {
            raw = String(v?.[field] ?? "");
          }
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

      const applyNumberSort = (items, field, order = "asc") => {
        const mapped = items.map((v, i) => ({ v, i, key: Number(v?.[field] ?? 0) }));
        mapped.sort((a, b) => {
          if (a.key < b.key) return -1;
          if (a.key > b.key) return 1;
          return a.i - b.i;
        });
        if (order === "desc") mapped.reverse();
        return mapped.map((m) => m.v);
      };

      // page / limit
      let items = list.slice();
      const page = Number(filters.page || 1);
      const limit = Number(filters.limit || 10);

      // If global sort requested and dataset spans multiple pages, fetch full set, sort, then slice
      if (filters.sortBy && total > limit) {
        const allParams = new URLSearchParams();
        if (filters.q) allParams.set("q", filters.q);
        if (filters.eventId) allParams.set("eventId", filters.eventId);
        if (filters.status) allParams.set("status", filters.status);
        allParams.set("page", "1");
        allParams.set("limit", String(Math.max(1, total)));

        // include sort params so backend can optimise if supported
        if (filters.sortBy) allParams.set("sortBy", filters.sortBy);
        if (filters.sortOrder) allParams.set("sortOrder", filters.sortOrder);

        const allRes = await api(`/polls?${allParams.toString()}`);
        const allPayload = await getJson(allRes);
        let allItems = allPayload?.data ?? allPayload ?? [];
        if (!Array.isArray(allItems)) allItems = [];

        if (["title", "eventId"].includes(filters.sortBy)) {
          allItems = applyTextSort(allItems, filters.sortBy, filters.sortOrder);
        } else if (["createdAt"].includes(filters.sortBy)) {
          allItems = applyDateSort(allItems, filters.sortBy, filters.sortOrder);
        } else if (["totalVotes"].includes(filters.sortBy)) {
          allItems = applyNumberSort(allItems, filters.sortBy, filters.sortOrder);
        }

        const start = (page - 1) * limit;
        items = allItems.slice(start, start + limit);
      } else {
        // fallback: sort only current page
        if (["title", "eventId"].includes(filters.sortBy)) {
          items = applyTextSort(items, filters.sortBy, filters.sortOrder);
        } else if (["createdAt"].includes(filters.sortBy)) {
          items = applyDateSort(items, filters.sortBy, filters.sortOrder);
        } else if (["totalVotes"].includes(filters.sortBy)) {
          items = applyNumberSort(items, filters.sortBy, filters.sortOrder);
        }
      }

      setPolls(items);
      setTotalCount(total);
    } catch (err) {
      console.error("loadPolls error:", err);
      showToast("Failed to load vendor polls.", "error");
      setPolls([]);
      setTotalCount(0);
    } finally {
      setPollsLoading(false);
    }
  };

  /* ----------------------- load booth events ---------------------- */
  const loadEvents = async () => {
    setEventsLoading(true);
    try {
      // Only Booth events; limit to a reasonable number
      const params = new URLSearchParams({
        eventType: "booth",
        limit: "100",
      });
      const res = await api(`/event?${params.toString()}`);
      const payload = await getJson(res);
      let list = payload?.data ?? payload ?? [];
      if (!Array.isArray(list)) list = [];

      setEvents(
        list.map((ev) => ({
          id: ev._id,
          name: ev.name || ev.title || "Booth Event",
          location: ev.location || "",
          startDateTime: ev.startDateTime || null,
        }))
      );
    } catch (err) {
      console.error("loadEvents error:", err);
      showToast("Failed to load Booth events.", "error");
      setEvents([]);
    } finally {
      setEventsLoading(false);
    }
  };

  useEffect(() => {
    if (!hasAccess) return;
    loadEvents();
  }, [hasAccess]); // eslint-disable-line react-hooks/exhaustive-deps

  // auto-load polls when filters or access change
  useEffect(() => {
    if (!hasAccess) return;
    loadPolls();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasAccess, filters.page, filters.limit, filters.q, filters.eventId, filters.status, filters.sortBy, filters.sortOrder]);

  /* ------------------- load eligible vendors for event ------------ */
  const loadEligibleVendors = async (eventId) => {
    if (!eventId) {
      setEligibleVendors([]);
      setEligibleMeta(null);
      setSelectedVendorIds([]);
      return;
    }

    setEligibleLoading(true);
    try {
      const res = await api(`/polls/eligible-vendors?eventId=${encodeURIComponent(eventId)}`);
      const payload = await getJson(res);

      if (payload?.status === "error") {
        showToast(payload.message || "Failed to load eligible vendors.", "error");
        setEligibleVendors([]);
        setEligibleMeta(null);
        setSelectedVendorIds([]);
        return;
      }

      const vendors = payload?.data ?? [];
      setEligibleVendors(Array.isArray(vendors) ? vendors : []);
      setEligibleMeta(payload?.event || null);
      setSelectedVendorIds([]);

      if (!pollTitle && (payload?.event?.name || payload?.event?.title)) {
        setPollTitle(`Which vendor should get the clashing booth?`);
      }
    } catch (err) {
      console.error("loadEligibleVendors error:", err);
      showToast("Failed to load eligible vendors.", "error");
      setEligibleVendors([]);
      setEligibleMeta(null);
      setSelectedVendorIds([]);
    } finally {
      setEligibleLoading(false);
    }
  };

  const handleEventChange = (e) => {
    const eventId = e.target.value || "";
    setSelectedEventId(eventId);
    setPollTitle("");
    setPollDescription("");
    loadEligibleVendors(eventId);
  };

  const toggleVendor = (applicationId) => {
    setSelectedVendorIds((prev) =>
      prev.includes(applicationId)
        ? prev.filter((id) => id !== applicationId)
        : [...prev, applicationId]
    );
  };

  const allVendorsSelected =
    eligibleVendors.length > 0 && selectedVendorIds.length === eligibleVendors.length;

  const toggleSelectAllVendors = () => {
    if (allVendorsSelected) {
      setSelectedVendorIds([]);
    } else {
      setSelectedVendorIds(eligibleVendors.map((v) => String(v.applicationId)));
    }
  };

  /* --------------------------- create poll ------------------------ */
  const handleCreatePoll = async (e) => {
    e.preventDefault();
    if (!selectedEventId) {
      showToast("Please select a Booth event first.", "error");
      return;
    }
    if (!pollTitle.trim()) {
      showToast("Please enter a poll title.", "error");
      return;
    }
    if (selectedVendorIds.length < 2) {
      showToast("Select at least two clashing vendors for the poll.", "error");
      return;
    }

    setCreating(true);
    try {
      const body = {
        eventId: selectedEventId,
        title: pollTitle.trim(),
        description: pollDescription.trim() || null,
        applicationIds: selectedVendorIds,
      };

      const apiBase = resolveApiBase();

      const res = await fetch(`${apiBase}/polls`, {
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
          `Failed to create poll (status ${res.status}).`;
        showToast(msg, "error");
        return;
      }

      showToast("Vendor poll created successfully.", "success");
      setSelectedVendorIds([]);
      setPollDescription("");
      setPollTitle("");
      // refresh polls (reset to first page)
      setFilters((f) => ({ ...f, page: 1 }));
      await loadPolls();
      setAccordionOpen(false);
    } catch (err) {
      console.error("handleCreatePoll error:", err);
      showToast(err?.message || "Failed to create poll.", "error");
    } finally {
      setCreating(false);
    }
  };

  // open details modal and fetch poll + votes
  const viewPoll = async (pollId) => {
    if (!pollId) return;
    setShowDetailsModal(true);
    setSelectedPoll(null);
    setPollVotes([]);
    setPollLoading(true);
    try {
      const res = await api(`/polls/${encodeURIComponent(pollId)}`);
      const payload = await getJson(res);
      const data = payload?.data ?? payload ?? null;
      if (!data) {
        showToast("Poll not found.", "error");
        setShowDetailsModal(false);
        return;
      }

      setSelectedPoll(data);

      // Try to resolve votes from several places:
      let votes = data?.votes || payload?.votes || [];

      if (!Array.isArray(votes) || votes.length === 0) {
        try {
          const vr = await api(`/polls/${encodeURIComponent(pollId)}`);
          const vpayload = await getJson(vr);
          votes = vpayload?.data ?? vpayload ?? votes;
        } catch (err) {
          console.debug("failed to load votes from /votes endpoint", err);
        }
      }

      setPollVotes(Array.isArray(votes) ? votes : []);
      // also capture option summaries if present
      setPollOptions(Array.isArray(data?.options) ? data.options : []);
    } catch (err) {
      console.error("viewPoll error:", err);
      showToast("Failed to load poll details.", "error");
      setShowDetailsModal(false);
    } finally {
      setPollLoading(false);
    }
  };

  // resolve a human-friendly event name for a poll
  const getPollEventName = (poll) => {
    if (!poll) return "—";
    if (poll.event && (poll.event.name || poll.event.title)) return poll.event.name || poll.event.title;
    if (poll.eventName) return poll.eventName;
    if (poll.eventId) {
      const ev = events.find((e) => String(e.id || e._id) === String(poll.eventId));
      if (ev) return ev.name || ev.title || ev.location || String(poll.eventId);
      return String(poll.eventId);
    }
    return "—";
  };

  if (hasAccess === null) {
    return <main className="p-8 text-root-primary">Checking permissions…</main>;
  }
  if (hasAccess === false) return null;

  // FilterPanel configuration
  const filterConfig = [
    { key: "q", label: "Title", placeholder: "Search title…" },
    {
      key: "eventId",
      label: "Event",
      type: "select",
      placeholder: "All Booth events",
      options: events.map((ev) => ({ value: ev.id, label: ev.name })),
    },
    {
      key: "status",
      label: "Status",
      type: "select",
      placeholder: "All",
      options: [
        { value: "", label: "All" },
        { value: "open", label: "Open" },
        { value: "closed", label: "Closed" },
      ],
    },
  ];

  return (
    <main className="p-8 space-y-6">
      {/* Toast */}
      {toast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50">
          <Toast message={toast.message} type={toast.type} duration={DEFAULT_TOAST_DURATION} onClose={() => setToast(null)} />
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div>
          <h1 className="text-3xl font-semibold text-root-primary">Vendor Polls</h1>
          <p className="text-sm text-root-secondary mt-1">Manage existing polls and create new polls when vendors clash on the same booth & dates.</p>
        </div>
        <Link href="/admin" className="flex items-center gap-2 px-4 py-2 rounded-2xl btn-primary text-root-primary hover:opacity-90 transition">
          <FaUndo className="text-lg" /> Home
        </Link>
      </div>

      {/* Accordion Form (top) */}
      <VendorPollAccordionForm
        open={accordionOpen}
        setOpen={setAccordionOpen}
        events={events}
        eventsLoading={eventsLoading}
        selectedEventId={selectedEventId}
        onEventChange={handleEventChange}
        pollTitle={pollTitle}
        setPollTitle={setPollTitle}
        pollDescription={pollDescription}
        setPollDescription={setPollDescription}
        eligibleVendors={eligibleVendors}
        eligibleLoading={eligibleLoading}
        selectedVendorIds={selectedVendorIds}
        toggleVendor={toggleVendor}
        allVendorsSelected={allVendorsSelected}
        toggleSelectAllVendors={toggleSelectAllVendors}
        handleCreatePoll={handleCreatePoll}
        creating={creating}
      />

      {/* Filters (bazaar-style placement below accordion) */}
      <div className="p-4 rounded-2xl bg-surface text-root-secondary">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="flex flex-col gap-1">
            <label className="text-xs uppercase opacity-80">Search</label>
            <input
              className="px-3 py-2 rounded input-surface"
              placeholder="Poll title…"
              value={filters.q}
              onChange={(e) => setFilters((f) => ({ ...f, q: e.target.value, page: 1 }))}
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs uppercase opacity-80">Event</label>
            <select
              className="px-3 py-2 rounded input-surface"
              value={filters.eventId}
              onChange={(e) => setFilters((f) => ({ ...f, eventId: e.target.value, page: 1 }))}
            >
              <option value="">All Booth events</option>
              {events.map((ev) => (
                <option key={ev.id} value={ev.id}>
                  {ev.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs uppercase opacity-80">Status</label>
            <select
              className="px-3 py-2 rounded input-surface"
              value={filters.status}
              onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value, page: 1 }))}
            >
              <option value="">All</option>
              <option value="open">Open</option>
              <option value="closed">Closed</option>
            </select>
          </div>
        </div>
      </div>

      {/* Table (use same UI/styling as bazaars page) */}
      <div className="p-4 rounded-2xl bg-surface text-root-primary">
        {pollsLoading ? (
          <p className="text-sm text-root-secondary">Loading polls…</p>
        ) : polls.length === 0 ? (
          <div className="rounded-xl bg-black/30 border border-dashed border-root/50 px-4 py-6 text-center text-sm text-root-secondary">No vendor polls found yet.</div>
        ) : (
          // match bazaars: overflow-auto wrapper, no outer white border
          <div className="overflow-auto">
            <table className="w-full text-sm">
              {/* match bazaars thead styling */}
              <thead className="text-root-secondary opacity-80">
                <tr>
                  {[
                    { key: "title", label: "Title" },
                    { key: "eventId", label: "Event" },
                    { key: "createdAt", label: "Created" },
                    { key: "isOpen", label: "Status" },
                    { key: "totalVotes", label: "Total votes" },
                  ].map(({ key, label }) => (
                    <th
                      key={key}
                      onClick={() =>
                        setFilters((prev) => ({
                          ...prev,
                          sortBy: key,
                          sortOrder: prev.sortBy === key && prev.sortOrder === "asc" ? "desc" : "asc",
                          page: 1,
                        }))
                      }
                      className="text-left p-2 cursor-pointer select-none hover:opacity-80 transition"
                    >
                      {label}
                      {filters.sortBy === key && (
                        <span className="ml-1 text-xs">{filters.sortOrder === "asc" ? "▲" : "▼"}</span>
                      )}
                    </th>
                  ))}
                  <th className="p-2 text-center">Actions</th>
                </tr>
              </thead>
              <tbody>
                {polls.map((p) => (
                  // match bazaars row border
                  <tr key={p._id} className="border-t border-root">
                    <td className="p-2 align-middle">
                      <div className="flex flex-col">
                        <span>{p.title || "Vendor Poll"}</span>
                        {p.description && <span className="text-xs text-root-secondary truncate max-w-[260px]">{p.description}</span>}
                      </div>
                    </td>
                    <td className="p-2 align-middle">
                      <span>{getPollEventName(p)}</span>
                    </td>
                    <td className="p-2 align-middle">
                      <span>{p.createdAt ? formatLocalTime(p.createdAt) : "—"}</span>
                    </td>
                    <td className="p-2 align-middle">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs  ${p.isOpen ? "inline-block px-2 py-0.5 rounded text-xs bg-green-600/40" : "inline-block px-2 py-0.5 rounded text-xs bg-red-600/40"}`}>{p.isOpen ? "Open" : "Closed"}</span>
                    </td>
                    <td className="p-2 align-middle text-sm">{p.totalVotes ?? 0}</td>
                    <td className="p-2">
                      <div className="flex justify-center items-center">
                        <button
                          type="button"
                          onClick={() => viewPoll(p._id)}
                        className="px-3 py-1.5 rounded-xl btn-primary text-root-primary text-sm hover:opacity-90 transition"
                        >
                          View
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {/* move Pagination outside table wrapper like bazaars */}
        <div className="pt-4">
          <Pagination
            page={filters.page}
            limit={filters.limit}
            totalCount={totalCount}
            onPageChange={(p) => setFilters((f) => ({ ...f, page: p }))}
            onLimitChange={(l) => setFilters((f) => ({ ...f, limit: l, page: 1 }))}
          />
        </div>
      </div>

      {/* Poll Details Modal */}
      {showDetailsModal && selectedPoll && (
        <div className="fixed inset-0 flex items-center justify-center z-50">
          <div
            className="absolute inset-0 bg-root/30 backdrop-blur-sm"
              onClick={() => {
                setShowDetailsModal(false);
                setSelectedPoll(null);
                setPollVotes([]);
                setPollOptions([]);
              }}
          />

          <div className="relative bg-surface border border-root rounded-2xl p-6 w-full max-w-2xl text-root-secondary max-h-[85vh] overflow-y-auto shadow-elevated z-10">
            <div className="flex justify-between items-start mb-3">
              <h2 className="text-2xl font-semibold">
                {selectedPoll.title || "Vendor Poll"}
              </h2>
              <div className="text-sm text-root-secondary">
                {selectedPoll.isOpen ? (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-green-500/15 border border-green-400/60 text-green-200">Open</span>
                ) : (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-red-500/10 border border-red-400/60 text-red-200">Closed</span>
                )}
              </div>
            </div>

            <p className="text-root-secondary mb-4">{selectedPoll.description || "No description."}</p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4 text-sm text-root-secondary">
              <div>
                <div className="font-medium text-xs text-root-secondary uppercase">Event</div>
                <div>{getPollEventName(selectedPoll)}</div>
              </div>
              <div>
                <div className="font-medium text-xs text-root-secondary uppercase">Created</div>
                <div>{selectedPoll.createdAt ? formatLocalTime(selectedPoll.createdAt) : "—"}</div>
              </div>
            </div>

            <div className="mb-4">
              <h3 className="text-sm font-semibold mb-2">Votes</h3>
              {pollLoading ? (
                <div className="text-sm text-root-secondary">Loading votes…</div>
              ) : pollVotes.length === 0 && pollOptions.length === 0 ? (
                <div className="rounded-xl bg-black/30 border border-dashed border-root/50 px-4 py-6 text-center text-sm text-root-secondary">No votes yet.</div>
              ) : pollVotes.length === 0 && pollOptions.length > 0 ? (
                <div className="overflow-auto">
                  <table className="w-full text-sm">
                    <thead className="text-root-secondary opacity-80">
                      <tr>
                        <th className="p-2 text-left">Vendor</th>
                        <th className="p-2 text-left">Booth</th>
                        <th className="p-2 text-left">Votes</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pollOptions.map((opt, i) => (
                        <tr key={opt._id ?? opt.applicationId ?? i} className="border-t border-root">
                          <td className="p-2 align-middle text-sm">{opt.vendorName || opt.vendor || "—"}</td>
                          <td className="p-2 align-middle text-sm">{opt.boothNumber ?? "—"}</td>
                          <td className="p-2 align-middle text-sm">{opt.voteCount ?? 0}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                // match bazaars votes table styling (no outer white border)
                <div className="overflow-auto">
                  <table className="w-full text-sm">
                    <thead className="text-root-secondary opacity-80">
                      <tr>
                        <th className="p-2 text-left">Voter</th>
                        <th className="p-2 text-left">Choice</th>
                        <th className="p-2 text-left">Submitted At</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pollVotes.map((v, i) => (
                        <tr key={v._id || v.id || i} className="border-t border-root">
                          <td className="p-2 align-middle text-sm">
                            <div className="flex flex-col">
                              <span className="font-medium">{v.voterName || v.name || (v.user && String(v.user)) || "Anonymous"}</span>
                              {v.voterEmail ? <span className="text-xs text-root-secondary">{v.voterEmail}</span> : null}
                            </div>
                          </td>
                          <td className="p-2 align-middle text-sm">{v.choice || v.selected || "—"}</td>
                          <td className="p-2 align-middle text-sm">{v.createdAt ? formatLocalTime(v.createdAt) : "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2">
              <button
                onClick={() => {
                  setShowDetailsModal(false);
                  setSelectedPoll(null);
                  setPollVotes([]);
                }}
                className="px-4 py-2 rounded btn-primary cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
