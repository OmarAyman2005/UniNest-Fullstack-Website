"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { api } from "../../../lib/admin/eventApi.js";
import { FaUndo } from "react-icons/fa";
import { formatLocalTime } from "@/lib/dateFormatter.js";
import Pagination from "@/components/pagination.js";
import { ActionsDropdown } from "@/components/actionDropdown.js";
import Toast from "@/components/toast.js"; // <-- use shared Toast component
import ViewDetailsModal from "./viewDetails.js"; // added import

export default function WorkshopsAdmin() {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(false);
  const [banner, setBanner] = useState({ text: "", tone: "info" });
  const [detailsModal, setDetailsModal] = useState({ open: false, request: null });

  // single shared transient toast (matches Trips page usage)
  const [toastState, setToastState] = useState(null);
  const TOAST_DEFAULT_DURATION = 4000;
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmPayload, setConfirmPayload] = useState(null);

  // Comment modal state & helpers to fix ReferenceError (commentModalOpen / commentModalPayload)
  const [commentModalOpen, setCommentModalOpen] = useState(false);
  const [commentModalPayload, setCommentModalPayload] = useState(null);
  const [commentText, setCommentText] = useState("");

  const showToast = (type = "success", title = "", description = "", duration = TOAST_DEFAULT_DURATION) => {
    const message = description ? `${title} — ${description}` : title || "";
    setToastState({ message, type: type === "error" ? "error" : "success" });
    if (duration > 0) {
      setTimeout(() => setToastState(null), duration);
    }
  };

  const router = useRouter();
  const [hasAccess, setHasAccess] = useState(null);
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
    return () => { mounted = false; };
  }, [router]);

  // Pagination + Filters
  const [filters, setFilters] = useState({
    name: "",
    faculty: "",
    status: "",
    page: 1,
    limit: 5,
    sortBy: "createdAt",
    sortOrder: "desc",
  });
  const [totalCount, setTotalCount] = useState(0);

  const load = async () => {
    setLoading(true);
    setBanner({ text: "", tone: "info" });
    try {
      const params = new URLSearchParams();
      Object.entries(filters).forEach(([key, value]) => {
        if (value === "" || value === null || value === undefined) return;
        // don't send sortBy/sortOrder directly to backend here — backend expects `sort`
        if (key === "sortBy" || key === "sortOrder") return;
        params.append(key, String(value));
      });

      // backend sort field mapping (kept so server can still do optimized sort)
      const sortFieldMap = {
        name: "workshop.name",
        faculty: "workshop.faculty",
        creator: "createdBy.fullName",
        status: "status",
        createdAt: "createdAt",
      };
      if (filters.sortBy) {
        const mapped = sortFieldMap[filters.sortBy] || filters.sortBy;
        const sortParam = `${filters.sortOrder === "desc" ? "-" : ""}${mapped}`;
        params.append("sort", sortParam);
      }

      // request initial page to obtain total and page-of-data
      const data = await api(`/workshopRequests?${params.toString()}`);
      const total = data.total ?? data.totalRequests ?? (data.data?.length || 0);

      // helpers: stable, case/diacritic-insensitive text sorting and robust date sorting
      const applyTextSort = (items, field, order = "asc") => {
        const collator = new Intl.Collator(undefined, { sensitivity: "base", numeric: true });
        const mapped = items.map((v, i) => {
          let raw = "";
          if (field === "creator") {
            raw = v?.createdBy?.fullName ?? v?.createdBy?.email ?? "";
          } else if (field === "faculty") {
            raw = v?.workshop?.faculty ?? v?.[field] ?? "";
          } else if (field === "name") {
            raw = v?.workshop?.name ?? v?.[field] ?? "";
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

      // page / limit
      let items = Array.isArray(data?.data) ? data.data.slice() : [];
      const page = Number(filters.page || 1);
      const limit = Number(filters.limit || 5);

      // If global sort requested and dataset spans multiple pages, fetch full set, sort, then slice
      if (filters.sortBy && total > limit) {
        const allParams = new URLSearchParams();
        Object.entries(filters).forEach(([key, value]) => {
          if (value === "" || value === null || value === undefined) return;
          allParams.append(key, String(value));
        });
        allParams.set("page", 1);
        allParams.set("limit", Math.max(1, total));

        // keep backend `sort` mapping when fetching the full set (server may optimize)
        if (filters.sortBy) {
          const mapped = sortFieldMap[filters.sortBy] || filters.sortBy;
          const sortParam = `${filters.sortOrder === "desc" ? "-" : ""}${mapped}`;
          allParams.set("sort", sortParam);
        }

        const allData = await api(`/workshopRequests?${allParams.toString()}`);
        let allItems = Array.isArray(allData?.data) ? allData.data.slice() : [];

        if (["name", "faculty", "creator"].includes(filters.sortBy)) {
          allItems = applyTextSort(allItems, filters.sortBy, filters.sortOrder);
        } else if (["createdAt"].includes(filters.sortBy)) {
          allItems = applyDateSort(allItems, filters.sortBy, filters.sortOrder);
        }

        const start = (page - 1) * limit;
        items = allItems.slice(start, start + limit);
      } else {
        // fallback: sort only current page
        if (["name", "faculty", "creator"].includes(filters.sortBy)) {
          items = applyTextSort(items, filters.sortBy, filters.sortOrder);
        } else if (["createdAt"].includes(filters.sortBy)) {
          items = applyDateSort(items, filters.sortBy, filters.sortOrder);
        }
      }

      setRequests(items);
      setTotalCount(total);
    } catch (e) {
      setBanner({ text: e.message || "Failed to load workshop requests", tone: "error" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [filters]);

  const changeRequestStatus = async (requestId, status, comment = "") => {
    try {
      await api(`/workshopRequests/${requestId}/status`, {
        method: "PATCH",
        body: { status, comment },
      });
      const message =
        status === "accepted"
          ? "Workshop request accepted"
          : status === "rejected"
            ? "Workshop request rejected"
            : "Edit requested for workshop";
      showToast("success", message);
      await load();
    } catch (e) {
      showToast("error", "Failed to update request", e.message || "");
    }
  };

  const handleAccept = async (reqDoc) => {
    setConfirmPayload({
      message: "Accept this workshop and publish it?",
      onConfirm: async () => {
        setConfirmOpen(false);
        await changeRequestStatus(reqDoc._id, "accepted", "");
      },
    });
    setConfirmOpen(true);
  };

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

  const columns = [
    { key: "name", label: "Name" },
    { key: "faculty", label: "Faculty" },
    { key: "creator", label: "Creator" },
    { key: "status", label: "Status" },
    { key: "createdAt", label: "Submitted" },
    { key: "actions", label: "Actions", sortable: false },
  ];

  const toggleSort = (key) => {
    if (!key || key === "actions") return;
    setFilters((prev) => {
      const newOrder =
        prev.sortBy === key && prev.sortOrder === "asc" ? "desc" : "asc";
      return { ...prev, sortBy: key, sortOrder: newOrder, page: 1 };
    });
  };

  const fetchProfessorById = async (id) => {
    if (!id) return null;
    try {
      const res = await api(`/public/professors/${id}`);
      let payload = res;
      if (res && typeof res.json === "function") {
        payload = await res.json();
      }
      return payload?.data ?? payload ?? null;
    } catch (err) {
      console.error("fetchProfessorById error:", err);
      return null;
    }
  };

  const openDetailsModal = async (request) => {
    if (!request) return setDetailsModal({ open: true, request });

    const copy = { ...request, workshop: { ...(request.workshop || {}) } };
    const w = copy.workshop;

    if (Array.isArray(w.professors) && w.professors.length > 0) {
      const resolved = await Promise.all(
        w.professors.map(async (p) => {
          if (!p) return p;
          if (typeof p === "string" || typeof p === "number") {
            const prof = await fetchProfessorById(String(p));
            return prof
              ? { _id: prof._id || prof.id || String(p), fullName: prof.fullName || prof.name || prof.email, email: prof.email || "" }
              : { _id: String(p) };
          }
          if (p._id && (p.fullName || p.name)) return p;
          const prof = await fetchProfessorById(p._id || p.id);
          return prof
            ? { _id: prof._id || prof.id, fullName: prof.fullName || prof.name || prof.email, email: prof.email || "", contribution: p.contribution }
            : p;
        })
      );
      w.professors = resolved;
      copy.workshop = w;
    }

    setDetailsModal({ open: true, request: copy });
  };

  const openCommentModal = (request, action = "rejected") => {
    setCommentModalPayload({ request, action });
    setCommentText("");
    setCommentModalOpen(true);
  };

  const closeCommentModal = () => {
    setCommentModalOpen(false);
    setCommentModalPayload(null);
    setCommentText("");
  };

  const submitCommentAction = async () => {
    if (!commentModalPayload?.request) return closeCommentModal();
    try {
      // changeRequestStatus is defined above in this file
      await changeRequestStatus(
        commentModalPayload.request._id,
        commentModalPayload.action,
        commentText || ""
      );
    } catch (err) {
      showToast("error", "Failed to submit comment", err?.message || "");
    } finally {
      closeCommentModal();
    }
  };

  if (hasAccess === null) return <main className="p-8">Checking permissions...</main>;
  if (hasAccess === false) return null;

  return (
    <main className="p-8 space-y-6">
      {/* --- NEW: Toast Container (reused pattern from end-user page) */}
      {toastState && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50">
          <Toast
            message={toastState.message}
            type={toastState.type}
            duration={TOAST_DEFAULT_DURATION}
            onClose={() => setToastState(null)}
          />
        </div>
      )}
      {/* --- END Toast Container */}

      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <h1 className="text-3xl font-semibold text-root-primary hover:opacity-80 transition">Workshop Requests</h1>
        <div className="flex gap-2">
          <Link href="/admin" className="flex items-center gap-2 px-4 py-2 rounded-2xl btn-primary text-root-primary hover:opacity-90 transition">
            <FaUndo className="text-lg" /> Home
          </Link>
        </div>
      </div>

      {/* Banner */}
      <Banner text={banner.text} tone={banner.tone} />

      {/* Filters (inline, using global.css tokens) */}
      <div className="p-4 rounded-2xl bg-surface text-root-secondary">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <div className="flex flex-col gap-1">
            <label className="text-xs uppercase opacity-80">Search</label>
            <input
              className="px-3 py-2 rounded input-surface"
              placeholder="Workshop name…"
              value={filters.name}
              onChange={(e) => setFilters((f) => ({ ...f, name: e.target.value, page: 1 }))}
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs uppercase opacity-80">Faculty</label>
            <select
              className="px-3 py-2 rounded input-surface"
              value={filters.faculty}
              onChange={(e) => setFilters((f) => ({ ...f, faculty: e.target.value, page: 1 }))}
            >
              <option value="">All</option>
              <option value="MET">MET</option>
              <option value="IET">IET</option>
              <option value="EMS">EMS</option>
              <option value="MBA">MBA</option>
              <option value="MGT">MGT</option>
              <option value="LAW">LAW</option>
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
              <option value="pending">Pending</option>
              <option value="accepted">Accepted</option>
              <option value="rejected">Rejected</option>
              <option value="edit_required">Edit Required</option>
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs uppercase opacity-80">Submitted From</label>
            <input
              type="datetime-local"
              className="px-3 py-2 rounded input-surface"
              value={filters.fromDate || ""}
              onChange={(e) => setFilters((f) => ({ ...f, fromDate: e.target.value || "", page: 1 }))}
            />
          </div>

          <div className="flex items-end">
            <div className="w-full" />
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="p-4 rounded-2xl bg-surface text-root-primary">
        {loading ? (
          <p>Loading...</p>
        ) : requests.length === 0 ? (
          <p className="opacity-70">No workshop requests found.</p>
        ) : (
          <div className="overflow-auto">
            <table className="w-full text-sm">
              <thead className="text-root-secondary opacity-80">
                <tr>
                  {columns.map(({ key, label, sortable = true }) => (
                    <th
                      key={key}
                      onClick={() => (sortable ? toggleSort(key) : null)}
                      className={`text-left p-2 ${sortable ? "cursor-pointer select-none hover:opacity-80 transition" : ""}`}
                    >
                      {label}
                      {filters.sortBy === key && sortable && (
                        <span className="ml-1 text-xs">
                          {filters.sortOrder === "asc" ? "▲" : "▼"}
                        </span>
                      )}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {requests.map((r) => {
                  const w = r.workshop || {};
                  const actions = [
                    { label: "View", onClick: () => openDetailsModal(r) },
                    {
                      label: "Accept & Publish",
                      onClick: () => handleAccept(r),
                      disabled: r.status === "accepted",
                    },
                    {
                      label: "Request Edits",
                      onClick: () => openCommentModal(r, "edit_required"),
                      disabled: r.status === "edit_required",
                    },
                    {
                      label: "Reject",
                      onClick: () => openCommentModal(r, "rejected"),
                      danger: true,
                      disabled: r.status === "rejected",
                    },
                  ];

                  return (
                    <tr key={r._id} className="border-t border-root">
                      <td className="p-2 text-root-primary">{w.name || "—"}</td>
                      <td className="p-2 text-root-primary">{w.faculty || "—"}</td>
                      <td className="p-2 text-root-primary">{r.createdBy?.fullName || r.createdBy?.email || "—"}</td>
                      <td className="p-2">
                        {(() => {
                          const pending = r.status === "pending";
                          const accepted = r.status === "accepted";
                          const rejected = r.status === "rejected";
                          const editReq = r.status === "edit_required";

                          if (pending) {
                            return (
                              <span className="inline-block px-2 py-0.5 rounded text-xs bg-yellow-600/40">
                                Pending
                              </span>
                            );
                          }
                          if (accepted) {
                            return (
                              <span className="inline-block px-2 py-0.5 rounded text-xs bg-green-600/40">
                                Accepted
                              </span>
                            );
                          }
                          if (rejected) {
                            return (
                              <span className="inline-block px-2 py-0.5 rounded text-xs bg-red-600/40">
                                Rejected
                              </span>
                            );
                          }
                          if (editReq) {
                            return (
                              <span className="inline-block px-2 py-0.5 rounded text-xs bg-yellow-600/40">
                                Edit Required
                              </span>
                            );
                          }
                          return <span className="inline-block px-2 py-0.5 rounded text-xs bg-black/30">n/a</span>;
                        })()}
                      </td>
                      <td className="p-2 text-root-primary">{new Date(r.createdAt || r.createdAt).toLocaleString?.() || "—"}</td>
                      <td className="py-2 flex gap-2 flex-wrap">
                        <ActionsDropdown event={r} actions={actions} />
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
              onLimitChange={(newLimit) => setFilters((f) => ({ ...f, limit: newLimit, page: 1 }))}
            />
          </div>
        )}
      </div>

      {/* Details Modal: use centralized ViewDetailsModal component */}
      {detailsModal.open && (
        <ViewDetailsModal
          request={detailsModal.request}
          onClose={() => setDetailsModal({ open: false, request: null })}
        />
      )}

      {/* Comment modal for Reject / Request Edits */}
      {commentModalOpen && commentModalPayload && (
        <div className="fixed inset-0 z-60 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/60" onClick={closeCommentModal} />
          <div className="relative z-10 w-full max-w-xl bg-surface text-root-primary rounded-2xl p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-semibold">
                {commentModalPayload.action === "rejected" ? "Reject Workshop" : "Request Edits"}
              </h3>
            </div>

            <div className="mb-3">
              <label className="block text-sm font-medium mb-1">Comment (visible to requester)</label>
              <textarea
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                rows={6}
                className="w-full rounded input-surface p-2 text-root-primary"
                placeholder="Provide a comment explaining the rejection or the edits needed..."
              />
            </div>

            <div className="flex justify-end gap-2">
              <button onClick={closeCommentModal} className="px-4 py-2 rounded bg-black hover:opacity-80 text-root-primary transition hover:cursor-pointer">Cancel</button>
              <button
                onClick={submitCommentAction}
                className={`px-4 py-2 rounded text-root-primary hover:opacity-90 transition hover:cursor-pointer ${
                  commentModalPayload?.action === "rejected" ? "bg-error" : "bg-yellow-600"
                }`}
              >
                {commentModalPayload.action === "rejected" ? "Reject" : "Send Edit Request"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm modal (match Bazaars style) */}
      {confirmOpen && confirmPayload && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/40 z-50 p-4">
          <div className="bg-surface text-root-primary rounded-2xl p-6 w-96 text-center space-y-4 shadow-elevated border border-root">
            <h3 className="text-lg font-semibold">Please confirm</h3>
            <p className="text-sm text-root-secondary">{confirmPayload.message}</p>
            <div className="flex justify-center gap-4">
              <button
                onClick={() => {
                  setConfirmOpen(false);
                  setConfirmPayload(null);
                }}
                className="px-4 py-2 rounded-lg input-surface hover:opacity-90 transition hover:cursor-pointer"
                type="button"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  confirmPayload.onConfirm && confirmPayload.onConfirm();
                  setConfirmPayload(null);
                }}
                className="px-4 py-2 rounded-lg bg-success text-root-primary hover:opacity-90 transition hover:cursor-pointer"
                type="button"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        .toast-wrapper {
          position: fixed;
          top: 72px;
          left: 0;
          right: 0;
          pointer-events: none;
          z-index: 60;
          display: flex;
          justify-content: center;
          align-items: flex-start;
        }
        .toast-list {
          width: min(720px, calc(100% - 48px));
          display: flex;
          flex-direction: column;
          gap: 10px;
          align-items: center;
          pointer-events: auto;
        }
        .toast-item {
          width: 100%;
          display: flex;
          justify-content: center;
        }
        .confirm-modal {
          box-shadow: 0 10px 30px rgba(2, 6, 23, 0.6);
          animation: modal-fade-in 220ms ease;
        }
        @keyframes modal-fade-in {
          from {
            opacity: 0;
            transform: translateY(-8px) scale(0.995);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }
        .z-60 { z-index: 60; }
        @media (max-width: 640px) {
          .toast-list { width: calc(100% - 28px); }
        }
      `}</style>
    </main>
  );
}

// Details modal (unchanged content but styled to global tokens)
function DetailsModal({ request, onClose }) {
  if (!request) return null;
  const workshop = request.workshop || {};
  const professors = workshop.professors || [];
  const resources = workshop.extraRequiredResources || [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative z-10 w-full max-w-2xl bg-surface text-root-primary rounded-2xl p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-semibold">Workshop Request Details</h3>
          <button className="px-3 py-1 rounded bg-black/30 text-root-primary" onClick={onClose}>Close</button>
        </div>

        <div className="mb-3">
          <h4 className="font-medium mb-2">Request</h4>
          <div className="bg-black/20 rounded px-3 py-2">
            <div><strong>Status:</strong> {request.status}</div>
            {request.comment && <div className="mt-1"><strong>Comment:</strong> {request.comment}</div>}
            <div className="mt-1"><strong>Submitted by:</strong> {request.createdBy?.fullName || request.createdBy?.email || "—"}</div>
          </div>
        </div>

        <div className="mb-3">
          <h4 className="font-medium mb-2">Workshop</h4>
          <div className="bg-black/20 rounded px-3 py-2 space-y-2">
            <div className="font-medium">{workshop.name || "—"}</div>
            {workshop.description && <div className="text-sm opacity-70">{workshop.description}</div>}
            <div className="text-sm opacity-70">Location: {workshop.location || "—"}</div>
            <div className="text-sm opacity-70">Start: {formatLocalTime(workshop.startDateTime)}</div>
            <div className="text-sm opacity-70">End: {formatLocalTime(workshop.endDateTime)}</div>
          </div>
        </div>

        <div className="mb-3">
          <h4 className="font-medium mb-2">Professors</h4>
          {professors.length === 0 ? (
            <p className="opacity-70">No professors added.</p>
          ) : (
            <div className="space-y-2">
              {professors.map((p, i) => {
                const name = p?.name || p?.fullName || String(p);
                const dept = p?.department || "";
                const contrib = p?.contribution || "";
                return (
                  <div key={i} className="bg-black/20 rounded px-3 py-2">
                    <div className="font-medium">{name}</div>
                    {dept && <div className="text-sm opacity-70">{dept}</div>}
                    {contrib && <div className="text-sm opacity-70">Contribution: {contrib}</div>}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div>
          <h4 className="font-medium mb-2">Extra Required Resources</h4>
          {resources.length === 0 ? (
            <p className="opacity-70">No extra resources defined.</p>
          ) : (
            <div className="space-y-2">
              {resources.map((r, i) => (
                <div key={i} className="flex justify-between bg-black/20 rounded px-3 py-2">
                  <div>
                    <div className="font-medium">{r.resourceName}</div>
                  </div>
                  <div className="text-sm opacity-70">Qty: {r.quantity}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
