"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { formatLocalTime } from "@/lib/dateFormatter.js";
import { api } from "@/lib/admin/eventApi.js";
import { FaArrowLeft, FaStar, FaBan } from "react-icons/fa";
import { FaUndo } from "react-icons/fa";
export default function EventDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id;
  const [event, setEvent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [participants, setParticipants] = useState([]);
  const [partsLoading, setPartsLoading] = useState(false);
  const [partsError, setPartsError] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [currentUserRole, setCurrentUserRole] = useState(null);
  const [professorsNames, setProfessorsNames] = useState([]);

  // load current user (role) to include in moderation requests
  useEffect(() => {
    let mounted = true;
    const loadMe = async () => {
      try {
        const res = await api("/auth/me");
        const payload = res && res.data ? res.data : res;
        const role = payload?.user?.role || payload?.role || null;
        if (!mounted) return;
        setCurrentUserRole(role ? String(role).toLowerCase() : null);
      } catch (err) {
        console.warn("Failed to load current user", err);
      }
    };
    loadMe();
    return () => { mounted = false; };
  }, []);

  // resolve professor names when event loads (event.professors is an array of ids)
  useEffect(() => {
    let mounted = true;
    const loadProfessors = async () => {
      if (!event || !Array.isArray(event.professors) || event.professors.length === 0) {
        if (mounted) setProfessorsNames([]);
        return;
      }
      try {
        const ids = event.professors;
        const res = await Promise.all(ids.map((pid) => api(`/public/professors/${pid}`)));
        const names = res.map((r) => {
          const p = r && r.data ? r.data : r;
          return p?.fullName || p?.name || p?.displayName || null;
        }).filter(Boolean);
        if (mounted) setProfessorsNames(names);
      } catch (err) {
        console.error("Failed to load professors", err);
        if (mounted) setProfessorsNames([]);
      }
    };
    loadProfessors();
    return () => { mounted = false; };
  }, [event]);

  const refreshEvent = async () => {
    try {
      const res = await api(`/event/${id}`);
      const payload = res && res.data ? res.data : res;
      setEvent(payload);
    } catch (err) {
      console.error("refreshEvent failed", err);
    }
  };

  const handleRemoveComment = async (ratingId) => {
    if (!confirm("Remove this comment?")) return;
    setActionLoading(true);
    try {
      await api(`/event/${id}/ratings/${ratingId}/comment`, { method: "DELETE", body: { role: currentUserRole }});
      await refreshEvent();
    } catch (err) {
      console.error("remove comment failed", err);
    } finally {
      setActionLoading(false);
    }
  };

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      setLoading(true);
      try {
        const res = await api(`/event/${id}`);
        const payload = res && res.data ? res.data : res;
        if (!mounted) return;
        setEvent(payload);
      } catch (err) {
        console.error("Failed to load event", err);
        if (mounted) setEvent(null);
      } finally {
        if (mounted) setLoading(false);
      }
    };
    if (id) load();
    return () => { mounted = false; };
  }, [id]);

  useEffect(() => {
    let mounted = true;
    const loadParticipants = async () => {
      if (!event) return;
      const t = String(event.eventType || event.type || "").toLowerCase();
          if (!["bazaar", "booth"].includes(t)) {
            setParticipants([]);
            return;
          }
          setPartsLoading(true);
          setPartsError(null);
          try {
            const resp = await api(`/event/${event._id || event.id}/participants`);
            let payload = resp;
            if (resp && typeof resp.json === "function") payload = await resp.json();
            const list = payload?.data ?? payload ?? [];
            if (mounted) setParticipants(Array.isArray(list) ? list : []);
          } catch (err) {
            console.error("Failed to load participants:", err);
            if (mounted) {
              setPartsError("Failed to load participants");
              setParticipants([]);
            }
          } finally {
            if (mounted) setPartsLoading(false);
          }
    };
    loadParticipants();
    return () => { mounted = false; };
  }, [event]);

  if (loading) return <main className="min-h-screen p-8">Loading...</main>;
  if (!event) return <main className="min-h-screen p-8">Event not found</main>;
  const renderResources = (resources) => {
    if (resources === undefined || resources === null) return null;
    if (!Array.isArray(resources)) return <p><strong>Extra Required Resources:</strong> {String(resources)}</p>;
    return (
      <div>
        <strong>Extra Required Resources:</strong>
        <ul className="mt-2 ml-4 space-y-2">
          {resources.map((r, idx) => {
            const name = (r && (r.resourceName || r.name || r.resource)) || (typeof r === 'string' ? r : 'Resource');
            const qty = r && (r.quantity ?? r.qty ?? r.count ?? null);
            const key = (r && (r._id || r.id)) || `res-${idx}`;
            return (
              <li key={key} className="px-3 py-2 rounded-md input-surface text-sm flex justify-between items-center">
                <span className="font-medium text-root-primary">{name}</span>
                {qty != null && <span className="text-gray-400">x{qty}</span>}
              </li>
            );
          })}
        </ul>
      </div>
    );
  };

  return (
    <main className="min-h-screen p-8">
      <div className="max-w-3xl mx-auto">
        <button onClick={() => router.back()} className="inline-flex items-center gap-2 px-3 py-2 rounded-lg btn-primary mb-4">
          <FaUndo /> Back
        </button>

        <div className="bg-surface text-root-primary rounded-2xl p-6 shadow-elevated border border-root">
          <h1 className="text-2xl font-semibold mb-3">{event.name}</h1>

          <div className="space-y-3 text-sm">
            {(() => {
              const t = String(event.eventType || event.type || "").toLowerCase();
              const priceVal = event.price ?? event.ticketPrice ?? event.ticket_price ?? null;

              if (t === 'workshop') {
                return (
                  <div>
                    {event.location && <p><strong>Location:</strong> {event.location}</p>}
                    {event.startDateTime && <p><strong>Start:</strong> {formatLocalTime(event.startDateTime)}</p>}
                    {event.endDateTime && <p><strong>End:</strong> {formatLocalTime(event.endDateTime)}</p>}
                    {event.registrationDeadline && <p><strong>Registration Deadline:</strong> {formatLocalTime(event.registrationDeadline)}</p>}
                    {event.description && <p><strong>Description:</strong> {event.description}</p>}
                    {event.fullAgenda && <p><strong>Full Agenda:</strong> {event.fullAgenda}</p>}
                    {(event.faculty || event.facultyName || event.department || event.school) && <p><strong>Faculty:</strong> {event.faculty || event.facultyName || event.department || event.school}</p>}
                    {Array.isArray(professorsNames) && professorsNames.length > 0 && (
                      <div>
                        <strong>Professors:</strong>
                        <ul className="mt-2 space-y-2">
                          {professorsNames.map((n, i) => (
                            <li key={`${n}-${i}`} className="px-3 py-2 rounded-md input-surface text-sm">{n}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {event.budget != null && <p><strong>Budget:</strong> {String(event.budget)}</p>}
                    {(event.fundingSource || event.funding_source || event.fundSource) && <p><strong>Funding Source:</strong> {event.fundingSource || event.funding_source || event.fundSource}</p>}
                    {renderResources(event.extraRequiredResources || event.extraResources || event.requiredResources || null)}
                    {(event.capacity ?? event.maxCapacity ?? event.capacityLimit) != null && <p><strong>Capacity:</strong> {String(event.capacity ?? event.maxCapacity ?? event.capacityLimit)}</p>}
                    {priceVal != null && <p><strong>Price:</strong> {String(priceVal)}</p>}
                  </div>
                );
              }

              if (t === 'trip') {
                return (
                  <div>
                    {event.location && <p><strong>Location:</strong> {event.location}</p>}
                    {event.startDateTime && <p><strong>Start:</strong> {formatLocalTime(event.startDateTime)}</p>}
                    {event.endDateTime && <p><strong>End:</strong> {formatLocalTime(event.endDateTime)}</p>}
                    {event.registrationDeadline && <p><strong>Registration Deadline:</strong> {formatLocalTime(event.registrationDeadline)}</p>}
                    {event.description && <p><strong>Description:</strong> {event.description}</p>}
                    {(event.capacity ?? event.maxCapacity ?? event.capacityLimit) != null && <p><strong>Capacity:</strong> {String(event.capacity ?? event.maxCapacity ?? event.capacityLimit)}</p>}
                    {priceVal != null && <p><strong>Price:</strong> {String(priceVal)}</p>}
                  </div>
                );
              }

              if (t === 'bazaar' || t === 'booth') {
                return (
                  <div>
                    {event.location && <p><strong>Location:</strong> {event.location}</p>}
                    {event.startDateTime && <p><strong>Start:</strong> {formatLocalTime(event.startDateTime)}</p>}
                    {event.endDateTime && <p><strong>End:</strong> {formatLocalTime(event.endDateTime)}</p>}
                    {event.registrationDeadline && <p><strong>Registration Deadline:</strong> {formatLocalTime(event.registrationDeadline)}</p>}
                    {event.description && <p><strong>Description:</strong> {event.description}</p>}
                  </div>
                );
              }

              if (t === 'conference') {
                return (
                  <div>
                    {event.location && <p><strong>Location:</strong> {event.location}</p>}
                    {event.startDateTime && <p><strong>Start:</strong> {formatLocalTime(event.startDateTime)}</p>}
                    {event.endDateTime && <p><strong>End:</strong> {formatLocalTime(event.endDateTime)}</p>}
                    {event.registrationDeadline && <p><strong>Registration Deadline:</strong> {formatLocalTime(event.registrationDeadline)}</p>}
                    {event.description && <p><strong>Description:</strong> {event.description}</p>}
                    {event.fullAgenda && <p><strong>Full Agenda:</strong> {event.fullAgenda}</p>}
                    {event.conferenceWebsiteLink && (
                      <p><strong>Conference Website:</strong> <a href={event.conferenceWebsiteLink} target="_blank" rel="noreferrer" className="text-blue-400">{event.conferenceWebsiteLink}</a></p>
                    )}
                    {event.budget != null && <p><strong>Budget:</strong> {String(event.budget)}</p>}
                    {(event.fundingSource || event.funding_source || event.fundSource) && <p><strong>Funding Source:</strong> {event.fundingSource || event.funding_source || event.fundSource}</p>}
                    {renderResources(event.extraRequiredResources || event.extraResources || event.requiredResources || null)}
                  </div>
                );
              }

              // default: show common fields
              return (
                <div>
                  {event.location && <p><strong>Location:</strong> {event.location}</p>}
                  {event.startDateTime && <p><strong>Start:</strong> {formatLocalTime(event.startDateTime)}</p>}
                  {event.endDateTime && <p><strong>End:</strong> {formatLocalTime(event.endDateTime)}</p>}
                  {event.registrationDeadline && <p><strong>Registration Deadline:</strong> {formatLocalTime(event.registrationDeadline)}</p>}
                  {event.description && <p><strong>Description:</strong> {event.description}</p>}
                </div>
              );
            })()}

            {/* Vendors / participants */}
            {["bazaar", "booth"].includes(String(event.eventType || event.type || "").toLowerCase()) && (
              <div>
                <strong>Vendors:</strong>
                <div className="mt-2">
                  {partsLoading ? (
                    <div className="text-sm text-root-primary">Loading vendors...</div>
                  ) : partsError ? (
                    <div className="text-sm text-error">{partsError}</div>
                  ) : participants.length === 0 ? (
                    <div className="text-sm text-root-primary">No vendors registered yet.</div>
                  ) : (
                    <ul className="space-y-2">
                      {participants.map((p) => {
                        const isString = typeof p === "string" || typeof p === "number";
                        const name = isString ? String(p) : p?.name || p?.companyName || p?.displayName || (typeof p?.vendor === "string" ? p.vendor : p?.vendor?.name) || "Vendor";
                        const key = isString ? `vendor-${name}` : (p._id || p.id || `vendor-${name}`);
                        return (
                          <li key={key} className="px-3 py-2 rounded-md input-surface text-sm">
                            <div className="font-medium text-root-primary">{name}</div>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
        {/* RATINGS TABLE: move outside the main container and show only for non-booth/non-bazaar */}
        {!["bazaar", "booth"].includes(String(event.eventType || event.type || "").toLowerCase()) && (
          <div className="mt-6 max-w-3xl mx-auto">
            <div className="rounded-2xl p-4 bg-surface border border-root shadow-elevated">
              <h3 className="text-lg text-white font-semibold mb-3">Ratings & comments</h3>
              {Array.isArray(event.ratings) && event.ratings.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead>
                      <tr className="text-left text-xs text-gray-400">
                        <th className="px-3 py-2">User</th>
                        <th className="px-3 py-2">Rate</th>
                        <th className="px-3 py-2">Comment</th>
                        <th className="px-3 py-2">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {event.ratings.map((r) => (
                        <tr key={r._id || r.id} className="border-t border-root/10">
                          <td className="px-3 py-2 text-white align-top">{r.userName || r.user || "User"}</td>
                          <td className="px-3 py-2 align-top">
                            <div className="flex items-center text-amber-400">
                              {[1,2,3,4,5].map((i) => <FaStar key={i} className={i <= (r.score || 0) ? "mr-1" : "mr-1 opacity-30"} />)}
                            </div>
                          </td>
                          <td className="px-3 py-2 text-white align-top">{r.comment || <span className="text-gray-400">No comment</span>}</td>
                          <td className="px-3 py-2 align-top">
                            <div className="flex gap-2">
                              {/* admin can remove only the comment */}
                              <button disabled={actionLoading} onClick={() => handleRemoveComment(r._id || r.id)} className="px-3 py-1 rounded input-surface text-sm inline-flex items-center gap-2">
                                <FaBan /> Remove comment
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-sm text-gray-400">No ratings yet.</div>
              )}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}