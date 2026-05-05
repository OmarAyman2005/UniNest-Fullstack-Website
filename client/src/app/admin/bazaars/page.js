"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { FaUndo } from "react-icons/fa";
import { api } from "../../../lib/admin/eventApi.js";
import { formatLocalTime, convertToUTC } from "@/lib/dateFormatter.js";
import { ActionsDropdown } from "@/components/actionDropdown.js";
import Pagination from "@/components/pagination.js";
import { BazaarAccordionForm } from "./bazaarAccordionForm.js";
import { BazaarDetailsModal } from "./bazaarDetails.js";
import Toast from "@/components/toast.js";

/** Helper: Date|ISO -> "YYYY-MM-DDTHH:MM" for <input type="datetime-local"> */
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

export default function BazaarsAdmin() {
  const router = useRouter();
  const [bazaars, setBazaars] = useState([]);
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [accordionOpen, setAccordionOpen] = useState(false);
  const [selectedBazaar, setSelectedBazaar] = useState(null);
  const [toast, setToast] = useState({ message: "", type: "", visible: false });
  const [confirmDelete, setConfirmDelete] = useState({ visible: false, id: null });
  const [hasAccess, setHasAccess] = useState(null);

  const [filters, setFilters] = useState({
    name: "",
    location: "",
    startDateTime: "",
    endDateTime: "",
    page: 1,
    limit: 5,
    sortBy: "name",
    sortOrder: "asc",
  });
  const [totalCount, setTotalCount] = useState(0);

  const [form, setForm] = useState({
    name: "",
    location: "",
    description: "",
    registrationDeadline: "",
    startDateTime: "",
    endDateTime: "",
    eventType: "bazaar",
  });

  const resetForm = () =>
    setForm({
      name: "",
      location: "",
      description: "",
      registrationDeadline: "",
      startDateTime: "",
      endDateTime: "",
      eventType: "bazaar",
    });

  const showToast = (message, type = "success", duration = 3000) => {
    setToast({ message, type, visible: true });
    setTimeout(() => setToast({ message: "", type: "", visible: false }), duration);
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

  const load = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== "" && value !== null && typeof value !== "undefined") {
          params.append(key, value);
        }
      });

      // ensure server-side sorting is requested (preferred)
      if (filters.sortBy) params.append("sortBy", filters.sortBy);
      if (filters.sortOrder) params.append("sortOrder", filters.sortOrder);

      params.append("eventType", "bazaar");

      // initial page request (used to get total count)
      const data = await api(`/bazaar?${params.toString()}`);
      const total = data.totalBazaars || data.total || 0;

      // helper: apply the same robust sorting logic used previously
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

      // If user requested sorting across pages (a sortBy is set) and there are more items
      // than fit on a page, fetch the full result set, sort it globally, then slice for the requested page.
      let items = Array.isArray(data?.data) ? data.data.slice() : [];
      const page = Number(filters.page || 1);
      const limit = Number(filters.limit || 5);

      if (filters.sortBy && total > limit) {
        // request entire dataset for the current filter set (page=1, limit=total)
        const allParams = new URLSearchParams();
        Object.entries(filters).forEach(([key, value]) => {
          if (value !== "" && value !== null && typeof value !== "undefined") {
            allParams.append(key, value);
          }
        });
        allParams.set("page", 1);
        allParams.set("limit", Math.max(1, total)); // request full set
        allParams.append("eventType", "bazaar");
        // include explicit sort params so backend can still optimize if it supports it
        if (filters.sortBy) allParams.set("sortBy", filters.sortBy);
        if (filters.sortOrder) allParams.set("sortOrder", filters.sortOrder);

        const allData = await api(`/bazaar?${allParams.toString()}`);
        let allItems = Array.isArray(allData?.data) ? allData.data.slice() : [];

        // apply robust client-side sorting on the full set (text or dates)
        if (["name", "location"].includes(filters.sortBy)) {
          allItems = applyTextSort(allItems, filters.sortBy, filters.sortOrder);
        } else if (["startDateTime", "endDateTime", "registrationDeadline"].includes(filters.sortBy)) {
          allItems = applyDateSort(allItems, filters.sortBy, filters.sortOrder);
        } else {
          // if unknown sort field, leave server order or keep as-is
        }

        // slice the sorted full set for the requested page
        const start = (page - 1) * limit;
        items = allItems.slice(start, start + limit);
      } else {
        // No global sort requested or small dataset — fall back to page-level sorting
        // apply same client-side sort within the page to keep behavior consistent
        if (["name", "location"].includes(filters.sortBy)) {
          items = applyTextSort(items, filters.sortBy, filters.sortOrder);
        } else if (["startDateTime", "endDateTime", "registrationDeadline"].includes(filters.sortBy)) {
          items = applyDateSort(items, filters.sortBy, filters.sortOrder);
        }
      }

      setBazaars(items);
      setTotalCount(total);
    } catch (e) {
      showToast(e.message || "Failed to load bazaars", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (hasAccess) load();
  }, [filters, hasAccess]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const preparedForm = {
      ...form,
      startDateTime: convertToUTC(form.startDateTime),
      endDateTime: convertToUTC(form.endDateTime),
      registrationDeadline: convertToUTC(form.registrationDeadline),
    };

    try {
      if (editingId) {
        await api(`/bazaar/${editingId}`, { method: "PUT", body: preparedForm });
        showToast("Bazaar updated successfully", "success");
      } else {
        await api(`/bazaar`, { method: "POST", body: preparedForm });
        showToast("Bazaar created successfully", "success");
      }
      resetForm();
      setEditingId(null);
      setAccordionOpen(false);
      await load();
    } catch (e) {
      showToast(e.message || "Failed to save bazaar", "error");
    }
  };

  // ✅ Unified time conversion logic (like Trips)
  const handleEdit = (bazaar) => {
    const cleaned = {
      name: bazaar.name || "",
      location: bazaar.location || "",
      description: bazaar.description || "",
      registrationDeadline: toLocalInput(bazaar.registrationDeadline),
      startDateTime: toLocalInput(bazaar.startDateTime),
      endDateTime: toLocalInput(bazaar.endDateTime),
      eventType: bazaar.eventType || "bazaar",
    };
    setForm(cleaned);
    setEditingId(bazaar._id);
    setAccordionOpen(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const confirmDeleteBazaar = (id) => setConfirmDelete({ visible: true, id });

  const handleDelete = async () => {
    try {
      await api(`/event/${confirmDelete.id}`, { method: "DELETE" });
      showToast("Bazaar deleted successfully", "success");
      await load();
    } catch (e) {
      showToast(e.message || "Failed to delete bazaar", "error");
    } finally {
      setConfirmDelete({ visible: false, id: null });
    }
  };

  const handleView = (bazaar) => setSelectedBazaar(bazaar);

  const ConfirmModal = ({ visible, onCancel, onConfirm }) => {
    if (!visible) return null;
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-black/40 z-50 p-4">
        <div className="bg-surface text-root-primary rounded-2xl p-6 w-96 text-center space-y-4 shadow-elevated border border-root">
          <p className="text-lg font-medium">Are you sure you want to delete this Bazaar?</p>
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

  return hasAccess === null ? (
    <main className="p-8">Checking permissions...</main>
  ) : (
    <main className="p-8 space-y-6">
      {/* Toast */}
      {toast.visible && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50">
          <Toast message={toast.message} type={toast.type || "success"} />
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
        <h1 className="text-3xl font-semibold text-root-primary">Bazaars</h1>
        <Link
          href="/admin"
          className="flex items-center gap-2 px-4 py-2 rounded-2xl btn-primary text-root-primary hover:opacity-90 transition"
        >
          <FaUndo className="text-lg" /> Home
        </Link>
      </div>

      {/* Accordion Form */}
      <BazaarAccordionForm
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
              placeholder="Bazaar name…"
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
        </div>
      </div>

      {/* Table */}
      <div className="p-4 rounded-2xl bg-surface text-root-primary">
        {loading ? (
          <p>Loading...</p>
        ) : bazaars.length === 0 ? (
          <p className="opacity-70">No Bazaars Found.</p>
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
                  ].map(({ key, label }) => (
                    <th
                      key={key}
                      onClick={() =>
                        setFilters((prev) => ({
                          ...prev,
                          sortBy: key,
                          sortOrder:
                            prev.sortBy === key && prev.sortOrder === "asc" ? "desc" : "asc",
                        }))
                      }
                      className="text-left p-2 cursor-pointer select-none hover:opacity-80 transition"
                    >
                      {label}
                      {filters.sortBy === key && (
                        <span className="ml-1 text-xs">
                          {filters.sortOrder === "asc" ? "▲" : "▼"}
                        </span>
                      )}
                    </th>
                  ))}
                  <th className="p-2 text-center">Actions</th>
                </tr>
              </thead>
              <tbody>
                {bazaars.map((b) => (
                  <tr key={b._id} className="border-t border-root">
                    <td className="p-2 text-root-primary">{b.name}</td>
                    <td className="p-2 text-root-primary">{b.location}</td>
                    <td className="p-2 text-root-primary">{formatLocalTime(b.startDateTime)}</td>
                    <td className="p-2 text-root-primary">{formatLocalTime(b.endDateTime)}</td>
                    <td className="p-2 text-root-primary">
                      {formatLocalTime(b.registrationDeadline)}
                    </td>
                    <td className="p-2">
                      <div className="flex justify-center items-center">
                        <ActionsDropdown
                          event={b}
                          canEdit={true}
                          onEdit={handleEdit}
                          onDelete={() => confirmDeleteBazaar(b._id)}
                          onView={handleView}
                        />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <Pagination
          page={filters.page}
          limit={filters.limit}
          totalCount={totalCount}
          onPageChange={(page) => setFilters((f) => ({ ...f, page }))}
          onLimitChange={(limit) => setFilters((f) => ({ ...f, limit, page: 1 }))}
        />
      </div>

      {selectedBazaar && (
        <BazaarDetailsModal
          bazaar={selectedBazaar}
          onClose={() => setSelectedBazaar(null)}
        />
      )}
    </main>
  );
}
