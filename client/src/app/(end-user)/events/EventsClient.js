// app/events/EventsClient.jsx
"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  FaMapMarkerAlt,
  FaCalendarAlt,
  FaUsers,
  FaClipboardList,
  FaRegCalendarAlt,
  FaShoppingBag,
  FaStore,
  FaPlane,
  FaMicrophone,
  FaChalkboardTeacher,
  FaArrowUp,
  FaArrowDown,
  FaStar,
  FaStarHalfAlt,
  FaRegStar,
  FaCheckCircle,
} from "react-icons/fa";
import { api } from "@/lib/admin/eventApi";
import { applicationsService } from "@/app/services/applications.service";
import { publicService } from "@/app/services/public.service";
import { FavoriteAddButton } from "@/app/(end-user)/favorites/FavoriteList";

/* ---------- Helpers ---------- */
function formatDateRange(start, end) {
  if (!start) return "TBD";
  const s = new Date(start);
  const e = end ? new Date(end) : null;
  const opts = { year: "numeric", month: "short", day: "numeric" };
  if (!e) return s.toLocaleDateString(undefined, opts);
  if (s.toDateString() === e.toDateString())
    return s.toLocaleDateString(undefined, opts);
  return `${s.toLocaleDateString(undefined, opts)} — ${e.toLocaleDateString(
    undefined,
    opts
  )}`;
}

function shortText(s, n = 140) {
  if (!s) return "";
  return s.length > n ? s.slice(0, n).trim() + "…" : s;
}

function currency(v) {
  if (v == null) return "";
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "EGP",
    maximumFractionDigits: 0,
  }).format(v);
}

function normalizeType(t) {
  if (!t) return "";
  const s = String(t).toLowerCase().trim();
  if (s === "workshops" || s === "workshop") return "workshop";
  if (s === "conferences" || s === "conference") return "conference";
  if (s === "bazaars" || s === "bazaar") return "bazaar";
  if (s === "trips" || s === "trip") return "trip";
  if (
    s === "booth" ||
    s === "booths" ||
    s === "booth-platform" ||
    s === "boothplatform"
  )
    return "booth";
  if (
    s === "loyaltyprogram" ||
    s === "loyalty-program" ||
    s === "loyalty program"
  )
    return "loyaltyProgram";
  return s;
}

// return meta (icon + color classes) for an event type
function getTypeMeta(type) {
  const t = normalizeType(type);
  const baseIconClass = "w-10 h-10"; // icon size inside badge
  switch (t) {
    case "conference":
      return {
        key: "conference",
        label: "Conference",
        icon: <FaMicrophone className={baseIconClass} />,
        bgClass: "bg-emerald-600/90",
        textClass: "text-white",
        ring: "ring-2 ring-emerald-300/30",
      };
    case "bazaar":
      return {
        key: "bazaar",
        label: "Bazaar",
        icon: <FaShoppingBag className={baseIconClass} />,
        bgClass: "bg-amber-500/90",
        textClass: "text-white",
        ring: "ring-2 ring-amber-300/30",
      };
    case "booth":
      return {
        key: "booth",
        label: "Booth",
        icon: <FaStore className={baseIconClass} />,
        bgClass: "bg-rose-600/90",
        textClass: "text-white",
        ring: "ring-2 ring-rose-300/30",
      };
    case "trip":
      return {
        key: "trip",
        label: "Trip",
        icon: <FaPlane className={baseIconClass} />,
        bgClass: "bg-sky-600/90",
        textClass: "text-white",
        ring: "ring-2 ring-sky-300/30",
      };
    case "workshop":
      return {
        key: "workshop",
        label: "Workshop",
        icon: <FaChalkboardTeacher className={baseIconClass} />,
        bgClass: "bg-purple-600/90",
        textClass: "text-white",
        ring: "ring-2 ring-purple-300/30",
      };
    case "loyaltyProgram":
      return {
        key: "loyaltyProgram",
        label: "Loyalty Program",
        icon: <FaStar className={baseIconClass} />,
        bgClass: "bg-indigo-600/90",
        textClass: "text-white",
        ring: "ring-2 ring-indigo-300/30",
      };
    default:
      return {
        key: "default",
        label: String(type || "Event"),
        icon: <FaRegCalendarAlt className={baseIconClass} />,
        bgClass: "bg-root/5",
        textClass: "text-root-primary",
        ring: "",
      };
  }
}

