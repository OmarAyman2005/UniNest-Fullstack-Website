"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { FaUndo } from "react-icons/fa";
import { api } from "../../../lib/admin/eventApi.js";
import { ActionsDropdown } from "@/components/actionDropdown.js";
import { formatLocalTime, convertToUTC } from "@/lib/dateFormatter.js";
import { TripDetailsModal } from "./tripDetail.js";
import { TripAccordionForm } from "./tripAccordionForm.js";
import Pagination from "@/components/pagination.js";
import Toast from "@/components/toast.js";

/** Helper: Date|ISO -> "YYYY-MM-DDTHH:MM" for <input type="datetime-local"> */
// (UPDATED)
function toLocalInput(value) {
  if (!value) return "";
  const dt = value instanceof Date ? value : new Date(value);
  const pad = (n) => String(n).padStart(2, "0");
  const y = dt.getFullYear();
  const m = pad(dt.getMonth() + 1);
  const d = pad(dt.getDate());
  const hh = pad(dt.getHours());
  const mm = pad(dt.getMinutes());
  return `${y}-${m}-${d}T${hh}:${mm}`;
}

export default function TripsAdmin() {
  const [trips, setTrips] = useState([]);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const [hasAccess, setHasAccess] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [accordionOpen, setAccordionOpen] = useState(false);
  const [detailsModal, setDetailsModal] = useState({ open: false, trip: null });

  // Toast
  const [toastState, setToastState] = useState(null);
  const TOAST_DEFAULT_DURATION = 3000;

  const [confirmDelete, setConfirmDelete] = useState({ visible: false, id: null });

  const [filters, setFilters] = useState({
    name: "",
    location: "",
    startDateTime: "",
    endDateTime: "",
    sortBy: "name",
    sortOrder: "asc",
    page: 1,
    limit: 5,
  });

  const [totalCount, setTotalCount] = useState(0);

  const [form, setForm] = useState({
    name: "",
    location: "",
    description: "",
    registrationDeadline: "",
    startDateTime: "",
    endDateTime: "",
    price: "",
    capacity: "",
    eventType: "trip",
  });

  const resetForm = () =>
    setForm({
      name: "",
      location: "",
      description: "",
      registrationDeadline: "",
      startDateTime: "",
      endDateTime: "",
      price: "",
      capacity: "",
      eventType: "trip",
    });

  const showToast = (message, type = "success", duration = TOAST_DEFAULT_DURATION) => {
    setToastState({ message, type });
    if (duration > 0) setTimeout(() => setToastState(null), duration);
  };

  const load = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        name: filters.name || "",
        location: filters.location || "",
        startDateTime: filters.startDateTime || "",
        endDateTime: filters.endDateTime || "",
        sortBy: filters.sortBy,
        sortOrder: filters.sortOrder,
        page: filters.page,
        limit: filters.limit,
      });

      // Ask backend for sorted page when possible
      const data = await api(`/trip?${params.toString()}`);
      const total = data.totalTrips || data.total || 0;

      // helpers: text and date sorts (stable, case/diacritic-insensitive for text)
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

      // page / limit
      let items = Array.isArray(data?.data) ? data.data.slice() : [];
      const page = Number(filters.page || 1);
      const limit = Number(filters.limit || 5);

      // If global sort requested and dataset spans multiple pages, fetch full set, sort, then slice
      if (filters.sortBy && total > limit) {
        const allParams = new URLSearchParams({
          name: filters.name || "",
          location: filters.location || "",
          startDateTime: filters.startDateTime || "",
          endDateTime: filters.endDateTime || "",
          // request full set
          page: 1,
          limit: Math.max(1, total),
          sortBy: filters.sortBy,
          sortOrder: filters.sortOrder,
        });

        const allData = await api(`/trip?${allParams.toString()}`);
        let allItems = Array.isArray(allData?.data) ? allData.data.slice() : [];

        if (["name", "location"].includes(filters.sortBy)) {
          allItems = applyTextSort(allItems, filters.sortBy, filters.sortOrder);
        } else if (["startDateTime", "endDateTime", "registrationDeadline"].includes(filters.sortBy)) {
          allItems = applyDateSort(allItems, filters.sortBy, filters.sortOrder);
        }

        const start = (page - 1) * limit;
        items = allItems.slice(start, start + limit);
      } else {
        // fallback: sort only current page
        if (["name", "location"].includes(filters.sortBy)) {
          items = applyTextSort(items, filters.sortBy, filters.sortOrder);
        } else if (["startDateTime", "endDateTime", "registrationDeadline"].includes(filters.sortBy)) {
          items = applyDateSort(items, filters.sortBy, filters.sortOrder);
        }
      }

      setTrips(items);
      setTotalCount(total);
    } catch (e) {
      showToast(e.message || "Failed to load trips", "error");
    } finally {
      setLoading(false);
    }
  };

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
      } catch {
        setHasAccess(false);
        router.replace("/404");
      }
    })();
    return () => {
      mounted = false;
    };
  }, [router]);

  useEffect(() => {
    if (hasAccess) load();
  }, [
    filters.page,
    filters.limit,
    filters.name,
    filters.location,
    filters.startDateTime,
    filters.endDateTime,
    filters.sortBy,
    filters.sortOrder,
    hasAccess,
  ]);

  if (hasAccess === null) return <main className="p-8">Checking permissions...</main>;
  if (hasAccess === false) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        ...form,
        price: form.price === "" ? undefined : Number(form.price),
        capacity: form.capacity === "" ? undefined : Number(form.capacity),
        // IMPORTANT: keep your formatter; always send UTC
        startDateTime: convertToUTC(form.startDateTime),
        endDateTime: convertToUTC(form.endDateTime),
        registrationDeadline: convertToUTC(form.registrationDeadline),
      };

      if (editingId) {
        await api(`/trip/${editingId}`, { method: "PUT", body: payload });
        showToast("Trip updated successfully", "success");
      } else {
        await api(`/trip`, { method: "POST", body: payload });
        showToast("Trip created successfully", "success");
      }

      resetForm();
      setEditingId(null);
      setAccordionOpen(false);
      await load();
    } catch (e) {
      showToast(e.message || "Failed to save trip", "error");
    }
  };

  // (UPDATED) Stop slicing off timezone; convert DB UTC -> local input string
  const handleEdit = (t) => {
    const cleaned = {
      name: t.name || "",
      location: t.location || "",
      description: t.description || "",
      registrationDeadline: toLocalInput(t.registrationDeadline), // (UPDATED)
      startDateTime: toLocalInput(t.startDateTime),               // (UPDATED)
      endDateTime: toLocalInput(t.endDateTime),                   // (UPDATED)
      price: t.price ?? "",
      capacity: t.capacity ?? "",
      eventType: t.eventType || "trip",
    };
    setForm(cleaned);
    setEditingId(t._id);
    setAccordionOpen(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleView = (trip) => {
    setDetailsModal({ open: true, trip });
  };

  const confirmDeleteTrip = (id) => {
    setConfirmDelete({ visible: true, id });
  };

  const handleDelete = async () => {
    try {
      await api(`/event/${confirmDelete.id}`, { method: "DELETE" });
      showToast("Trip deleted successfully", "success");
      await load();
    } catch (e) {
      showToast(e.message || "Failed to delete trip", "error");
    } finally {
      setConfirmDelete({ visible: false, id: null });
    }
  };

  // Confirm delete modal
  const ConfirmModal = ({ visible, onCancel, onConfirm }) => {
    if (!visible) return null;
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-black/40 z-50 p-4">
        <div className="bg-surface text-root-primary rounded-2xl p-6 w-96 text-center space-y-4 shadow-elevated border border-root">
          <p className="text-lg font-medium">Are you sure you want to delete this Trip?</p>
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

  return (
    <main className="p-8 space-y-6">
      {/* Toast */}
      {toastState && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50">
          <Toast
            message={toastState.message}
            type={toastState.type || "success"}
            duration={TOAST_DEFAULT_DURATION}
            onClose={() => setToastState(null)}
          />
        </div>
      )}

      {/* Confirm Delete */}
      <ConfirmModal
        visible={confirmDelete.visible}
        onCancel={() => setConfirmDelete({ visible: false, id: null })}
        onConfirm={handleDelete}
      />

      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <h1 className="text-3xl font-semibold text-root-primary hover:opacity-80 transition">Trips</h1>
        <div className="flex gap-2">
          <Link
            href="/admin"
            className="flex items-center gap-2 px-4 py-2 rounded-2xl bg-primary text-root-primary hover:opacity-90 transition"
          >
            <FaUndo className="text-lg" /> Home
          </Link>
        </div>
      </div>

      {/* Accordion Form */}
      <TripAccordionForm
        form={form}
        setForm={setForm}
        editingId={editingId}
        setEditingId={setEditingId}
        resetForm={resetForm}
        handleSubmit={handleSubmit}
        open={accordionOpen}
        setOpen={setAccordionOpen}
      />

      {/* Filters */}
      <div className="p-4 rounded-2xl bg-surface text-root-secondary">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <div className="flex flex-col gap-1">
            <label className="text-xs uppercase opacity-80">Search</label>
            <input
              className="px-3 py-2 rounded input-surface"
              placeholder="Trip name…"
              value={filters.name}
              onChange={(e) => setFilters((f) => ({ ...f, name: e.target.value, page: 1 }))}
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs uppercase opacity-80">Location</label>
            <input
              className="px-3 py-2 rounded input-surface"
              placeholder="Location…"
              value={filters.location}
              onChange={(e) => setFilters((f) => ({ ...f, location: e.target.value, page: 1 }))}
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

          <div className="flex items-end">
            <div className="w-full" />
          </div>
        </div>
      </div>

      {/* Trips Table */}
      <div className="p-4 rounded-2xl bg-surface text-root-primary">
        {loading ? (
          <p>Loading...</p>
        ) : trips.length === 0 ? (
          <p className="opacity-70">No Trips Found.</p>
        ) : (
          <div className="overflow-auto">
            <table className="w-full text-sm">
              <thead className="text-root-secondary opacity-80">
                <tr>
                  {[
                    { key: "name", label: "Name" },
                    { key: "location", label: "Location" },
                    { key: "startDateTime", label: "Start" },
                    { key: "endDateTime", label: "End" },
                    { key: "registrationDeadline", label: "Registration Deadline" },
                    { key: "price", label: "Price" },
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
                {trips.map((t) => (
                  <tr key={t._id} className="border-t border-root">
                    <td className="p-2 text-root-primary">{t.name}</td>
                    <td className="p-2 text-root-primary">{t.location}</td>
                    <td className="p-2 text-root-primary">{formatLocalTime(t.startDateTime)}</td>
                    <td className="p-2 text-root-primary">{formatLocalTime(t.endDateTime)}</td>
                    <td className="p-2 text-root-primary">{formatLocalTime(t.registrationDeadline)}</td>
                    <td className="p-2 text-root-primary">{t.price}</td>
                    <td className="p-2">
                      <div className="flex justify-center items-center">
                        <ActionsDropdown
                          event={t}
                          canEdit={true}
                          onEdit={handleEdit}
                          onDelete={() => confirmDeleteTrip(t._id)}
                          onView={() => handleView(t)}
                        />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        <Pagination
          page={filters.page}
          limit={filters.limit}
          totalCount={totalCount}
          onPageChange={(page) => setFilters((f) => ({ ...f, page }))}
          onLimitChange={(limit) => setFilters((f) => ({ ...f, limit, page: 1 }))}
        />
      </div>

      {/* Details Modal */}
      {detailsModal.open && (
        <TripDetailsModal
          trip={detailsModal.trip}
          onClose={() => setDetailsModal({ open: false, trip: null })}
        />
      )}
    </main>
  );
}
