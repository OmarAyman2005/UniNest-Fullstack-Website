// client/src/app/(end-user)/vendor-requests/vendor-requests.js
"use client";

import React, { useEffect, useMemo, useState } from "react";
import { applicationsService } from "@/app/services/applications.service";
import { eventsService } from "@/app/services/events.service";
import Pagination from "@/components/pagination";

// ── API/service calls ─────────────────────────────────────────────────────
const listAppsByUser = (userId, extra = {}) =>
  applicationsService.listByUser(userId, extra);
const listAllApps = (query = {}) => applicationsService.list(query);
const fetchEventById = async (id) => {
  const res = await eventsService.getById(id);
  return res && res.data ? res.data : res;
};

// ── Styles (token-based, matches global CSS) ──────────────────────────────
const STYLES = {
  section: {
    padding: 24,
    minHeight: "100vh",
    backgroundColor: "var(--color-bg)",
    color: "var(--color-text-primary)",
  },
  h1: {
    marginBottom: 8,
    fontSize: 22,
    fontWeight: 700,
    color: "var(--color-text-primary)",
  },
  sub: {
    marginBottom: 12,
    color: "var(--color-text-secondary)",
    fontSize: 13,
  },
  tableWrap: {
    width: "100%",
    overflowX: "auto",
    borderRadius: 16,
    border: "1px solid var(--color-border)",
    background: "var(--color-surface)",
    boxShadow: "var(--shadow-elevated)",
  },
  table: {
    width: "100%",
    borderCollapse: "separate",
    borderSpacing: 0,
  },
  thtd: {
    padding: "14px 16px",
    fontSize: 14,
    textAlign: "left",
    borderBottom: "1px solid var(--color-border)",
    whiteSpace: "nowrap",
    color: "var(--color-text-primary)",
  },
  detailsBtn: (open) => ({
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    padding: "6px 10px",
    borderRadius: 8,
    border: "1px solid var(--color-border)",
    background: open
      ? "var(--color-highlight-bg)"
      : "rgba(255, 255, 255, 0.02)",
    cursor: "pointer",
    fontSize: 13,
    fontWeight: 600,
    color: "var(--color-text-primary)",
  }),
  textDangerBtn: {
    background: "transparent",
    border: "none",
    color: "var(--color-error)",
    cursor: "pointer",
    fontSize: 13,
    fontWeight: 700,
    padding: 0,
    textDecoration: "none",
  },
  primaryBtn: {
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    padding: "8px 12px",
    borderRadius: 10,
    border: "1px solid var(--color-primary)",
    background: "var(--color-primary)",
    color: "var(--color-text-primary)",
    cursor: "pointer",
    fontSize: 13,
    fontWeight: 700,
  },
  outlineBtn: {
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    padding: "8px 12px",
    borderRadius: 10,
    border: "1px solid var(--color-border)",
    background: "transparent",
    color: "var(--color-text-primary)",
    cursor: "pointer",
    fontSize: 13,
    fontWeight: 700,
  },
  tabWrap: {
    display: "inline-flex",
    gap: 8,
    padding: 4,
    borderRadius: 999,
    background: "var(--color-surface)",
    border: "1px solid var(--color-border)",
  },
  tabBtn: (active) => ({
    padding: "6px 12px",
    borderRadius: 999,
    fontSize: 13,
    fontWeight: 700,
    cursor: "pointer",
    border: "none",
    background: active ? "var(--color-primary)" : "transparent",
    color: active ? "var(--color-text-primary)" : "var(--color-text-secondary)",
  }),
  badge: (status) => {
    const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);
    const key = cap(status);

    // token-friendly status colors
    const map = {
      Accepted: {
        bg: "rgba(34, 197, 94, 0.1)", // success-ish
        color: "var(--color-success)",
        border: "rgba(34, 197, 94, 0.4)",
      },
      Pending: {
        bg: "rgba(250, 204, 21, 0.08)",
        color: "#eab308",
        border: "rgba(250, 204, 21, 0.4)",
      },
      Rejected: {
        bg: "rgba(239, 68, 68, 0.12)",
        color: "var(--color-error)",
        border: "rgba(239, 68, 68, 0.5)",
      },
      Cancelled: {
        bg: "rgba(148, 163, 184, 0.15)",
        color: "var(--color-text-secondary)",
        border: "rgba(148, 163, 184, 0.4)",
      },
    };

    const s = map[key] || map.Cancelled;
    return {
      display: "inline-block",
      padding: "4px 10px",
      borderRadius: 999,
      fontSize: 12,
      fontWeight: 600,
      background: s.bg,
      color: s.color,
      border: `1px solid ${s.border}`,
      lineHeight: 1,
    };
  },
};

const PayIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
    <rect
      x="3"
      y="6"
      width="18"
      height="12"
      rx="2"
      ry="2"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
    />
    <path d="M3 9h18M7 14h6" stroke="currentColor" strokeWidth="1.6" />
  </svg>
);

const Chevron = ({ open }) => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    style={{
      transform: `rotate(${open ? 180 : 0}deg)`,
      transition: "transform .15s ease",
    }}
    aria-hidden="true"
  >
    <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" fill="none" />
  </svg>
);

// ── Helpers ───────────────────────────────────────────────────────────────
const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

// Pretty event type for UI (handles loyaltyProgram → Loyalty Program)
const prettyEventType = (t) => {
  const raw = String(t || "").trim();
  if (!raw) return "—";
  const low = raw.toLowerCase().replace(/\s+/g, "");
  if (low === "loyaltyprogram" || low === "loyalty_program") {
    return "Loyalty Program";
  }
  return cap(raw);
};

// strict dd/MM/yyyy hh:mm AM/PM
function fmtDTStrict(d) {
  if (!d) return "—";
  const dt = new Date(d);
  if (isNaN(+dt)) return "—";
  const dd = String(dt.getDate()).padStart(2, "0");
  const mm = String(dt.getMonth() + 1).padStart(2, "0");
  const yyyy = dt.getFullYear();
  let h = dt.getHours();
  const ampm = h >= 12 ? "PM" : "AM";
  h = h % 12;
  if (h === 0) h = 12;
  const mins = String(dt.getMinutes()).padStart(2, "0");
  return `${dd}/${mm}/${yyyy} ${h}:${mins} ${ampm}`;
}