const LABELS = {
  workshop: "Workshops",
  conference: "Conferences",
  bazaar: "Bazaars",
  trip: "Trips",
  booth: "Booths",
  loyaltyProgram: "Loyalty Program",
};


// staff/professor/ta/student → can see ALL types
function roleAllowedTypes(role) {
  const r = (role || "").toLowerCase();
  const all = [
    "workshop",
    "trip",
    "conference",
    "bazaar",
    "booth",
    "loyaltyProgram",
  ];
  if (["student", "staff", "ta", "teaching assistant", "professor"].includes(r))
    return all;
  if (r === "vendor") return ["bazaar", "booth", "loyaltyProgram"];
  return all; // default: show everything
}


/* -- App activity helpers -------------------------------------------------- */
function normStatus(s) {
  const t = String(s || "").toLowerCase();
  if (t === "cancelled") return "canceled";
  return t;
}
function isActiveApp(app) {
  const st = normStatus(app?.status);
  return !["canceled", "rejected", "declined"].includes(st);
}

// only show workshops whose status is Accepted
function workshopIsVisible(ev) {
  if (!ev) return false;
  const t = normalizeType(ev.eventType || ev.type);
  if (t !== "workshop") return true;
  return String(ev.status || "").toLowerCase() === "accepted";
}

/** GET /event/:eventId/participants — accepted vendor names for this event */
async function getParticipants(eventId) {
  const json = await api(`/event/${eventId}/participants`);
  if (Array.isArray(json?.data)) return json.data;
  if (Array.isArray(json?.items)) return json.items;
  if (Array.isArray(json)) return json;
  return [];
}

