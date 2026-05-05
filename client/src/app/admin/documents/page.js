"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import Link from "next/link";
import Toast from "@/components/toast.js";
import Pagination from "@/components/pagination.js";
import { FaUndo } from "react-icons/fa";
export default function DocumentsPage() {
  const [documents, setDocuments] = useState([]);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  // View / preview state
  const [viewOpen, setViewOpen] = useState(false);
  const [viewObjectUrl, setViewObjectUrl] = useState(null);
  const [viewMime, setViewMime] = useState(null);
  const [viewTitle, setViewTitle] = useState("");
  const [viewLoading, setViewLoading] = useState(false);

  // Filters & pagination (use unified filters object like conferences page)
  const [filters, setFilters] = useState({
    applicantName: "", // changed: filter by applicantName
    eventId: "",
    page: 1,
    limit: 5,
    sortBy: "uploadedAt",
    sortOrder: "desc",
  });

  const [totalCount, setTotalCount] = useState(0);

  // Fetch events with documents
  useEffect(() => {
    const fetchEvents = async () => {
      try {
        const res = await api("/documents/events");
        setEvents(res.data || []);
      } catch (err) {
        console.error("Failed to fetch events:", err);
      }
    };
    fetchEvents();
  }, []);

  // Fetch documents (uses server pagination; map server pagination fields to totalCount)
  useEffect(() => {
    const fetchDocuments = async () => {
      setLoading(true);
      setError("");
      try {
        const params = new URLSearchParams({ page: String(filters.page), limit: String(filters.limit) });
        if (filters.eventId) params.append("eventId", filters.eventId);
        // send applicantName to API for filtering
        if (filters.applicantName) params.append("applicantName", filters.applicantName);
        // prefer sortBy/sortOrder, but also send legacy `sort` for servers expecting it
        if (filters.sortBy) params.append("sortBy", filters.sortBy);
        if (filters.sortOrder) params.append("sortOrder", filters.sortOrder);
        // fallback: server may expect `sort` like "-field" for desc
        if (!params.has("sort") && filters.sortBy) {
          params.append("sort", `${filters.sortOrder === "desc" ? "-" : ""}${filters.sortBy}`);
        }

        const url = `/documents?${params.toString()}`;
        console.debug("[Documents] fetch", url);
        const res = await api(url);
        const payload = res ?? {};
        console.debug("[Documents] payload", payload);

        // normalize data array (support both { data: [...] } and direct array responses)
        const docs = Array.isArray(payload) ? payload : payload.data || payload.items || [];
        let items = Array.isArray(docs) ? docs.slice() : [];

        // client-side vendor filter: if applicantName provided but backend
        // doesn't filter, perform a case-insensitive substring match here.
        if (filters.applicantName) {
          const q = String(filters.applicantName || "").trim().toLowerCase();
          if (q) {
            items = items.filter((d) => String(d?.applicantName || "").toLowerCase().includes(q));
          }
        }

        // try to read total from common pagination shapes
        const total =
          Number(payload.pagination?.total) ||
          Number(payload.total) ||
          Number(payload.totalCount) ||
          Number(payload.meta?.total) ||
          Number(payload.pagination?.count) ||
          (Array.isArray(docs) ? docs.length : 0);
        setTotalCount(Number(total) || 0);

        // sorting helpers (text/date) — case & diacritic insensitive, stable
        const applyTextSort = (arr, field, order = "asc") => {
          const collator = new Intl.Collator(undefined, { sensitivity: "base", numeric: true });
          const mapped = arr.map((v, i) => {
            const raw = String(
              field === "participantName"
                ? v.participantName ?? ""
                : field === "eventName"
                ? v.eventName ?? ""
                : v[field] ?? ""
            );
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

        const applyDateSort = (arr, field, order = "asc") => {
          const parseTime = (val) => {
            if (!val) return null;
            const t = Date.parse(val);
            return Number.isFinite(t) ? t : null;
          };
          const mapped = arr.map((v, i) => ({ v, i }));
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

        // If user requested global sorting across pages, fetch full set then sort & slice
        if (filters.sortBy && total > filters.limit) {
          const allParams = new URLSearchParams();
          if (filters.eventId) allParams.append("eventId", filters.eventId);
          if (filters.applicantName) allParams.append("applicantName", filters.applicantName);
          allParams.set("page", "1");
          allParams.set("limit", String(Math.max(1, total)));
          if (filters.sortBy) allParams.set("sortBy", filters.sortBy);
          if (filters.sortOrder) allParams.set("sortOrder", filters.sortOrder);

          const allRes = await api(`/documents?${allParams.toString()}`);
          const allPayload = allRes || {};
          let allItems = Array.isArray(allPayload.data) ? allPayload.data.slice() : [];

          // apply same client-side applicantName filter to the full dataset
          if (filters.applicantName) {
            const q = String(filters.applicantName || "").trim().toLowerCase();
            if (q) {
              allItems = allItems.filter((d) => String(d?.applicantName || "").toLowerCase().includes(q));
            }
          }

          // support sorting/filtering by applicantName on full set
          if (["applicantName", "eventName", "participantName"].includes(filters.sortBy)) {
            // map applicantName requests to the actual field if needed
            const field = filters.sortBy === "applicantName" ? "applicantName" : filters.sortBy;
            allItems = applyTextSort(allItems, field, filters.sortOrder);
          } else if (["uploadedAt"].includes(filters.sortBy)) {
            allItems = applyDateSort(allItems, filters.sortBy, filters.sortOrder);
          }

          const start = (filters.page - 1) * filters.limit;
          items = allItems.slice(start, start + filters.limit);
        } else {
          // fall back: sort within current page
          if (["applicantName", "eventName", "participantName"].includes(filters.sortBy)) {
            const field = filters.sortBy === "applicantName" ? "applicantName" : filters.sortBy;
            items = applyTextSort(items, field, filters.sortOrder);
          } else if (["uploadedAt"].includes(filters.sortBy)) {
            items = applyDateSort(items, filters.sortBy, filters.sortOrder);
          }
        }

        setDocuments(items);
      } catch (err) {
        setError(err.message || "Failed to load documents");
      } finally {
        setLoading(false);
      }
    };
    fetchDocuments();
  }, [filters.page, filters.limit, filters.eventId, filters.applicantName, filters.sortBy, filters.sortOrder]);

  const handleVerify = async (applicationId, participantIndex, docId, status, notes = "") => {
    try {
      await api(`/documents/${applicationId}/${participantIndex}/${docId}/verify`, {
        method: "PATCH",
        body: { status, notes },
      });
      setSuccess(`Document marked as ${status}`);
      setTimeout(() => setSuccess(""), 3000);

      setDocuments((prev) =>
        prev.map((doc) =>
          doc._id === docId
            ? { ...doc, verification: { ...doc.verification, status, notes } }
            : doc
        )
      );
    } catch (err) {
      setError(err.message || "Failed to update verification");
      setTimeout(() => setError(""), 3000);
    }
  };

  const getDocumentUrl = (doc) => {
    const baseUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api";
    return `${baseUrl}/documents/${doc.applicationId}/${doc.participantIndex}/${doc._id}`;
  };

  const handleDownload = async (doc) => {
    try {
      const url = getDocumentUrl(doc);
      const response = await fetch(url, {
        credentials: "include",
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token") || ""}`,
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("Download failed:", errorText);
        throw new Error("Download failed");
      }

      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = downloadUrl;
      link.download = doc.file?.key || "document";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(downloadUrl);
    } catch (err) {
      console.error("Download error:", err);
      setError("Failed to download document");
      setTimeout(() => setError(""), 3000);
    }
  };

  const handleView = async (doc) => {
    setError("");
    setViewLoading(true);
    try {
      const url = getDocumentUrl(doc);
      const res = await fetch(url, {
        credentials: "include",
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token") || ""}`,
        },
      });
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(txt || "Failed to fetch preview");
      }
      const blob = await res.blob();
      const objUrl = window.URL.createObjectURL(blob);
      setViewObjectUrl(objUrl);
      setViewMime(blob.type || doc.file?.mime);
      setViewTitle(doc.file?.key || "Document preview");
      setViewOpen(true);
    } catch (err) {
      console.error("Preview error:", err);
      setError("Failed to load preview");
      setTimeout(() => setError(""), 3000);
    } finally {
      setViewLoading(false);
    }
  };

  const closeViewModal = () => {
    if (viewObjectUrl) window.URL.revokeObjectURL(viewObjectUrl);
    setViewObjectUrl(null);
    setViewMime(null);
    setViewTitle("");
    setViewOpen(false);
  };

  const getStatusBadgeClass = (status) => {
    switch (status) {
      case "Verified":
        return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200";
      case "Rejected":
        return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200";
      case "Pending":
      default:
        return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200";
    }
  };

  const getFileIcon = (mime) => {
    if (mime?.includes("pdf")) return "📄";
    if (mime?.includes("image")) return "🖼️";
    return "📎";
  };

  return (
    <main className="p-8 space-y-6">
      {/* Toast */}
      {(error || success) && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50">
          <Toast message={error || success} type={error ? "error" : "success"} />
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div>
          <h1 className="text-3xl font-semibold text-root-primary">Document Management</h1>
          <p className="text-sm text-root-secondary">View and verify uploaded participant documents</p>
        </div>
        <Link
          href="/admin"
          className="flex items-center gap-2 px-4 py-2 rounded-2xl btn-primary text-root-primary hover:opacity-90 transition"
        >
          <FaUndo className="text-lg" /> Home
        </Link>
      </div>

      {/* Filters */}
      <div className="p-4 rounded-2xl bg-surface text-root-secondary">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="flex flex-col gap-1">
            <label className="text-xs uppercase opacity-80">Filter By Vendor</label>
            <input
              className="px-3 py-2 rounded input-surface"
              placeholder="Vendor name…"
              value={filters.applicantName}
              onChange={(e) => {
                setFilters({ ...filters, applicantName: e.target.value, page: 1 });
              }}
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs uppercase opacity-80">Filter by Event Location</label>
            <select
              value={filters.eventId}
              onChange={(e) => {
                setFilters({ ...filters, eventId: e.target.value, page: 1 });
              }}
              className="w-full px-3 py-2 input-surface rounded-lg text-root-primary"
            >
              <option value="">All Events</option>
              {events.map((event) => (
                <option key={event._id} value={event._id}>
                  {event.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-end md:col-span-3">
            <div className="w-full flex justify-end gap-2">
              {/* Reset button removed */}
            </div>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="p-4 rounded-2xl bg-surface text-root-primary">
        {loading ? (
          <p>Loading...</p>
        ) : documents.length === 0 ? (
          <p className="opacity-70">No documents found.</p>
        ) : (
          <div className="overflow-auto">
            <table className="w-full text-sm">
              <thead className="bg-root-surface border-b border-root-border">
                <tr className="text-root-secondary opacity-80">
                  <th
                    className="w-[20%] p-3 text-left text-xs uppercase cursor-pointer select-none"
                    onClick={() => {
                      if (filters.sortBy === "applicantName")
                        setFilters({ ...filters, sortOrder: filters.sortOrder === "asc" ? "desc" : "asc", page: 1 });
                      else setFilters({ ...filters, sortBy: "applicantName", sortOrder: "asc", page: 1 });
                    }}
                  >
                    Vendor {filters.sortBy === "applicantName" && <span className="ml-1 text-xs">{filters.sortOrder === "asc" ? "▲" : "▼"}</span>}
                  </th>
                  <th
                    className="w-[20%] p-3 text-left text-xs uppercase cursor-pointer select-none"
                    onClick={() => {
                      if (filters.sortBy === "eventName") setFilters({ ...filters, sortOrder: filters.sortOrder === "asc" ? "desc" : "asc" });
                      else {
                        setFilters({ ...filters, sortBy: "eventName", sortOrder: "asc" });
                      }
                      setFilters({ ...filters, page: 1 });
                    }}
                  >
                    Event {filters.sortBy === "eventName" && <span className="ml-1 text-xs">{filters.sortOrder === "asc" ? "▲" : "▼"}</span>}
                  </th>
                  <th
                    className="w-[20%] p-3 text-left text-xs uppercase cursor-pointer select-none"
                    onClick={() => {
                      if (filters.sortBy === "uploadedAt") setFilters({ ...filters, sortOrder: filters.sortOrder === "asc" ? "desc" : "asc" });
                      else {
                        setFilters({ ...filters, sortBy: "uploadedAt", sortOrder: "desc" });
                      }
                      setFilters({ ...filters, page: 1 });
                    }}
                  >
                    Uploaded {filters.sortBy === "uploadedAt" && <span className="ml-1 text-xs">{filters.sortOrder === "asc" ? "▲" : "▼"}</span>}
                  </th>
                  <th className="w-[18%] p-3 text-left text-xs uppercase">Actions</th>
                </tr>
              </thead>
              <tbody>
                {documents.map((doc) => (
                  <tr key={doc._id} className="border-t border-root">
                    <td className="p-3">
                      <div className="text-sm text-root-primary truncate" title={doc.applicantName}>
                        {doc.applicantName}
                      </div>
                    </td>
                    <td className="p-3">
                      <div className="text-sm text-root-primary truncate" title={doc.eventName}>
                        {doc.eventName}
                      </div>
                      <div className="text-xs text-root-secondary">{doc.eventType}</div>
                    </td>
                    <td className="p-3 text-xs text-root-primary">{new Date(doc.uploadedAt).toLocaleDateString()}</td>
                    <td className="p-3">
                      <div className="flex flex-wrap gap-2">
                        <button
                          onClick={() => handleView(doc)}
                          className="px-3 py-1 rounded btn-primary text-root-primary text-sm"
                          disabled={viewLoading}
                        >
                          {viewLoading ? "Loading…" : "View"}
                        </button>
                        <button
                          onClick={() => handleDownload(doc)}
                          className="px-3 py-1 rounded btn-ghost text-root-primary text-sm"
                        >
                          Download
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination (shared component) */}
        <div className="mt-4">
          <Pagination
            page={filters.page}
            limit={filters.limit}
            totalCount={totalCount}
            onPageChange={(p) => setFilters({ ...filters, page: p })}
            onLimitChange={(l) => {
              setFilters({ ...filters, limit: l, page: 1 });
            }}
          />
        </div>
      </div>

      {/* View Document Modal */}
      {viewOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black opacity-50" onClick={closeViewModal}></div>
          <div className="bg-root-surface rounded-lg overflow-hidden shadow-lg max-w-3xl w-full z-10">
            <div className="flex items-center justify-between p-4 bg-root-highlight border-b border-root-border">
              <h2 className="text-lg font-semibold text-white">{viewTitle}</h2>
              <button onClick={closeViewModal} className="text-gray-400 hover:text-gray-200">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-4">
              {viewLoading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-12 w-12 border-4 border-root-border border-t-root-primary"></div>
                </div>
              ) : viewMime?.includes("image") ? (
                <img src={viewObjectUrl} alt={viewTitle} className="w-full h-auto rounded-lg" />
              ) : viewMime?.includes("pdf") ? (
                <iframe src={viewObjectUrl} title={viewTitle} className="w-full h-[60vh] rounded-lg" frameBorder="0" />
              ) : (
                <div className="text-center py-12 text-root-primary">
                  <p className="text-lg font-semibold mb-4">Document Preview</p>
                  <p className="text-sm text-root-secondary mb-4">
                    This document type is not supported for preview. You can download the document to view it.
                  </p>
                  <button
                    onClick={() => {
                      handleDownload(viewObjectUrl);
                      closeViewModal();
                    }}
                    className="px-4 py-2 btn-primary rounded-lg text-white"
                  >
                    Download Document
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
