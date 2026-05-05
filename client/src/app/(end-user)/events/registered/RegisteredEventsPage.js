// app/events/registered/RegisteredEventsPage.jsx
"use client";

import { useEffect, useMemo, useState } from "react";
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
import { applicationsService } from "@/app/services/applications.service";
import { eventsService } from "@/app/services/events.service";
import { api } from "@/lib/admin/eventApi";

function formatDateRange(start, end) {
  if (!start) return "TBD";
  const s = new Date(start);
  const e = end ? new Date(end) : null;
  const opts = { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" };
  if (!e) return s.toLocaleString(undefined, opts);
  if (s.toDateString() === e.toDateString()) {
    return `${s.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })} — ${e.toLocaleTimeString(
      undefined,
      { hour: "2-digit", minute: "2-digit" }
    )}, ${s.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })}`;
  }
  return `${s.toLocaleString(undefined, opts)} — ${e.toLocaleString(undefined, opts)}`;
}

function normalizeType(t) {
  if (!t) return "";
  const s = String(t).toLowerCase().trim();
  if (s === "booths" || s === "booth-platform" || s === "boothplatform") return "booth";
  if (s === "bazaars") return "bazaar";
  return s;
}

/* ---- helpers: only show ACTIVE apps ---- */
function normStatus(s) {
  const t = String(s || "").toLowerCase();
  if (t === "cancelled") return "canceled";
  return t;
}
function isActiveApp(app) {
  const st = normStatus(app?.status);
  return !["canceled", "rejected", "declined"].includes(st);
}

export default function RegisteredEventsPage({ currentUser }) {
  const router = useRouter();

  const [apps, setApps] = useState([]);
  const [appsLoading, setAppsLoading] = useState(false);

  const [certLoading, setCertLoading] = useState(false);
  const [eventsById, setEventsById] = useState({});
  const [eventsLoading, setEventsLoading] = useState(false);

  const [selected, setSelected] = useState(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  useEffect(() => {
    if (showDetailsModal) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = prev || "";
      };
    }
    return undefined;
  }, [showDetailsModal]);

  const [banner, setBanner] = useState({ text: "", tone: "info" });

  // If no user (no token server-side), ask them to login
  if (!currentUser?.id) {
    return (
      <main className="min-h-screen bg-root px-6 py-10 text-root-secondary">
        <div className="max-w-6xl mx-auto text-center">
          <p className="mb-6">Please sign in to view your registered events.</p>
          <button
            onClick={() => router.push("/login")}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-primary text-secondary hover:opacity-95 transition"
          >
            Go to Login
          </button>
        </div>
      </main>
    );
  }

  // Fetch user's applications (filter to active)
  const refreshApplications = async () => {
    try {
      setAppsLoading(true);
      const list = await applicationsService.listByUser(currentUser.id);
      setApps(Array.isArray(list) ? list.filter(isActiveApp) : []);
    } catch {
      setApps([]);
    } finally {
      setAppsLoading(false);
    }
  };

  useEffect(() => {
    refreshApplications();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser?.id]);

  // Resolve events for those applications
  useEffect(() => {
    let mounted = true;
    (async () => {
      if (!apps?.length) {
        setEventsById({});
        return;
      }
      const next = {};
      const missing = new Set();
      for (const a of apps) {
        const eid = a.eventId || a.event?._id || a.event?.id || a.event;
        if (!eid) continue;
        if (a.event && (a.event._id || a.event.id)) {
          next[String(eid)] = a.event;
        } else {
          missing.add(String(eid));
        }
      }
      setEventsById((prev) => ({ ...prev, ...next }));

      if (missing.size === 0) return;

      try {
        setEventsLoading(true);
        const fetched = await Promise.all(
          Array.from(missing).map(async (id) => {
            try {
              const ev = await eventsService.getById(id);
              return [id, ev];
            } catch {
              return [id, null];
            }
          })
        );
        if (!mounted) return;
        const add = {};
        for (const [id, ev] of fetched) {
          if (ev) add[id] = ev;
        }
        setEventsById((prev) => ({ ...prev, ...add }));
      } finally {
        if (mounted) setEventsLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [apps]);

  // Derived list (apps already filtered to active)
  const registeredList = useMemo(() => {
    return (apps || [])
      .map((a) => {
        const eventId = a.eventId || a.event?._id || a.event?.id || a.event;
        const ev = eventsById[String(eventId)] || {};
        return { app: a, event: ev, eventId: String(eventId || "") };
      })
      .filter((row) => !!row.eventId);
  }, [apps, eventsById]);

  const goToEvents = () => router.push("/events");

  async function unregister(appId) {
    try {
      await applicationsService.cancelEvent(appId);
      setBanner({ text: "Registration canceled.", tone: "success" });
      await refreshApplications(); // now it disappears since we filter inactive
      if (selected && (selected.app._id === appId || selected.app.id === appId)) {
        setShowDetailsModal(false);
        setSelected(null);
      }
    } catch (e) {
      setBanner({ text: e?.message || "Failed to cancel registration.", tone: "error" });
    }
  }

  async function handleSendCertificate(evId) {
    if (!evId || !currentUser?.id) {
      setBanner({ text: "Missing event or user information.", tone: "error" });
      return;
    }
    try {
      setCertLoading(true);
      const resp = await api("/application/send-certificate", {
        method: "POST",
        body: { eventId: evId, userId: currentUser.id },
      });
      const data = resp?.data ?? resp;
      if (data?.status === "success") {
        setBanner({ text: data.message || "Certificate sent.", tone: "success" });
      } else {
        setBanner({ text: data?.message || "Failed to send certificate.", tone: "error" });
      }
    } catch (err) {
      setBanner({ text: err?.message || "Network error sending certificate.", tone: "error" });
    } finally {
      setCertLoading(false);
    }
  }

  const canRegisterAgain = (event, role) => {
    const r = String(role || currentUser?.role || "").toLowerCase();
    const t = normalizeType(event?.eventType || event?.type);
    return r === "vendor" && t === "booth";
  };

  const handleRegisterAgain = (eventId) => {
    if (!eventId) return;
    router.push(`/vendorApplyingBoothPlat/${eventId}`);
  };

  return (
    <>
      <main className="min-h-screen bg-root px-6 py-10 text-root-secondary">
        <div className="max-w-6xl mx-auto mb-6">
          <button
            onClick={goToEvents}
            className="mb-4 inline-flex items-center gap-2 px-4 py-2 rounded-md btn-primary transition cursor-pointer"
            aria-label="Back to events"
          >
            ← Back to events
          </button>

          {banner.text ? (
            <div
              className={`mb-4 rounded-xl px-3 py-2 text-sm border ${
                banner.tone === "error"
                  ? "bg-red-600/25 text-red-200 border-red-400/40"
                  : banner.tone === "success"
                  ? "bg-emerald-600/25 text-emerald-200 border-emerald-400/40"
                  : "bg-black/30 text-secondary border-white/10"
              }`}
            >
              {banner.text}
            </div>
          ) : null}

          <div className="mb-2 text-center">
            <h1 className="text-4xl md:text-5xl font-extrabold mb-1">My Registered Events</h1>
            <div className="text-root-secondary text-sm inline-flex items-center gap-3 justify-center">
              <span className="ml-2 inline-flex items-center justify-center btn-primary text-white text-xs px-2 py-0.5 rounded">
                {appsLoading ? "…" : apps.length}
              </span>
            </div>
          </div>
        </div>

        {appsLoading || eventsLoading ? (
          <p className="text-center text-gray-300">Loading…</p>
        ) : registeredList.length === 0 ? (
          <p className="text-center text-gray-300">You have no registered events.</p>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-12 w-full max-w-[1600px] mx-auto px-8 justify-items-stretch">
            {registeredList.map(({ app, event, eventId }) => {
              const appId = app._id || app.id;
              const start = event.startDateTime || event.startDate || event.startsAt;
              const end = event.endDateTime || event.endDate || event.endsAt;
              const meta = getTypeMeta(event.eventType || event.type);

              return (
                <article
                  key={appId}
                  className="bg-surface border border-root rounded-2xl p-6 hover:shadow-elevated transition-colors duration-200 flex flex-col h-full"
                >
                  <div className="flex items-start gap-4">
                    <div className="w-28 flex-shrink-0">
                      <div className={`w-28 h-28 rounded-lg flex flex-col items-center justify-center gap-2 p-2 ${meta.bgClass} ${meta.textClass} ${meta.ring}`}>
                        <div className="flex items-center justify-center">{meta.icon}</div>
                        <div className="text-xs font-medium text-center">{meta.label}</div>
                      </div>
                    </div>
                    <div className="flex-1">
                      <h3 className="text-xl font-semibold text-secondary mb-1">
                        {event.name || event.title || "Event"}
                      </h3>
                      <p className="text-sm text-gray-300 mb-2 line-clamp-3">{event.description || "—"}</p>

                      <div className="flex flex-wrap items-center gap-3 text-xs text-gray-300">
                        <span className="flex items-center gap-2 px-2 py-1 bg-background-card rounded-md">
                          <FaCalendarAlt /> <span>{formatDateRange(start, end)}</span>
                        </span>
                        <span className="flex items-center gap-2 px-2 py-1 bg-background-card rounded-md">
                          <FaMapMarkerAlt /> <span>{event.location || "TBD"}</span>
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-auto flex items-center gap-3">
                    <button
                      onClick={() => router.push(`/events/${eventId}`)}
                      className="flex-1 px-4 py-2 rounded-lg btn-primary font-medium hover:opacity-95 transition cursor-pointer"
                      aria-label={`View details for ${event.name || 'event'}`}
                    >
                      View Details
                    </button>

                    {(() => {
                      const end = event.endDateTime || event.endDate || event.endsAt || null;
                      const endDate = end ? new Date(end) : null;
                      const isWorkshop = normalizeType(event?.eventType || event?.type) === "workshop";
                      const eventEnded = endDate && !isNaN(endDate.getTime()) && new Date() > endDate;
                      if (isWorkshop && eventEnded) {
                        return (
                          <button
                            onClick={() => handleSendCertificate(eventId)}
                            className="px-4 py-2 rounded bg-emerald-600 text-white hover:opacity-95 transition"
                            disabled={certLoading}
                            aria-label={`Receive certificate for ${event.name || 'event'}`}
                          >
                            {certLoading ? "Sending…" : "Get Certificate"}
                          </button>
                        );
                      }
                      return null;
                    })()}

                    <button
                      onClick={() => {
                        if (!confirm('Cancel registration for this event?')) return;
                        unregister(appId);
                      }}
                      className="px-4 py-2 rounded bg-red-500 text-white hover:opacity-90 transition"
                      aria-label={`Unregister from ${event.name || 'event'}`}
                    >
                      Unregister
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </main>

      {/* Details Modal (themed) */}
      {showDetailsModal && selected && (
        <div className="fixed inset-0 flex items-center justify-center z-50">
          <div
            className="absolute inset-0 bg-root/10 backdrop-blur-sm"
            onClick={() => {
              setShowDetailsModal(false);
              setSelected(null);
            }}
          />

          <div
            className="relative bg-surface border border-root rounded-2xl p-6 w-full max-w-xl text-root-secondary max-h-[85vh] overflow-y-auto shadow-elevated z-10"
            role="dialog"
            aria-modal="true"
            aria-labelledby="registered-details-title"
          >
            <div className="flex justify-between items-start">
              <h2 id="registered-details-title" className="text-2xl font-semibold mb-2">
                {selected.event?.name || selected.event?.title || "Event"}
              </h2>
            </div>

            <p className="text-root-secondary mb-3">{selected.event?.description || "—"}</p>

            <div className="flex items-center text-root-secondary text-sm mb-2">
              <FaCalendarAlt className="mr-2 text-secondary" />
              <span>
                {formatDateRange(
                  selected.event?.startDateTime || selected.event?.startDate || selected.event?.startsAt,
                  selected.event?.endDateTime || selected.event?.endDate || selected.event?.endsAt
                )}
              </span>
            </div>

            <div className="flex items-center text-root-secondary text-sm mb-2">
              <FaMapMarkerAlt className="mr-2 text-secondary" />
              <span>{selected.event?.location || "N/A"}</span>
            </div>

            <div className="flex items-center text-root-secondary text-sm mb-2">
              <FaUsers className="mr-2 text-secondary" />
              <span>Capacity: {selected.event?.capacity ?? "N/A"}</span>
            </div>

            <div className="mb-6 text-root-secondary">
              {selected.event?.fullAgenda || selected.event?.description || "—"}
            </div>

            <div className="mt-6 flex justify-end gap-2">
              {(() => {
                const allowAgain =
                  String(currentUser?.role || "").toLowerCase() === "vendor" &&
                  normalizeType(selected.event?.eventType || selected.event?.type) === "booth";
                return (
                  allowAgain && (
                    <button
                      onClick={() => handleRegisterAgain(selected.eventId)}
                      className="px-4 py-2 rounded btn-primary cursor-pointer"
                    >
                      Register Again
                    </button>
                  )
                );
              })()}

              {(() => {
                // show "Send Certificate" when event is a workshop and ended
                const end =
                  selected.event?.endDateTime || selected.event?.endDate || selected.event?.endsAt || null;
                const endDate = end ? new Date(end) : null;
                const isWorkshop = normalizeType(selected.event?.eventType || selected.event?.type) === "workshop";
                const eventEnded = endDate && !isNaN(endDate.getTime()) && new Date() > endDate;
                if (isWorkshop && eventEnded) {
                  return (
                    <button
                      onClick={() => handleSendCertificate(selected.eventId)}
                      className="px-4 py-2 rounded bg-emerald-600 text-white hover:opacity-95"
                      disabled={certLoading}
                    >
                      {certLoading ? "Sending…" : "Send Certificate"}
                    </button>
                  );
                }
                return null;
              })()}

              <button
                onClick={() => {
                  // close modal immediately, then perform unregister action
                  setShowDetailsModal(false);
                  setSelected(null);
                  unregister(selected.app._id || selected.app.id);
                }}
                className="px-4 py-2 rounded bg-red-500 text-white hover:bg-white hover:text-red-500 cursor-pointer"
              >
                Unregister
              </button>
              <button
                onClick={() => {
                  setShowDetailsModal(false);
                  setSelected(null);
                }}
                className="px-4 py-2 rounded btn-primary cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function getTypeMeta(type) {
  // Use the same color/icon theming as EventsClient.js but with slightly smaller icons for the registered list
  const t = normalizeType(type);
  const baseIconClass = "w-8 h-8";
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