export default function EventsClient({
  currentUserId = null,
  currentUserRole = null,
}) {
  const [events, setEvents] = useState([]);
  const [userApplications, setUserApplications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [appsLoading, setAppsLoading] = useState(false);
  const [error, setError] = useState(null);

  const allowedTypes = roleAllowedTypes(currentUserRole);

  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [profFilter, setProfFilter] = useState("all"); // new: filter by professor id
  const [locationFilter, setLocationFilter] = useState("all"); // new: filter by location
  const [sortBy, setSortBy] = useState("name");
  const [sortOrder, setSortOrder] = useState("asc"); // "asc" | "desc"
  const [startDateFilter, setStartDateFilter] = useState("");
  const [endDateFilter, setEndDateFilter] = useState("");
  const locationCacheRef = useRef({}); // location cache
  const router = useRouter();

  // ensure the current filter is valid for the role (otherwise reset to "all")
  useEffect(() => {
    if (typeFilter !== "all" && !allowedTypes.includes(typeFilter)) {
      setTypeFilter("all");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUserRole]);

  // Banner
  const [banner, setBanner] = useState({ text: "", tone: "info" });
  const Banner = ({ text, tone }) => {
    if (!text) return null;
    const toneClass =
      tone === "error"
        ? "bg-red-600/25 text-red-200 border-red-400/40"
        : "bg-emerald-600/25 text-emerald-200 border-emerald-400/40";
    return (
      <div className={`mb-4 rounded-xl px-3 py-2 text-sm border ${toneClass}`}>
        {text}
      </div>
    );
  };

  // inline non-vendor form state
  const [regFormVisible, setRegFormVisible] = useState(false);
  const [regFormData, setRegFormData] = useState({
    name: "",
    email: "",
    studentId: "",
  });
  const [formErrors, setFormErrors] = useState({});
  // event attached to the registration popup (non-vendor flow)
  const [regFormEvent, setRegFormEvent] = useState(null);

  // tiny cache for professor lookups
  const profCacheRef = useRef({});

  // derive professor options from cache + event inline data
  const professorOptions = (() => {
    const map = new Map();
    const cache = profCacheRef.current || {};
    // entries from cache (id -> display name)
    Object.keys(cache).forEach((k) => {
      const v = cache[k];
      if (v && (v._id || v.fullName || v.email)) {
        map.set(
          String(v._id || k),
          v.fullName || v.email || String(v._id || k)
        );
      }
    });
    // also scan events for professor objects/ids to ensure presence
    (events || []).forEach((ev) => {
      if (!Array.isArray(ev?.professors)) return;
      ev.professors.forEach((p) => {
        if (!p) return;
        if (typeof p === "string") {
          if (!map.has(p)) map.set(String(p), String(p));
        } else if (p._id || p.id) {
          const id = String(p._id || p.id);
          if (!map.has(id))
            map.set(id, p.fullName || p.name || p.email || id);
        }
      });
    });
    return Array.from(map.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => (a.name || "").localeCompare(b.name || ""));
  })();

  // build location cache + options from events
  useEffect(() => {
    const cache = {};
    (events || []).forEach((ev) => {
      const loc = (ev?.location || "").toString().trim();
      if (loc) cache[loc] = loc;
    });
    locationCacheRef.current = cache;
  }, [events]);

  const locationOptions = (() => {
    const cache = locationCacheRef.current || {};
    return Object.keys(cache)
      .filter(Boolean)
      .map((v) => ({ id: v, name: v }))
      .sort((a, b) => (a.name || "").localeCompare(b.name || ""));
  })();

  /* ------------------- Fetch events ------------------- */
  useEffect(() => {
    let mounted = true;
    const fetchEvents = async () => {
      try {
        const data = await api("/event?limit=100");
        const payload =
          data && data.data ? data.data : Array.isArray(data) ? data : [];
        await resolveProfessors(payload);
        if (!mounted) return;
        setEvents(payload);
      } catch (err) {
        console.error("Failed to load events", err);
        if (mounted) setError(err.message || "Failed to load events");
      } finally {
        if (mounted) setLoading(false);
      }
    };
    fetchEvents();
    return () => {
      mounted = false;
    };
    return () => {
      mounted = false;
    };
  }, []);

  /* ---- Fetch user's applications ---- */
  const refreshUserApplications = async () => {
    if (!currentUserId) {
      setUserApplications([]);
      return;
    }
    try {
      setAppsLoading(true);
      const apps = await applicationsService.listByUser(currentUserId);
      setUserApplications(
        Array.isArray(apps) ? apps.filter(isActiveApp) : []
      );
    } catch {
      setUserApplications([]);
    } finally {
      setAppsLoading(false);
    }
  };

  useEffect(() => {
    refreshUserApplications();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUserId]);

  async function resolveProfessors(list) {
    if (!Array.isArray(list) || list.length === 0) return [];

    // Detect whether "list" is an events array (each item may contain .professors)
    const looksLikeEvents = list.some(
      (it) => it && (Array.isArray(it.professors) || it.professors)
    );

    // Flatten professor entries accordingly:
    const profEntries = [];
    if (looksLikeEvents) {
      list.forEach((ev) => {
        if (!ev) return;
        const arr = Array.isArray(ev.professors) ? ev.professors : [];
        profEntries.push(...arr);
      });
    } else {
      profEntries.push(...list);
    }

    // Collect unique ids from professor entries
    const ids = Array.from(
      new Set(
        profEntries
          .map((p) => (typeof p === "string" ? p : p?._id || p?.id))
          .filter(Boolean)
          .map(String)
      )
    );

    if (ids.length === 0) return [];

    // Fetch missing professors and populate cache
    const results = await Promise.all(
      ids.map(async (id) => {
        if (id in profCacheRef.current) return profCacheRef.current[id];
        try {
          const prof = await publicService.getProfessorById(id);
          if (prof && (prof.fullName || prof.email)) {
            const norm = {
              _id: prof._id || id,
              fullName: prof.fullName || prof.email,
              email: prof.email || "",
            };
            profCacheRef.current[id] = norm;
            return norm;
          }
        } catch (err) {
          // ignore individual failures, leave cache null below
          console.error("resolveProfessors fetch error for", id, err);
        }
        profCacheRef.current[id] = null;
        return null;
      })
    );

    return results.filter(Boolean);
  }

  // open details; also fetch participating vendors when applicable
  async function openDetails(event) {
    setSelected(event);
    setRegFormVisible(false);
    setFormErrors({});

    try {
      // 1) Resolve professors
      const raw = Array.isArray(event.professors) ? event.professors : [];
      if (raw.length > 0) {
        const resolved = await resolveProfessors(raw);
        setSelected((prev) => ({ ...(prev || {}), professors: resolved || [] }));
      }

      // 2) If role is staff/professor/ta/student AND type is bazaar/booth → fetch participants
      const r = (currentUserRole || "").toLowerCase();
      const canSeeParticipants = [
        "student",
        "staff",
        "ta",
        "teaching assistant",
        "professor",
      ].includes(r);
      const t = normalizeType(event.eventType || event.type);
      if (canSeeParticipants && (t === "bazaar" || t === "booth")) {
        const eid = event._id || event.id;
        const names = await getParticipants(eid).catch(() => []);
        setSelected((prev) => ({
          ...(prev || {}),
          participantsVendors: names,
        }));
      }
    } catch (err) {
      console.error("openDetails error:", err);
    }
  }

  function closeDetails() {
    setSelected(null);
    setRegFormVisible(false);
    setRegFormData({ name: "", email: "", studentId: "" });
    setFormErrors({});
  }

  /* --------------- Vendor-specific navigation --------------- */
  const goVendorApply = (ev) => {
    const id = ev._id || ev.id;
    const t = normalizeType(ev.eventType || ev.type);

    if (t === "bazaar") {
      router.push(`/vendorApplyingBazaars/${id}`);
      return true;
    }
    if (t === "booth") {
      router.push(`/vendorApplyingBoothPlat/${id}`);
      return true;
    }
    if (t === "loyaltyProgram") {
      router.push(`/vendorApplyingLoyaltyProgram/${id}`);
      return true;
    }
    return false;
  };

  /* --------------- Is event already submitted? --------------- */
  const isSubmitted = (eventId) => {
    if (!currentUserId || !Array.isArray(userApplications)) return false;
    const eid = String(eventId);
    return userApplications.some((a) => {
      if (!isActiveApp(a)) return false;
      const appEventId =
        a.eventId || a.event?.id || a.event?._id || a.event;
      return String(appEventId || "") === eid;
    });
  };

  // Helper: can vendor re-apply (register again) to a BOOTH even if already applied?
  const canRegisterAgain = (ev) => {
    const isVendor = (currentUserRole || "").toLowerCase() === "vendor";
    const isBooth = normalizeType(ev.eventType || ev.type) === "booth";
    return isVendor && isBooth;
  };

  /* --------- Derived: filter, search, sort for cards --------- */
  const filtered = events
    .map((ev) => ({
      ...ev,
      _normType: normalizeType(ev.eventType || ev.type),
    }))
    .filter((ev) => allowedTypes.includes(ev._normType))
    // hide workshops that are not accepted
    .filter((ev) => workshopIsVisible(ev))
    .filter((ev) => (typeFilter === "all" ? true : ev._normType === typeFilter))
    // professor filter: keep events that include the selected professor (by id)
    .filter((ev) => {
      if (!profFilter || profFilter === "all") return true;
      const profs = Array.isArray(ev.professors) ? ev.professors : [];
      return profs.some((p) => {
        if (!p) return false;
        if (typeof p === "string") return String(p) === String(profFilter);
        if (p._id) return String(p._id) === String(profFilter);
        if (p.id) return String(p.id) === String(profFilter);
        // fallback: match by email/fullName if cache maps id -> name but event carries object without id
        return false;
      });
    })
    // location filter: match exact location string (trimmed)
    .filter((ev) => {
      if (!locationFilter || locationFilter === "all") return true;
      const loc = (ev.location || "").toString().trim();
      return String(loc) === String(locationFilter);
    })
    // date range filter (startDateFilter..endDateFilter) — require event start >= start AND event end <= end
    .filter((ev) => {
      if (!startDateFilter && !endDateFilter) return true;

      const evStart = new Date(
        ev.startDateTime || ev.startDate || 0
      ).getTime();
      const evEnd =
        ev.endDateTime || ev.endDate
          ? new Date(ev.endDateTime || ev.endDate).getTime()
          : evStart;

      if (startDateFilter) {
        const s = new Date(startDateFilter);
        s.setHours(0, 0, 0, 0);
        if (evStart < s.getTime()) return false;
      }

      if (endDateFilter) {
        const e = new Date(endDateFilter);
        e.setHours(23, 59, 59, 999);
        if (evEnd > e.getTime()) return false;
      }

      return true;
    })
    .filter((ev) => {
      if (!query) return true;
      const q = query.toLowerCase();
      return (
        (ev.name && ev.name.toLowerCase().includes(q)) ||
        (ev.description && ev.description.toLowerCase().includes(q)) ||
        (Array.isArray(ev.professors) &&
          ev.professors.some((p) => {
            // p may be an id string or an object. Try cache for ids.
            let candidate = "";
            if (typeof p === "string") {
              const cached = profCacheRef.current[String(p)];
              candidate =
                (cached && (cached.fullName || cached.email)) || "";
            } else if (p && typeof p === "object") {
              candidate = (p.fullName || p.name || p.email) || "";
            }
            return candidate.toLowerCase().includes(q);
          }))
      );
    })
    .sort((a, b) => {
      const dir = sortOrder === "asc" ? 1 : -1;
      if (sortBy === "name")
        return dir * ((a.name || "").localeCompare(b.name || ""));
      if (sortBy === "price") {
        const na = Number(a.price || 0);
        const nb = Number(b.price || 0);
        return dir * (na - nb);
      }
      if (sortBy === "startDateTime") {
        const ta = new Date(
          a.startDateTime || a.startDate || 0
        ).getTime();
        const tb = new Date(
          b.startDateTime || b.startDate || 0
        ).getTime();
        if (ta === tb)
          return dir * ((a.name || "").localeCompare(b.name || ""));
        return dir * (ta - tb);
      }
      return 0;
    });

  const registeredCount = currentUserId ? userApplications.length : 0;

  // who is allowed to vote in vendor polls
  const roleLower = (currentUserRole || "").toLowerCase();
  const isAcademicRole = ["student", "staff", "ta", "teaching assistant", "professor"].includes(
    roleLower
  );

  return (
    <div className="min-h-screen bg-root px-6 py-10 text-root-secondary">
      <div className="max-w-7xl mx-auto">
        <Banner text={banner.text} tone={banner.tone} />

        <header className="mb-8">
          <div>
            <h1 className="text-4xl md:text-5xl font-extrabold mb-1">
              Events Marketplace
            </h1>
            <p className="text-root-secondary">
              Discover upcoming workshops, conferences, trips, bazaars,
              booths, and loyalty programs.
            </p>
          </div>

          <div className="mt-6">
            {/* Search - full width */}
            <div className="w-full mx-auto">
              <label
                htmlFor="events-search"
                className="block text-sm text-root-secondary mb-1"
              >
                Search
              </label>
              <input
                id="events-search"
                type="search"
                placeholder="Search events, professors or topics..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="w-full px-4 py-3 rounded-lg input-surface focus:outline-none"
              />
            </div>

            {/* Filters beneath search:
                - left: Type
                - right-top: Sort by (name / price) + asc/desc
                - right-bottom: Date range inputs (start / end)
            */}
            <div className="mt-4 grid grid-cols-1 sm:grid-cols-4 gap-3 mx-auto">
              <div className="sm:col-span-1">
                <label
                  htmlFor="type-filter"
                  className="block text-sm text-root-secondary mb-1"
                >
                  Filter by Event Type
                </label>
                <select
                  id="type-filter"
                  value={typeFilter}
                  onChange={(e) => setTypeFilter(e.target.value)}
                  className="w-full px-3 py-3 rounded-lg input-surface"
                >
                  <option value="all">All types</option>
                  {roleAllowedTypes(currentUserRole).map((t) => (
                    <option key={t} value={t}>
                      {LABELS[t] || t}
                    </option>
                  ))}
                </select>
              </div>

              <div className="sm:col-span-1">
                <label
                  htmlFor="prof-filter"
                  className="block text-sm text-root-secondary mb-1"
                >
                  Filter by Professor
                </label>
                <select
                  id="prof-filter"
                  value={profFilter}
                  onChange={(e) => setProfFilter(e.target.value)}
                  className="w-full px-3 py-3 rounded-lg input-surface"
                >
                  <option value="all">All professors</option>
                  {professorOptions.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="sm:col-span-1">
                <label
                  htmlFor="location-filter"
                  className="block text-sm text-root-secondary mb-1"
                >
                  Filter by Location
                </label>
                <select
                  id="location-filter"
                  value={locationFilter}
                  onChange={(e) => setLocationFilter(e.target.value)}
                  className="w-full px-3 py-3 rounded-lg input-surface"
                >
                  <option value="all">All locations</option>
                  {locationOptions.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="sm:col-span-1">
                <div className="grid grid-cols-2 gap-2 mb-1">
                  <label className="block text-sm text-root-secondary">
                    Start Date From
                  </label>
                  <label className="block text-sm text-root-secondary">
                    End Date At
                  </label>
                </div>
                <div className="flex gap-2 items-start">
                  <input
                    type="date"
                    value={startDateFilter}
                    onChange={(e) => setStartDateFilter(e.target.value)}
                    className="flex-1 px-3 py-2 rounded-lg input-surface mt-1"
                    aria-label="Start date"
                  />
                  <input
                    type="date"
                    value={endDateFilter}
                    onChange={(e) => setEndDateFilter(e.target.value)}
                    className="flex-1 px-3 py-2 rounded-lg input-surface mt-1"
                    aria-label="End date"
                  />
                </div>
              </div>
            </div>
          </div>
        </header>

        {/* top stats bar + buttons */}
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-3 text-sm text-root-secondary">
            <FaRegCalendarAlt /> <span>{filtered.length} events</span>
            <span className="mx-2">•</span>
            <FaClipboardList /> <span>My registrations</span>
            <span className="ml-2 inline-flex items-center justify-center btn-primary text-white text-xs px-2 py-0.5 rounded">
              {appsLoading ? "…" : registeredCount}
            </span>
          </div>

          <div className="flex items-center gap-3">
            <label
              htmlFor="top-sort"
              className="text-sm text-root-secondary"
            >
              Sort by
            </label>
            {/* small sort dropdown */}
            <div className="flex items-center gap-2">
              <select
                id="top-sort"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="px-2 py-1 rounded-lg input-surface text-sm cursor-pointer"
                aria-label="Sort by"
              >
                <option value="name">Name</option>
                <option value="price">Price</option>
                <option value="startDateTime">Date</option>
              </select>

              {/* ascending/descending toggle (icon) */}
              <button
                type="button"
                onClick={() =>
                  setSortOrder((s) => (s === "asc" ? "desc" : "asc"))
                }
                title={sortOrder === "asc" ? "Ascending" : "Descending"}
                className="px-2 py-1 rounded-lg input-surface cursor-pointer"
                aria-label="Toggle sort order"
              >
                {sortOrder === "asc" ? <FaArrowUp /> : <FaArrowDown />}
              </button>
            </div>

            <button
              type="button"
              onClick={() => router.push("/events/registered")}
              className="inline-flex items-center gap-2 px-3 py-1 rounded-md btn-primary transition cursor-pointer"
              aria-label="View registered events"
            >
              View registrations
            </button>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-16 text-gray-300">
            Loading events...
          </div>
        ) : error ? (
          <div className="text-center py-16 text-red-400">{error}</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-gray-300">
            No events match your filters.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8 items-stretch">
            {filtered.map((ev) => {
              const id = ev._id || ev.id;
              const submitted = isSubmitted(id);

              const t = normalizeType(ev.eventType || ev.type);
              const isVendor =
                (currentUserRole || "").toLowerCase() === "vendor";
              const isVendorFlow =
                t === "bazaar" || t === "booth" || t === "loyaltyProgram";

              // Vendor can re-apply for booths specifically
              const allowRepeat = submitted && isVendor && t === "booth";

              const isBazOrBooth =
                ev._normType === "bazaar" || ev._normType === "booth";

              const handleRegisterClick = () => {
                // For bazaar/booth/loyaltyProgram, only vendors may see / trigger vendor application flow
                if (isVendorFlow) {
                  if (!isVendor) return; // non-vendors should not be able to register/apply
                  goVendorApply(ev);
                  return;
                }

                // non-vendor flow (workshops, conferences, trips) -> open inline popup
                setRegFormEvent(ev);
                setRegFormData({ name: "", email: "", studentId: "" });
                setFormErrors({});
                setRegFormVisible(true);
              };

              return (
                <article
                  key={id}
                  className="relative bg-surface border border-root rounded-2xl p-6 hover:shadow-elevated transition-colors duration-200 flex flex-col h-full"
                >
                  {/* Favorite button: top-right of the card */}
                  <div className="absolute top-3 right-3 z-10">
                    <FavoriteAddButton
                      id={id}
                      name={ev.name}
                      href={`/events/${id}`}
                      userId={currentUserId}
                    />
                  </div>
                  <div className="flex items-start gap-4">
                    <div>
                      {(() => {
                        const meta = getTypeMeta(ev.eventType || ev.type);
                        return (
                          <div
                            className={`w-28 h-28 rounded-lg flex flex-col items-center justify-center gap-2 p-2 ${meta.bgClass} ${meta.textClass} ${meta.ring}`}
                          >
                            <div className="flex items-center justify-center">
                              {meta.icon}
                            </div>
                            <div className="text-xs font-medium text-center">
                              {meta.label}
                            </div>
                          </div>
                        );
                      })()}
                      {!isVendor &&
                        ev.eventType != "booth" &&
                        ev.eventType != "bazaar" &&
                        ev.eventType != "conference" && (
                          <div className="items-center gap-3 mt-4 mb-4">
                            <div className="flex items-center gap-1">
                              {renderStars(
                                ev.averageRating ?? ev.average ?? 0
                              )}
                            </div>
                            <div className="text-xs ml-5 text-gray-300">
                              {Number(
                                ev.averageRating ?? ev.average ?? 0
                              ) > 0
                                ? `${(
                                    ev.averageRating ?? ev.average ?? 0
                                  ).toFixed(1)} · ${
                                    ev.ratingCount ??
                                    (Array.isArray(ev.ratings)
                                      ? ev.ratings.length
                                      : 0)
                                  }`
                                : "No ratings"}
                            </div>
                          </div>
                        )}
                    </div>

                    <div className="flex-1">
                      <h3 className="text-xl font-semibold text-secondary mb-1">
                        {ev.name}
                      </h3>
                      <p className="text-sm text-gray-300 mb-2">
                        {shortText(ev.description, 120)}
                      </p>

                      {/* Info section: special layout for bazaar/booth */}
                      {isBazOrBooth ? (
                        <div className="flex flex-col gap-2 text-xs text-gray-300">
                          <span className="flex items-center gap-2 px-2 py-1 bg-background-card rounded-md w-full">
                            <FaCalendarAlt />{" "}
                            <span className="w-full">
                              {formatDateRange(
                                ev.startDateTime,
                                ev.endDateTime
                              )}
                            </span>
                          </span>
                          <span className="flex items-center gap-2 px-2 py-1 bg-background-card rounded-md w-full">
                            <FaMapMarkerAlt />{" "}
                            <span className="w-full">
                              {ev.location || "TBD"}
                            </span>
                          </span>
                          {ev.price != null && (
                            <span className="text-sm font-semibold text-secondary self-end">
                              {currency(ev.price)}
                            </span>
                          )}
                        </div>
                      ) : (
                        <div className="flex flex-wrap items-center gap-3 text-xs text-gray-300">
                          <span className="flex items-center gap-2 px-2 py-1 bg-background-card rounded-md">
                            <FaCalendarAlt />{" "}
                            <span>
                              {formatDateRange(
                                ev.startDateTime,
                                ev.endDateTime
                              )}
                            </span>
                          </span>
                          <span className="flex items-center gap-2 px-2 py-1 bg-background-card rounded-md">
                            <FaMapMarkerAlt />{" "}
                            <span>{ev.location || "TBD"}</span>
                          </span>
                          {t !== "conference" && (
                            <span className="flex items-center gap-2 px-2 py-1 bg-background-card rounded-md">
                              <FaUsers />{" "}
                              <span>Capacity: {ev.capacity ?? "N/A"}</span>
                            </span>
                          )}
                          {ev.price != null && (
                            <span className="ml-auto text-sm font-semibold text-secondary">
                              {currency(ev.price)}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="mt-auto flex items-center gap-3">
                    <button
                      onClick={() => router.push(`/events/${id}`)}
                      className="flex-1 px-4 py-2 rounded-lg btn-primary font-medium hover:opacity-95 transition cursor-pointer"
                    >
                      View Details
                    </button>

                    {/* Register / Apply button replaced:
                        - remove "Submitted" and non-vendor "Register" buttons
                        - show registered icon when user already submitted
                        - keep vendor "Apply" and "Register Again" where applicable
                    */}
                    {submitted ? (
                      (t === "trip" || t === "workshop") ? (
                        <div title="You are registered" className="px-3 py-1">
                          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-green-50 text-green-700 font-medium">
                            <FaCheckCircle className="text-green-600 w-4 h-4" />
                            <span className="text-sm">Registered</span>
                          </div>
                        </div>
                      ) : (
                        <div title="Registered" className="px-3 py-1">
                          <FaCheckCircle className="text-green-500 w-6 h-6" />
                        </div>
                      )
                    ) : null}
                  </div>
                </article>
              );
            })}
          </div>
        )}

        {/* Registration popup (non-vendor) */}
        {regFormVisible && regFormEvent && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div
              className="absolute inset-0 bg-black/50"
              onClick={() => {
                setRegFormVisible(false);
                setRegFormEvent(null);
              }}
            />
            <div className="relative bg-surface border border-root rounded-2xl w-full max-w-lg p-6 shadow-elevated">
              <h3 className="text-lg font-semibold mb-3">
                Register for {regFormEvent.name}
              </h3>
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  const errors = {};
                  if (!regFormData.name.trim())
                    errors.name = "Name is required";
                  if (!regFormData.email.trim())
                    errors.email = "Email is required";
                  else if (
                    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(regFormData.email)
                  )
                    errors.email = "Email is invalid";
                  if (!regFormData.studentId.trim())
                    errors.studentId = "Student/Staff ID is required";
                  if (!currentUserId)
                    errors.auth = "Please sign in to register.";
                  setFormErrors(errors);
                  if (Object.keys(errors).length > 0) return;

                  try {
                    await applicationsService.create({
                      userId: currentUserId,
                      eventId: regFormEvent._id || regFormEvent.id,
                      participants: [
                        {
                          name: regFormData.name.trim(),
                          email: regFormData.email.trim(),
                        },
                      ],
                      gucID: regFormData.studentId.trim(),
                    });
                    await refreshUserApplications();
                    setRegFormVisible(false);
                    setRegFormEvent(null);
                    setRegFormData({
                      name: "",
                      email: "",
                      studentId: "",
                    });
                  } catch (err) {
                    setFormErrors({
                      submit:
                        err?.message ||
                        "Registration failed. Please try again.",
                    });
                  }
                }}
                className="space-y-3"
              >
                <div className="grid grid-cols-1 gap-2">
                  <input
                    className="px-3 py-2 rounded input-surface"
                    placeholder="Full name"
                    value={regFormData.name}
                    onChange={(e) =>
                      setRegFormData((s) => ({
                        ...s,
                        name: e.target.value,
                      }))
                    }
                  />
                  <input
                    className="px-3 py-2 rounded input-surface"
                    placeholder="Email"
                    value={regFormData.email}
                    onChange={(e) =>
                      setRegFormData((s) => ({
                        ...s,
                        email: e.target.value,
                      }))
                    }
                  />
                  <input
                    className="px-3 py-2 rounded input-surface"
                    placeholder="Student / Staff ID"
                    value={regFormData.studentId}
                    onChange={(e) =>
                      setRegFormData((s) => ({
                        ...s,
                        studentId: e.target.value,
                      }))
                    }
                  />
                </div>
                <div className="flex items-center gap-3">
                  <button
                    type="submit"
                    className="px-4 py-2 rounded btn-primary cursor-pointer"
                  >
                    Submit
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setRegFormVisible(false);
                      setRegFormEvent(null);
                    }}
                    className="px-4 py-2 rounded input-surface cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>
                <div className="text-sm text-red-500">
                  {Object.values(formErrors).map((m, i) => (
                    <div key={i}>{m}</div>
                  ))}
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function renderStars(avg = 0, max = 5) {
  const a = Number(avg) || 0;
  const full = Math.max(0, Math.min(max, Math.floor(a)));
  const hasHalf = a - full >= 0.5;
  const empty = max - full - (hasHalf ? 1 : 0);
  return (
    <>
      {Array.from({ length: full }, (_, i) => (
        <FaStar key={"full" + i} className="text-amber-400" />
      ))}
      {hasHalf && <FaStarHalfAlt className="text-amber-400" />}
      {Array.from({ length: empty }, (_, i) => (
        <FaRegStar key={"empty" + i} className="text-amber-300" />
      ))}
    </>
  );
}
