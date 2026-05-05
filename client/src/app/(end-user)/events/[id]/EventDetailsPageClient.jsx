"use client";
import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  FaCalendarAlt,
  FaMapMarkerAlt,
  FaUsers,
  FaTag,
  FaArrowLeft,
  FaShoppingBag,
  FaStore,
  FaPlane,
  FaMicrophone,
  FaChalkboardTeacher,
  FaRegCalendarAlt,
  FaStar,
  FaEdit,
  FaTrash,
  FaCheckCircle,
} from "react-icons/fa";
import { api } from "@/lib/admin/eventApi";
import { publicService } from "@/app/services/public.service";
import { applicationsService } from "@/app/services/applications.service";
import { formatLocalTime } from "@/lib/dateFormatter";

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

// Add getTypeMeta (same as EventsClient) to reuse event type icons + theme
function getTypeMeta(type) {
  const t = (type || "").toString().toLowerCase().trim();
  const baseIconClass = "w-10 h-10";
  switch (t) {
    case "conference":
    case "conferences":
      return {
        key: "conference",
        label: "Conference",
        icon: <FaMicrophone className={baseIconClass} />,
        bgClass: "bg-emerald-600/90",
        textClass: "text-white",
        ring: "ring-2 ring-emerald-300/30",
      };
    case "bazaar":
    case "bazaars":
      return {
        key: "bazaar",
        label: "Bazaar",
        icon: <FaShoppingBag className={baseIconClass} />,
        bgClass: "bg-amber-500/90",
        textClass: "text-white",
        ring: "ring-2 ring-amber-300/30",
      };
    case "booth":
    case "booths":
    case "booth-platform":
    case "boothplatform":
      return {
        key: "booth",
        label: "Booth",
        icon: <FaStore className={baseIconClass} />,
        bgClass: "bg-rose-600/90",
        textClass: "text-white",
        ring: "ring-2 ring-rose-300/30",
      };
    case "trip":
    case "trips":
      return {
        key: "trip",
        label: "Trip",
        icon: <FaPlane className={baseIconClass} />,
        bgClass: "bg-sky-600/90",
        textClass: "text-white",
        ring: "ring-2 ring-sky-300/30",
      };
    case "workshop":
    case "workshops":
      return {
        key: "workshop",
        label: "Workshop",
        icon: <FaChalkboardTeacher className={baseIconClass} />,
        bgClass: "bg-purple-600/90",
        textClass: "text-white",
        ring: "ring-2 ring-purple-300/30",
      };
    case "loyaltyprogram":
    case "loyalty-program":
    case "loyalty program":
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

export default function EventDetailsPageClient({
  eventId,
  currentUserId,
  currentUserRole,
}) {
  const router = useRouter();
  const [event, setEvent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [professors, setProfessors] = useState([]);
  const [participantsVendors, setParticipantsVendors] = useState([]);
  const [regFormVisible, setRegFormVisible] = useState(false);
  const [showPayModal, setShowPayModal] = useState(false);
  const [regFormData, setRegFormData] = useState({
    name: "",
    email: "",
    studentId: "",
  });
  const [formErrors, setFormErrors] = useState({});
  const [ratings, setRatings] = useState([]);
  const [myRating, setMyRating] = useState(null);
  const [ratingScore, setRatingScore] = useState(0);
  const [ratingComment, setRatingComment] = useState("");
  const [ratingLoading, setRatingLoading] = useState(false);
  const [editingRatingId, setEditingRatingId] = useState(null);
  const [ratingOpen, setRatingOpen] = useState(false);
  const [alreadyRegistered, setAlreadyRegistered] = useState(false);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      setLoading(true);
      try {
        const res = await api(`/event/${eventId}`);
        const payload = (res && res.data) ? res.data : res;
        if (!mounted) return;
        setEvent(payload);
        setRatings(Array.isArray(payload?.ratings) ? payload.ratings : []);
        // detect current user's rating if currentUserId provided
        if (currentUserId && Array.isArray(payload?.ratings)) {
          const me = payload.ratings.find(
            (r) => String(r.user) === String(currentUserId)
          );
          setMyRating(me || null);
          if (me) {
            setRatingScore(me.score || 0);
            setRatingComment(me.comment || "");
            setEditingRatingId(me._id || me.id || null);
          } else {
            setRatingScore(0);
            setRatingComment("");
            setEditingRatingId(null);
          }
        }

        // resolve professors (if ids present)
        const raw = Array.isArray(payload?.professors)
          ? payload.professors
          : [];
        if (raw.length > 0) {
          const ids = Array.from(
            new Set(
              raw
                .map((p) => (typeof p === "string" ? p : p?._id || p?.id))
                .filter(Boolean)
            )
          );
          const resolved = await Promise.all(
            ids.map(async (id) => {
              try {
                const prof = await publicService.getProfessorById(id);
                return prof && (prof.fullName || prof.email)
                  ? {
                      _id: prof._id || id,
                      fullName: prof.fullName || prof.email,
                      email: prof.email || "",
                    }
                  : null;
              } catch {
                return null;
              }
            })
          );
          if (mounted) setProfessors(resolved.filter(Boolean));
        }

        // participants (if bazaar/booth)
        const t = normalizeType(payload?.eventType || payload?.type);
        if (t === "bazaar" || t === "booth") {
          try {
            const parts = await api(`/event/${eventId}/participants`);
            const names =
              parts && parts.data
                ? parts.data
                : Array.isArray(parts)
                ? parts
                : [];
            if (mounted) setParticipantsVendors(names);
          } catch {
            if (mounted) setParticipantsVendors([]);
          }
        }
      } catch (err) {
        console.error("Failed loading event", err);
      } finally {
        if (mounted) setLoading(false);
      }
    };
    load();
    return () => {
      mounted = false;
    };
  }, [eventId, currentUserId]);

  // whether current user already registered for this event
  useEffect(() => {
    let mounted = true;
    if (!currentUserId || !event) {
      setAlreadyRegistered(false);
      return () => (mounted = false);
    }

    (async () => {
      try {
        const apps = await applicationsService.listByUser(currentUserId);
        const list = Array.isArray(apps) ? apps : [];
        const eid = String(event._id || event.id || "");
        const found = list.some((a) => {
          if (!a) return false;
          const st = String(a.status || "").toLowerCase();
          if (["canceled", "cancelled", "rejected", "declined"].includes(st)) return false;
          const appEventId = a.eventId || a.event?.id || a.event?._id || a.event;
          return String(appEventId || "") === eid;
        });
        if (mounted) setAlreadyRegistered(Boolean(found));
      } catch (err) {
        if (mounted) setAlreadyRegistered(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [currentUserId, event]);

  // If the loaded event is a loyalty program — don't show it.
  if (!loading && event && normalizeType(event.eventType || event.type) === "loyaltyProgram") {
    return (
      <div className="min-h-screen flex items-center justify-center">
        {/* You can change this message or redirect instead of hiding */}
        <div className="text-center text-gray-400">This event type is not available.</div>
      </div>
    );
  }

  // helper: refresh event/ratings
  const refreshEvent = async () => {
    try {
      const res = await api(`/event/${eventId}`);
      const payload = (res && res.data) ? res.data : res;
      setEvent(payload);
      setRatings(Array.isArray(payload?.ratings) ? payload.ratings : []);
    } catch (e) {
      console.error("refreshEvent failed", e);
    }
  };

  const handleSubmitRating = async (e) => {
    e?.preventDefault();
    if (!ratingScore || ratingScore < 1 || ratingScore > 5) {
      setFormErrors({ rating: "Select a score between 1 and 5" });
      return;
    }
    setRatingLoading(true);
    try {
      if (editingRatingId) {
        await api(`/event/${eventId}/ratings/${editingRatingId}`, {
          method: "PUT",
          body: {
            user: currentUserId,
            score: ratingScore,
            comment: ratingComment,
          },
        });
      } else {
        await api(`/event/${eventId}/ratings`, {
          method: "POST",
          body: {
            user: currentUserId,
            score: ratingScore,
            comment: ratingComment,
          },
        });
      }
      await refreshEvent();
      setEditingRatingId(null);
      setRatingScore(0);
      setRatingComment("");
      setFormErrors({});
      // close accordion after successful submit
      setRatingOpen(false);
    } catch (err) {
      console.error("rating error", err);
      setFormErrors({
        rating: err?.message || "Failed to submit rating",
      });
    } finally {
      setRatingLoading(false);
    }
  };

  const handleDeleteRating = async (ratingId) => {
    if (!ratingId) return;
    if (!confirm("Delete your rating?")) return;
    try {
      await api(`/event/${eventId}/ratings/${ratingId}`, {
        method: "DELETE",
        body: { user: currentUserId },
      });
      await refreshEvent();
      setEditingRatingId(null);
      setRatingScore(0);
      setRatingComment("");
    } catch (err) {
      console.error("delete rating failed", err);
    }
  };

  // Populate registration form from current user when the inline form or Pay modal is shown
  useEffect(() => {
    let mounted = true;
    // run when either the inline form (regFormVisible) or the Pay modal (showPayModal) is opened
    if (!regFormVisible && !showPayModal) return;

    (async () => {
      try {
        // Prefer server session endpoint, fallback to user endpoint by id
        let resp = await api("/auth/me");
        const payload = (resp && resp.data) ? resp.data : resp;
        const user = payload?.user ?? payload ?? null;
        if (!mounted || !user) return;

        setRegFormData((s) => ({
          name: s.name || user.fullName || user.name || "",
          email: s.email || user.email || "",
          // try common id fields used in your app
          studentId: s.studentId || user.studentId || user.staffId || "",
        }));
      } catch (e) {
        // ignore – leave fields as-is
      }
    })();

    return () => {
      mounted = false;
    };
  }, [regFormVisible, showPayModal, currentUserId]);

  if (loading)
    return (
      <div className="min-h-screen flex items-center justify-center">
        Loading...
      </div>
    );
  if (!event)
    return (
      <div className="min-h-screen flex items-center justify-center">
        Event not found
      </div>
    );

  const handleBack = () => router.back();

  const eventNormType = normalizeType(event.eventType || event.type);
  const isVendorRole =
    String(currentUserRole || "").toLowerCase() === "vendor";

  const computedPrice = event.price ?? event.ticketPrice ?? event.ticket_price ?? null;
  const priceDisplay = computedPrice != null
    ? currency(computedPrice)
    : ["conference", "bazaar", "booth"].includes(eventNormType)
      ? "Customizable"
      : "Free";
  

  // replicate EventsClient vendor flow: navigate vendors to the appropriate apply pages
  const goVendorApply = (evOrId) => {
    const id = (evOrId && (evOrId._id || evOrId.id)) || String(evOrId || eventId || "");
    if (!id) return;
    if (eventNormType === "bazaar") {
      router.push(`/vendorApplyingBazaars/${id}`);
      return true;
    }
    if (eventNormType === "booth") {
      router.push(`/vendorApplyingBoothPlat/${id}`);
      return true;
    }
    if (eventNormType === "loyaltyProgram") {
      router.push(`/vendorApplyingLoyaltyProgram/${id}`);
      return true;
    }
    return false;
  };

  // Registration form component (used both inline and in modal)
  const RegistrationForm = ({ onCancel } = {}) => (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        const errors = {};
        if (!regFormData.name.trim()) errors.name = "Name is required";
        if (!regFormData.email.trim()) errors.email = "Email is required";
        else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(regFormData.email))
          errors.email = "Email is invalid";
        if (!regFormData.studentId.trim()) errors.studentId = "Student/Staff ID is required";
        setFormErrors(errors);
        if (Object.keys(errors).length > 0) return;
        try {
          const paymentMethod = regFormData.paymentMethod || "stripe";
          const body = {
            userId: currentUserId,
            eventId: event._id || event.id,
            amount: event.price,
            paymentMethod,
          };
          console.log("Submitting registration with", body);

          if (paymentMethod === "stripe") {
            const qs = new URLSearchParams({
              eventId: String(event._id || event.id || ""),
              userId: String(currentUserId || ""),
              amount: String(event.price ?? ""),
              eventName: String(event.name || ""),
            }).toString();
            // close modal/inline form before redirect
            if (onCancel) onCancel();
            router.push(`/payment?${qs}`);
            return;
          }

          if (paymentMethod === "wallet") {
            const qs = new URLSearchParams({
              eventId: String(event._id || event.id || ""),
              userId: String(currentUserId || ""),
              amount: String(event.price ?? ""),
              eventName: String(event.name || ""),
            }).toString();
            if (onCancel) onCancel();
            router.push(`/wallet/pay?${qs}`);
            return;
          }
        } catch (err) {
          console.error("Payment failed:", err);
          setFormErrors({ submit: err?.message || "Payment failed" });
        }
      }}
      className="mt-6 space-y-3"
    >
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <input
          className="px-3 py-2 rounded input-surface"
          placeholder="Full name"
          value={regFormData.name}
          onChange={(e) => setRegFormData((s) => ({ ...s, name: e.target.value }))}
        />
        <input
          className="px-3 py-2 rounded input-surface"
          placeholder="Email"
          value={regFormData.email}
          onChange={(e) => setRegFormData((s) => ({ ...s, email: e.target.value }))}
        />
        <input
          className="px-3 py-2 rounded input-surface"
          placeholder="Student / Staff ID"
          value={regFormData.studentId}
          onChange={(e) => setRegFormData((s) => ({ ...s, studentId: e.target.value }))}
        />
      </div>
      <div className="flex items-center gap-3">
        <input type="hidden" value={regFormData.paymentMethod || "stripe"} />
        <button
          type="button"
          onClick={() => setRegFormData((s) => ({ ...s, paymentMethod: "stripe" }))}
          aria-pressed={regFormData.paymentMethod === "stripe"}
          className={`p-2 rounded-md border flex flex-col items-center gap-1 ${regFormData.paymentMethod === "stripe" ? "ring-2 ring-emerald-400" : "border-transparent"}`}
          title="Pay with card (Visa/Mastercard)"
          aria-label="Pay with card"
        >
          <img src="/Mastercard-visa-card-logo.png" alt="Card payment" className="h-8 object-contain" />
          <span className="text-xs text-gray-300">Card</span>
        </button>

        <button
          type="button"
          onClick={() => setRegFormData((s) => ({ ...s, paymentMethod: "wallet" }))}
          aria-pressed={regFormData.paymentMethod === "wallet"}
          className={`p-2 rounded-md border flex flex-col items-center gap-1 ${regFormData.paymentMethod === "wallet" ? "ring-2 ring-emerald-400" : "border-transparent"}`}
          title="Pay with wallet"
          aria-label="Pay with wallet"
        >
          <img src="/wallet.png" alt="Wallet payment" className="h-8 object-contain" />
          <span className="text-xs text-gray-300">Wallet</span>
        </button>
      </div>
      <div className="flex gap-3">
        <button type="submit" className="px-4 py-2 rounded btn-primary cursor-pointer">
          {event.price && event.price > 0 ? "Pay & Register" : "Register"}
        </button>
        <button type="button" onClick={() => { if (onCancel) onCancel(); else setRegFormVisible(false); }} className="px-4 py-2 rounded input-surface cursor-pointer">
          Cancel
        </button>
      </div>
      <div className="text-sm text-red-500">
        {Object.values(formErrors).map((m, i) => (<div key={i}>{m}</div>))}
      </div>
    </form>
  );

  return (
    <div className="min-h-screen bg-root px-4 py-6 text-root-secondary">
      <div className="max-w-7xl mx-auto">
        <div className="mb-6 flex items-center justify-between">
          <button
            onClick={handleBack}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg input-surface cursor-pointer"
            aria-label="Back"
          >
            <FaArrowLeft /> Back
          </button>
          
        </div>

        <div className="md:grid md:grid-cols-3 md:gap-4 items-start">
          {/* Left: Event details (largest) */}
          <div className="md:col-span-2 bg-surface border border-root rounded-2xl p-6 shadow-elevated">
            <div className="flex flex-col md:flex-row items-start gap-6">
              <div className="w-full md:w-32 flex-shrink-0">
                {(() => {
                  const meta = getTypeMeta(event.eventType || event.type);
                  return (
                    <div
                      className={`w-32 h-32 rounded-lg flex flex-col items-center justify-center gap-2 p-2 ${meta.bgClass} ${meta.textClass} ${meta.ring}`}
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
              </div>

              <div className="flex-1">
                <h2 className="text-2xl font-bold text-secondary mb-1">
                  <div className="flex items-center gap-3">
                    <span>{event.name}</span>
                    {alreadyRegistered && (eventNormType === "trip" || eventNormType === "workshop") && (
                      <span className="inline-flex items-center gap-2 text-sm bg-emerald-600/10 text-emerald-400 px-2 py-1 rounded-full">
                        <FaCheckCircle />
                        Registered
                      </span>
                    )}
                  </div>
                </h2>
                <p className="text-sm text-gray-300 mb-4">
                  {event.description}
                </p>

                <div className="space-y-2 text-sm text-gray-300">
                  {/** Helper to render resources list */}
                  {(() => {
                    const renderResources = (resources) => {
                      if (!resources) return null;
                      if (!Array.isArray(resources))
                        return (
                          <p>
                            <strong>Extra Required Resources:</strong> {String(resources)}
                          </p>
                        );
                      return (
                        <div>
                          <strong>Extra Required Resources:</strong>
                          <ul className="mt-2 ml-4 space-y-2">
                            {resources.map((r, idx) => {
                              const name =
                                (r && (r.resourceName || r.name || r.resource)) ||
                                (typeof r === "string" ? r : "Resource");
                              const qty = r && (r.quantity ?? r.qty ?? r.count ?? null);
                              const key = (r && (r._id || r.id)) || `res-${idx}`;
                              return (
                                <li
                                  key={key}
                                  className="px-3 py-2 rounded-md input-surface text-sm flex justify-between items-center"
                                >
                                  <span className="font-medium text-root-primary">{name}</span>
                                  {qty != null && <span className="text-gray-400">x{qty}</span>}
                                </li>
                              );
                            })}
                          </ul>
                        </div>
                      );
                    };

                    const t = normalizeType(event.eventType || event.type);
                    const priceVal = event.price ?? event.ticketPrice ?? event.ticket_price ?? null;

                    // Exact ordering per type as requested by user
                    if (t === "workshop") {
                      return (
                        <div className="space-y-2 text-sm text-gray-300">
                          
                          {event.location && <p><strong>Location:</strong> {event.location}</p>}
                          {event.startDateTime && <p><strong>Start:</strong> {formatLocalTime(event.startDateTime)}</p>}
                          {event.endDateTime && <p><strong>End:</strong> {formatLocalTime(event.endDateTime)}</p>}
                          {event.registrationDeadline && <p><strong>Registration Deadline:</strong> {formatLocalTime(event.registrationDeadline)}</p>}
                          
                          {event.fullAgenda && <p><strong>Full Agenda:</strong> {event.fullAgenda}</p>}
                          {(event.faculty || event.Faculty || event.facultyName || event.department || event.school) && (
                            <p><strong>Faculty:</strong> {event.faculty || event.Faculty || event.facultyName || event.department || event.school}</p>
                          )}
                          {professors.length > 0 && (
                            <div>
                              <strong>Professors:</strong>
                              <ul className="mt-2 space-y-2">
                                {professors.map((p) => (
                                  <li key={p._id || p.email || p} className="px-3 py-2 rounded-md input-surface text-sm">{p.fullName || p.email}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                          {event.budget != null && <p><strong>Budget:</strong> {String(event.budget)}</p>}
                          {(event.fundingSource || event.funding_source || event.fundSource) && <p><strong>Funding Source:</strong> {event.fundingSource || event.funding_source || event.fundSource}</p>}
                          {renderResources(event.extraRequiredResources || event.extraResources || event.requiredResources || null)}
                          {(event.capacity ?? event.maxCapacity ?? event.capacityLimit) != null && <p><strong>Capacity:</strong> {String(event.capacity ?? event.maxCapacity ?? event.capacityLimit)}</p>}
                          {(priceVal != null || ["conference", "bazaar", "booth"].includes(t)) && (
                            <p><strong>Price:</strong> {priceVal != null ? String(priceVal) : "Customizable"}</p>
                          )}
                        </div>
                      );
                    }

                    if (t === "trip") {
                      return (
                        <div className="space-y-2 text-sm text-gray-300">
                          
                          {event.startDateTime && <p><strong>Start:</strong> {formatLocalTime(event.startDateTime)}</p>}
                          {event.endDateTime && <p><strong>End:</strong> {formatLocalTime(event.endDateTime)}</p>}
                          {event.registrationDeadline && <p><strong>Registration Deadline:</strong> {formatLocalTime(event.registrationDeadline)}</p>}
                          
                          {(event.capacity ?? event.maxCapacity ?? event.capacityLimit) != null && <p><strong>Capacity:</strong> {String(event.capacity ?? event.maxCapacity ?? event.capacityLimit)}</p>}
                          {priceVal != null && <p><strong>Price:</strong> {String(priceVal)}</p>}
                        </div>
                      );
                    }

                    if (t === "bazaar" || t === "booth") {
                      return (
                        <div className="space-y-2 text-sm text-gray-300">
                          
                          {event.location && <p><strong>Location:</strong> {event.location}</p>}
                          {event.startDateTime && <p><strong>Start:</strong> {formatLocalTime(event.startDateTime)}</p>}
                          {event.endDateTime && <p><strong>End:</strong> {formatLocalTime(event.endDateTime)}</p>}
                          {event.registrationDeadline && <p><strong>Registration Deadline:</strong> {formatLocalTime(event.registrationDeadline)}</p>}
                         
                          {participantsVendors.length > 0 && (
                            <div>
                              <strong>Vendors:</strong>
                              <ul className="mt-2 space-y-2">
                                {participantsVendors.map((n, i) => (
                                  <li key={`${n}-${i}`} className="px-3 py-2 rounded-md input-surface text-sm">{n}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                      );
                    }

                    if (t === "conference") {
                      return (
                        <div className="space-y-2 text-sm text-gray-300">
                          {event.location && <p><strong>Location:</strong> {event.location}</p>}
                          {event.startDateTime && <p><strong>Start:</strong> {formatLocalTime(event.startDateTime)}</p>}
                          {event.endDateTime && <p><strong>End:</strong> {formatLocalTime(event.endDateTime)}</p>}
                          {event.registrationDeadline && <p><strong>Registration Deadline:</strong> {formatLocalTime(event.registrationDeadline)}</p>}
                          
                          {event.fullAgenda && <p><strong>Full Agenda:</strong> {event.fullAgenda}</p>}
                          {event.conferenceWebsiteLink && <p><strong>Conference Website:</strong> <a href={event.conferenceWebsiteLink} target="_blank" rel="noreferrer" className="text-blue-400">{event.conferenceWebsiteLink}</a></p>}
                          {event.budget != null && <p><strong>Budget:</strong> {String(event.budget)}</p>}
                          {(event.fundingSource || event.funding_source || event.fundSource) && <p><strong>Funding Source:</strong> {event.fundingSource || event.funding_source || event.fundSource}</p>}
                          {renderResources(event.extraRequiredResources || event.extraResources || event.requiredResources || null)}
                        </div>
                      );
                    }

                    // default fallback
                    return (
                      <div className="space-y-2 text-sm text-gray-300">
                        {event.location && <p><strong>Location:</strong> {event.location}</p>}
                        {event.startDateTime && <p><strong>Start:</strong> {formatLocalTime(event.startDateTime)}</p>}
                        {event.endDateTime && <p><strong>End:</strong> {formatLocalTime(event.endDateTime)}</p>}
                        {event.registrationDeadline && <p><strong>Registration Deadline:</strong> {formatLocalTime(event.registrationDeadline)}</p>}
                        {event.description && <p><strong>Description:</strong> {event.description}</p>}
                      </div>
                    );
                  })()}
                </div>
              </div>
            </div>
            {/* Mobile actions (bottom) */}
            <div className="mt-6 flex flex-col md:hidden items-center gap-3">
              <div className="flex-1 w-full">
                <div className="flex gap-3 flex-wrap">
                  {(() => {
                    const vendorOnlyTypes = ["bazaar", "booth"];
                    const isVendor = isVendorRole;
                    const isConference = eventNormType === "conference";
                    const isVendorOnlyType = vendorOnlyTypes.includes(eventNormType);

                    // Determine whether registration should be disabled and why
                    let shouldDisable = false;
                    let title = "Register";
                    if (isConference) {
                      shouldDisable = true;
                      title = "Registration is done through the conference website.";
                    } else if (isVendorOnlyType && !isVendor) {
                      shouldDisable = true;
                      title = "Only vendors may apply/register for this event.";
                    }

                    // For vendor users on vendor-only events show "Apply" (routes to vendor flow)
                    const label = isVendor && isVendorOnlyType ? "Apply" : "Register";

                    // If the current user already registered for this trip/workshop, disable registration
                    if (alreadyRegistered && (eventNormType === "trip" || eventNormType === "workshop")) {
                      shouldDisable = true;
                      title = "You are already registered for this event.";
                    }

                    return (
                      <span title={shouldDisable ? title : ""} className="inline-block">
                        <button
                          onClick={() => {
                            // vendor flow: route vendors to vendor apply pages for vendor-only types
                            if (isVendor && isVendorOnlyType) {
                              goVendorApply(event);
                              return;
                            }
                            // disabled for conferences or non-vendor vendor-only types
                            if (shouldDisable) return;
                            // For paid events open modal, otherwise open inline form
                            if (event.price && event.price > 0) {
                              setShowPayModal(true);
                              setFormErrors({});
                              return;
                            }
                            setRegFormVisible(true);
                            setFormErrors({});
                          }}
                          className={`px-4 py-2 rounded-lg btn-primary ${shouldDisable ? "opacity-60 cursor-not-allowed" : "cursor-pointer"}`}
                          disabled={shouldDisable}
                          aria-disabled={shouldDisable}
                        >
                          {label}
                        </button>
                      </span>
                    );
                  })()}

                  <button
                    onClick={handleBack}
                    className="px-4 py-2 rounded-lg input-surface cursor-pointer"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Right: stacked Ratings & Comments (if available) and Price/Register card */}
          <div className="md:col-span-1 flex flex-col gap-4 mt-4 md:mt-0">
            {/* Price & Register card (desktop visible, mobile also shown below details) */}
            <div className="bg-surface border border-root rounded-2xl p-4 shadow-elevated">
              <div className="text-sm text-gray-400 mb-2">Price</div>
              <div className="text-2xl font-extrabold text-root-primary mb-3">{priceDisplay}</div>

              <div className="flex flex-col gap-2">
                {(() => {
                  const vendorOnlyTypes = ["bazaar", "booth"];
                  const isVendor = isVendorRole;
                  const isConference = eventNormType === "conference";
                  const isVendorOnlyType = vendorOnlyTypes.includes(eventNormType);
                  let shouldDisable = false;
                  let title = "Register";
                  if (isConference) {
                    shouldDisable = true;
                    title = "Registration is done through the conference website.";
                  } else if (isVendorOnlyType && !isVendor) {
                    shouldDisable = true;
                    title = "Only vendors may apply/register for this event.";
                  }
                  const label = isVendor && isVendorOnlyType ? "Apply" : (event.price && event.price > 0 ? "Pay & Register" : "Register");
                    // If the current user already registered for this trip/workshop, disable registration
                    if (alreadyRegistered && (eventNormType === "trip" || eventNormType === "workshop")) {
                      shouldDisable = true;
                      title = "You have already registered for this event.";
                    }

                    return (
                      <span title={shouldDisable ? title : ""} className="inline-block w-full">
                        <button
                          onClick={() => {
                            if (isVendor && isVendorOnlyType) { goVendorApply(event); return; }
                            if (shouldDisable) return;
                            // For paid events open modal
                            if (event.price && event.price > 0) { setShowPayModal(true); setFormErrors({}); return; }
                            setRegFormVisible(true); setFormErrors({});
                          }}
                          className={`w-full px-4 py-3 rounded-lg btn-primary font-semibold ${shouldDisable ? "opacity-60 cursor-not-allowed" : ""}`}
                          disabled={shouldDisable}
                          aria-disabled={shouldDisable}
                        >
                          {label}
                        </button>
                      </span>
                    );
                })()}

                <button onClick={handleBack} className="w-full px-4 py-2 rounded-lg input-surface">Close</button>
              </div>
            </div>

            {/* Ratings & Comments: reuse the earlier block but wrapped in a card */}
            {(() => {
              const isVendor = String(currentUserRole || "").toLowerCase() === "vendor";
              const t = normalizeType(event.eventType || event.type);
              const hideForNonVendors = ["bazaar", "booth", "conference"];
              const hideForVendors = ["bazaar", "booth", "loyaltyProgram"];
              const shouldHide = isVendor ? hideForVendors.includes(t) : hideForNonVendors.includes(t);
              if (shouldHide) return null;
              return (
                <div className="bg-surface border border-root rounded-2xl p-4 shadow-elevated">
                  <h4 className="text-sm font-semibold text-secondary mb-3">Ratings & comments</h4>
                  <div>
                    <button
                      type="button"
                      onClick={() => setRatingOpen((s) => !s)}
                      className="w-full flex items-center justify-between px-4 py-2 rounded-lg input-surface cursor-pointer"
                      aria-expanded={ratingOpen}
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex text-amber-400">
                          {[1, 2, 3, 4, 5].map((i) => (
                            <FaStar
                              key={i}
                              className={i <= (ratingScore || 0) ? "" : "opacity-30"}
                            />
                          ))}
                        </div>
                        <div className="text-sm text-root-secondary">
                          {editingRatingId
                            ? "Edit your rating"
                            : ratingScore
                            ? "Your rating"
                            : "Add a rating"}
                        </div>
                      </div>
                      <div className="text-sm text-gray-400">{ratingOpen ? "Hide" : "Show"}</div>
                    </button>

                    {ratingOpen && (
                      <div className="mt-3 p-3 bg-background-card rounded-md">
                        <form onSubmit={handleSubmitRating} className="space-y-3">
                          <div className="flex items-center gap-2">
                            {[1, 2, 3, 4, 5].map((i) => (
                              <button
                                key={i}
                                type="button"
                                onClick={() => setRatingScore(i)}
                                className={`text-amber-400 text-xl cursor-pointer ${ratingScore >= i ? "" : "opacity-30"}`}
                                aria-label={`Rate ${i}`}
                              >
                                <FaStar />
                              </button>
                            ))}
                          </div>
                          <textarea
                            className="w-full px-3 py-2 rounded input-surface text-root-secondary"
                            rows={3}
                            placeholder="Write a comment (optional)"
                            value={ratingComment}
                            onChange={(e) => setRatingComment(e.target.value)}
                          />
                          <div className="flex gap-2">
                            <button type="submit" disabled={ratingLoading} className="px-4 py-2 rounded btn-primary">
                              {editingRatingId ? "Save" : "Add rating"}
                            </button>
                            {editingRatingId && (
                              <button type="button" onClick={() => { setEditingRatingId(null); setRatingScore(0); setRatingComment(""); }} className="px-4 py-2 rounded input-surface">Cancel</button>
                            )}
                            <button type="button" onClick={() => setRatingOpen(false)} className="px-4 py-2 rounded input-surface">Close</button>
                          </div>
                        </form>
                      </div>
                    )}

                    <div className="space-y-3 mt-3">
                      {ratings.length === 0 && <div className="text-sm text-gray-400">No ratings yet.</div>}
                      {ratings.map((r) => (
                        <div key={r._id || r.id} className="bg-background-card p-3 rounded-md">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <div className="flex text-amber-400">{[1,2,3,4,5].map((i) => <FaStar key={i} className={i <= (r.score || 0) ? "opacity-100" : "opacity-30"} />)}</div>
                              <div className="text-sm text-gray-300 ml-2">{r.comment || <span className="text-gray-400">No comment</span>}</div>
                            </div>
                            {currentUserId && String(r.user) === String(currentUserId) && (
                              <div className="flex items-center gap-2">
                                <button title="Edit" onClick={() => { setEditingRatingId(r._id || r.id); setRatingScore(r.score || 0); setRatingComment(r.comment || ""); }} className="text-root-secondary"><FaEdit /></button>
                                <button title="Delete" onClick={() => handleDeleteRating(r._id || r.id)} className="text-root-secondary"><FaTrash /></button>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>

        {/* Modal for Pay & Register */}
        {showPayModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="absolute inset-0 bg-black/50" onClick={() => setShowPayModal(false)} />
            <div className="relative z-50 w-full max-w-2xl p-6 bg-surface border border-root rounded-2xl">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold">Pay & Register</h3>
                <button onClick={() => setShowPayModal(false)} className="px-3 py-1 rounded input-surface">Close</button>
              </div>
              {RegistrationForm({ onCancel: () => setShowPayModal(false) })}
            </div>
          </div>
        )}

        {/* Inline registration form (simple) */}
        {regFormVisible && RegistrationForm({ onCancel: () => setRegFormVisible(false) })}
      </div>
    </div>
  );
}