// strict dd/MM/yyyy (no time)
function fmtDStrict(d) {
  if (!d) return "—";
  const dt = new Date(d);
  if (isNaN(+dt)) return "—";
  const dd = String(dt.getDate()).padStart(2, "0");
  const mm = String(dt.getMonth() + 1).padStart(2, "0");
  const yyyy = dt.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

function normalizeEvent(eventish) {
  if (!eventish) return null;
  if (
    eventish.data &&
    (eventish.data._id || eventish.data.name || eventish.data.title)
  )
    return eventish.data;
  if (eventish._id || eventish.name || eventish.title) return eventish;
  return null;
}

function mapAppToRow(app, eventDocRaw) {
  const eventDoc = normalizeEvent(eventDocRaw);
  if (!eventDoc) {
    // caller will drop this app entirely
    return null;
  }

  const name = eventDoc?.name || eventDoc?.title || "—";
  const eventType = eventDoc?.eventType || eventDoc?.type || "—";
  const startRaw = eventDoc?.startDateTime || eventDoc?.startsAt;
  const endRaw = eventDoc?.endDateTime || eventDoc?.endsAt;
  const location = eventDoc?.location || "—";
  const description =
    eventDoc?.fullAgenda ||
    eventDoc?.description ||
    eventDoc?.shortDescription ||
    "—";

  return {
    id: app._id,
    event: name,
    type: eventType, // keep raw, prettify at render
    start: fmtDTStrict(startRaw),
    end: fmtDTStrict(endRaw),
    startRaw,
    endRaw,
    location,
    status: cap(app.status || "pending"),
    app,
    eventDoc,
    description,
  };
}

// Pull setup window + related vendor fields
function extractVendorFields(app) {
  const setupStart =
    app?.reservationStart ??
    app?.startDate ??
    app?.setupStart ??
    app?.boothReservationStart ??
    null;

  const setupEnd =
    app?.reservationEnd ??
    app?.endDate ??
    app?.setupEnd ??
    app?.boothReservationEnd ??
    null;

  const durationWeeks = app?.durationWeeks ?? app?.setupDurationWeeks ?? null;

  const boothNumber =
    app?.boothNumber ?? app?.setupLocation ?? app?.booth ?? null;

  const boothSize = app?.boothSize ?? null;

  const participants = Array.isArray(app?.participants)
    ? app.participants.slice(0, 5)
    : [];

  return {
    setupStart,
    setupEnd,
    durationWeeks,
    boothNumber,
    boothSize,
    participants,
  };
}

// Generic presence check
const isPresent = (v) => {
  if (v === null || v === undefined) return false;
  if (typeof v === "string") return v.trim().length > 0 && v.trim() !== "—";
  if (Array.isArray(v)) return v.length > 0;
  return true;
};

// ── Component ─────────────────────────────────────────────────────────────
export default function VendorRequests({
  vendorId,
  role = "vendor",
  vendorName,
}) {
  const isStaff = ["admin", "event_office"].includes(
    String(role || "").toLowerCase()
  );
  const title = isStaff ? "Vendor Participation Requests" : "Your Requests";

  const [tab, setTab] = useState("All");
  const [openIndex, setOpenIndex] = useState(null);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  // Filters (match admin page)
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [eventTypeFilter, setEventTypeFilter] = useState("all");
  // Sorting (match admin UI)
  const [sortKey, setSortKey] = useState(null); // 'event' | 'type' | 'start' | 'end' | 'location' | 'status'
  const [sortDir, setSortDir] = useState("asc");

  const toggleSort = (key) => {
    setPage(1);
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  const caret = (key) => (sortKey === key ? (sortDir === "asc" ? " ▲" : " ▼") : "");
  const SortBtn = ({ k, children }) => (
    <button
      type="button"
      onClick={() => toggleSort(k)}
      className="w-full text-left p-2 hover:opacity-80"
      title={`Sort by ${children}`}
    >
      {children}
      {caret(k)}
    </button>
  );

  // Load applications + related events
  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        setLoading(true);
        setErr("");

        const apps = isStaff
          ? await listAllApps()
          : await listAppsByUser(vendorId);

        const cache = new Map();
        const getEvent = async (id) => {
          const key = String(id);
          if (cache.has(key)) return cache.get(key);
          const doc = await fetchEventById(key).catch(() => null);
          cache.set(key, doc);
          return doc;
        };

        const mappedRowsRaw = await Promise.all(
          apps.map(async (app) => {
            // prefer embedded event, fallback to eventId fetch
            let eventDoc =
              normalizeEvent(app.event) || normalizeEvent(app.eventId);

            if (!eventDoc && app.eventId && typeof app.eventId === "string") {
              eventDoc = await getEvent(app.eventId);
            }

            // if still no event → drop this application
            if (!eventDoc) return null;

            return mapAppToRow(app, eventDoc);
          })
        );

        const mappedRows = mappedRowsRaw.filter(Boolean);

        if (alive) setRows(mappedRows);
      } catch (e) {
        if (alive) setErr(String(e?.message || e));
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [isStaff, vendorId]);

  // ── Actions: accept / reject / cancel ───────────────────────────────────
  const patchRowStatus = (appId, newStatus) => {
    setRows((prev) =>
      prev.map((r) =>
        r.id === appId
          ? {
              ...r,
              status: cap(newStatus),
              app: { ...r.app, status: newStatus },
            }
          : r
      )
    );
  };

  const handleAccept = async (row) => {
    try {
      await applicationsService.accept(row.id);
      patchRowStatus(row.id, "accepted");
    } catch (e) {
      alert(`Failed to accept: ${String(e?.message || e)}`);
    }
  };

  const handleReject = async (row) => {
    try {
      await applicationsService.reject(row.id);
      patchRowStatus(row.id, "rejected");
    } catch (e) {
      alert(`Failed to reject: ${String(e?.message || e)}`);
    }
  };

  const handleCancel = async (row) => {
    try {
      await applicationsService.cancel(row.id);
      patchRowStatus(row.id, "cancelled");
    } catch (e) {
      alert(`Failed to cancel: ${String(e?.message || e)}`);
    }
  };

  // derive event types for filter dropdown
  const eventTypeOptions = useMemo(() => {
    const set = new Set();
    (rows || []).forEach((r) => {
      if (r.type) set.add(String(r.type));
    });
    return ["all", ...Array.from(set).sort()];
  }, [rows]);

  // filteredRows now respects search / status / eventType and sorting (match admin)
  const filteredRows = useMemo(() => {
     const ql = String(q || "")
       .trim()
       .toLowerCase();
     let base = (rows || []).slice();
 
     if (!isStaff && tab === "Accepted") {
       base = base.filter(
         (r) => String(r.status || "").toLowerCase() === "accepted"
       );
     }
 
     base = base.filter((r) => {
       if (statusFilter && statusFilter !== "all") {
         const st = String(r.status || "").toLowerCase();
         if (st !== String(statusFilter).toLowerCase()) return false;
       }
       if (eventTypeFilter && eventTypeFilter !== "all") {
         const et = String(r.type || "").toLowerCase();
         if (et !== String(eventTypeFilter).toLowerCase()) return false;
       }
       if (!ql) return true;
       const name = String(r.event || "").toLowerCase();
       const vendor = String(
         r.app?.applicantName || r.app?.vendorName || ""
       ).toLowerCase();
       return name.includes(ql) || vendor.includes(ql);
     });
 
    // Sorting: apply after filtering
    if (sortKey) {
      const arr = base.slice();
      arr.sort((a, b) => {
        let av = "";
        let bv = "";

        switch (sortKey) {
          case "event":
            av = String(a.event || "").toLowerCase();
            bv = String(b.event || "").toLowerCase();
            break;
          case "type":
            av = String(a.type || "").toLowerCase();
            bv = String(b.type || "").toLowerCase();
            break;
          case "location":
            av = String(a.location || "").toLowerCase();
            bv = String(b.location || "").toLowerCase();
            break;
          case "status":
            av = String(a.status || "").toLowerCase();
            bv = String(b.status || "").toLowerCase();
            break;
          case "start":
            av = a.startRaw ? Date.parse(a.startRaw) || 0 : 0;
            bv = b.startRaw ? Date.parse(b.startRaw) || 0 : 0;
            break;
          case "end":
            av = a.endRaw ? Date.parse(a.endRaw) || 0 : 0;
            bv = b.endRaw ? Date.parse(b.endRaw) || 0 : 0;
            break;
         default:
           av = "";
           bv = "";
       }
       if (typeof av === "number" || typeof bv === "number") {
         return sortDir === "asc" ? Number(av) - Number(bv) : Number(bv) - Number(av);
      }
       if (av < bv) return sortDir === "asc" ? -1 : 1;
       if (av > bv) return sortDir === "asc" ? 1 : -1;
       return 0;
     });
     return arr;
   }
     return base;
 }, [rows, isStaff, tab, q, statusFilter, eventTypeFilter, sortKey, sortDir]);

  // pagination + selection state
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(8);
  const [selected, setSelected] = useState(null);
  // computed pagination values
  const totalCount = filteredRows.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / (limit || 1)));
  const currentPage = Math.min(Math.max(1, page), totalPages);
  const start = (currentPage - 1) * limit;
  const pageRows = filteredRows.slice(start, start + limit);

  const toggle = (idx) => setOpenIndex((curr) => (curr === idx ? null : idx));
  const COLS = 7;

  return (
    <section style={STYLES.section}>
      <h1 style={STYLES.h1}>{title}</h1>
      <div style={STYLES.sub}></div>

      {/* Filters: match admin UI */}
      <div
        className="p-4 rounded-2xl bg-surface text-root-secondary"
        style={{ marginBottom: 12 }}
      >
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="flex flex-col gap-1">
            <label className="text-xs uppercase opacity-80">Search</label>
            <input
              className="px-3 py-2 rounded input-surface"
              placeholder="Event name or vendor…"
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setOpenIndex(null);
              }}
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs uppercase opacity-80">Status</label>
            <select
              className="px-3 py-2 rounded input-surface"
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
              }}
            >
              {["all", "pending", "accepted", "rejected"].map((s) => (
                <option key={s} value={s}>
                  {s === "all" ? "All" : cap(s)}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs uppercase opacity-80">Event type</label>
            <select
              className="px-3 py-2 rounded input-surface"
              value={eventTypeFilter}
              onChange={(e) => {
                setEventTypeFilter(e.target.value);
              }}
            >
              {eventTypeOptions.map((t) => (
                <option key={t} value={t}>
                  {t === "all" ? "All" : prettyEventType(String(t))}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-end">
            <div className="w-full" />
          </div>
        </div>
      </div>

      {loading && (
        <div style={{ padding: 12, color: "var(--color-text-secondary)" }}>
          Loading applications…
        </div>
      )}
      {err && !loading && (
        <div
          style={{
            padding: 12,
            color: "var(--color-error)",
          }}
        >
          Failed to load: {err}
        </div>
      )}

      {!loading && !err && (
        <div style={STYLES.tableWrap}>
          <table
            style={STYLES.table}
            className="vr-requests-table"
            aria-label="Vendor Requests"
          >
            <thead>
              <tr>
                <th style={{ ...STYLES.thtd, fontWeight: 600, color: "var(--color-text-secondary)" }}>
                  <SortBtn k="event">Event</SortBtn>
                </th>
                <th style={{ ...STYLES.thtd, fontWeight: 600, color: "var(--color-text-secondary)" }}>
                  <SortBtn k="type">Event Type</SortBtn>
                </th>
                <th style={{ ...STYLES.thtd, fontWeight: 600, color: "var(--color-text-secondary)" }}>
                  <SortBtn k="start">Start</SortBtn>
                </th>
                <th style={{ ...STYLES.thtd, fontWeight: 600, color: "var(--color-text-secondary)" }}>
                  <SortBtn k="end">End</SortBtn>
                </th>
                <th style={{ ...STYLES.thtd, fontWeight: 600, color: "var(--color-text-secondary)" }}>
                  <SortBtn k="location">Location</SortBtn>
                </th>
                <th style={{ ...STYLES.thtd, fontWeight: 600, color: "var(--color-text-secondary)" }}>
                  <SortBtn k="status">Status</SortBtn>
                </th>
                <th style={{ ...STYLES.thtd, fontWeight: 600, color: "var(--color-text-secondary)", textAlign: "center" }}>
                  Details
                </th>
              </tr>
            </thead>

            <tbody>
              {totalCount === 0 ? (
                <tr>
                  <td style={STYLES.thtd} colSpan={COLS}>
                    No requests found
                    {!isStaff ? (
                      <>
                        {" "}
                        for vendor <strong>{vendorName}</strong>
                      </>
                    ) : null}
                    .
                  </td>
                </tr>
              ) : (
                pageRows.map((r, idx) => {
                  const isOpen = openIndex === idx;
                  const rowKey = r.id || `${r.event}-${idx}`;
                  const descId = `desc-${rowKey}`;

                  const applicationKind = r.app?.applicationKind || null;
                  const canCancel =
                    !isStaff &&
                    (r.status === "Pending" ||
                      (r.status === "Accepted" &&
                        applicationKind === "loyaltyProgram"));
                  const renderActions = () => {
                    if (!r.status)
                      return (
                        <span style={{ color: "var(--color-text-secondary)" }}>
                          —
                        </span>
                      );

                    if (!isStaff) {
                      // Vendor view
                      if (r.status === "Pending") {
                        return (
                          <button
                            type="button"
                            className="px-3 py-1 rounded border border-root text-root-primary text-sm hover:bg-white/10"
                            onClick={() => handleCancel(r)}
                          >
                            Cancel
                          </button>
                        );
                      }

                      if (r.status === "Accepted") {
                        if (applicationKind === "loyaltyProgram") {
                          return (
                            <button
                              type="button"
                              className="px-3 py-1 rounded border border-root text-root-primary text-sm hover:bg-white/10"
                              onClick={() => handleCancel(r)}
                            >
                              Cancel
                            </button>
                          );
                        }

                        return (
                          <div className="flex items-center gap-3">
                            <button
                              type="button"
                              className="px-3 py-1 rounded btn-primary text-root-primary text-sm"
                              onClick={() =>
                                alert(`Proceed to pay for ${r.event}`)
                              }
                            >
                              <PayIcon /> Pay
                            </button>

                            <button
                              type="button"
                              className="px-3 py-1 rounded border border-root text-root-primary text-sm hover:bg-white/10"
                              onClick={() => handleCancel(r)}
                            >
                              Cancel
                            </button>
                          </div>
                        );
                      }

                      return (
                        <span style={{ color: "var(--color-text-secondary)" }}>
                          —
                        </span>
                      );
                    } else {
                      // Staff view
                      if (r.status === "Pending") {
                        return (
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              className="px-3 py-1 rounded btn-primary text-root-primary text-sm"
                              onClick={() => handleAccept(r)}
                            >
                              Accept
                            </button>
                            <button
                              type="button"
                              className="px-3 py-1 rounded border border-root text-root-primary text-sm hover:bg-white/10"
                              onClick={() => handleReject(r)}
                            >
                              Reject
                            </button>
                          </div>
                        );
                      }
                      return (
                        <span style={{ color: "var(--color-text-secondary)" }}>
                          —
                        </span>
                      );
                    }
                  };

                  // ── DETAILS CONTENT — shown for vendor AND staff ───────
                  const {
                    setupStart,
                    setupEnd,
                    durationWeeks,
                    boothNumber,
                    boothSize,
                    participants,
                  } = extractVendorFields(r.app);

                  const participantsInline = participants.length
                    ? participants
                        .map((p) => `${p.name || "—"} — ${p.email || "—"}`)
                        .join(", ")
                    : "";

                  const loyalty = r.app?.loyalty || null;
                  const loyaltyPromoCode = loyalty?.promoCode;
                  const loyaltyDiscountRate = loyalty?.discountRate;
                  const loyaltyTerms = loyalty?.terms;

                  return (
                    <React.Fragment key={rowKey}>
                      <tr>
                        <td style={STYLES.thtd}>{r.event}</td>
                        <td style={STYLES.thtd}>{prettyEventType(r.type)}</td>
                        <td style={STYLES.thtd}>{r.start}</td>
                        <td style={STYLES.thtd}>{r.end}</td>
                        <td style={STYLES.thtd}>{r.location}</td>
                        <td style={STYLES.thtd}>
                          {(() => {
                            const st = String(r.status || "").toLowerCase();
                            if (st === "pending") {
                              return (
                                <span className="inline-block px-2 py-0.5 rounded text-xs bg-yellow-600/40">
                                  {r.status}
                                </span>
                              );
                            }
                            if (st === "accepted") {
                              return (
                                <span className="inline-block px-2 py-0.5 rounded text-xs bg-green-600/40">
                                  {r.status}
                                </span>
                              );
                            }
                            return (
                              <span style={STYLES.badge(r.status)}>
                                {r.status || "—"}
                              </span>
                            );
                          })()}
                        </td>
                        <td
                          style={{
                            ...STYLES.thtd,
                            minWidth: 160,
                            textAlign: "center",
                          }}
                        >
                          <div
                            style={{
                              display: "inline-flex",
                              gap: 8,
                              justifyContent: "center",
                              alignItems: "center",
                            }}
                          >
                            <button
                              type="button"
                              onClick={() => toggle(idx)}
                              aria-expanded={isOpen}
                              aria-controls={descId}
                              className="px-3 py-1 rounded btn-primary text-root-primary text-sm"
                            >
                              {isOpen ? "Hide details" : "Show details"}
                            </button>

                            {canCancel && (
                              <button
                                type="button"
                                className="px-3 py-1 rounded border border-root text-root-primary text-sm hover:bg-white/10"
                                onClick={() => handleCancel(r)}
                              >
                                Cancel
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>

                      <tr>
                        <td
                          id={descId}
                          colSpan={COLS}
                          style={{
                            padding: isOpen ? "12px 16px" : "0 16px",
                            background: "var(--color-highlight-bg)",
                            borderBottom: "1px solid var(--color-border)",
                            transition: "padding .18s ease",
                          }}
                        >
                          <div
                            style={{
                              maxHeight: isOpen ? 420 : 0,
                              overflow: "hidden",
                              transition: "max-height .2s ease",
                              color: "var(--color-text-secondary)",
                              fontSize: 14,
                              lineHeight: 1.5,
                            }}
                          >
                            {isOpen && (
                              <div
                                style={{
                                  display: "grid",
                                  gap: 8,
                                }}
                              >
                                {/* Summary block — only render fields that have values */}
                                {isPresent(r.event) && (
                                  <div>
                                    <strong>Event:</strong> {r.event}
                                  </div>
                                )}
                                {isPresent(r.type) && (
                                  <div>
                                    <strong>Type:</strong>{" "}
                                    {prettyEventType(r.type)}
                                  </div>
                                )}
                                {isPresent(r.location) && (
                                  <div>
                                    <strong>Location:</strong> {r.location}
                                  </div>
                                )}
                                {isPresent(r.status) && (
                                  <div>
                                    <strong>Status:</strong> {r.status}
                                  </div>
                                )}
                                {isPresent(r.description) && (
                                  <div
                                    style={{
                                      marginTop: 8,
                                    }}
                                  >
                                    <strong>Event Description</strong>
                                    <div>{r.description}</div>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination at card bottom */}
      {!loading && !err && totalCount > 0 && (
        <div
          style={{ display: "flex", justifyContent: "flex-end", paddingTop: 8 }}
        >
          <Pagination
            page={currentPage}
            limit={limit}
            totalCount={totalCount}
            onPageChange={(p) => setPage(p)}
            onLimitChange={(l) => {
              setLimit(l);
              setPage(1);
            }}
          />
        </div>
      )}

      {selected && (
        <ApplicationDetailsModal
          row={selected}
          onClose={() => setSelected(null)}
        />
      )}
    </section>
  );
}
