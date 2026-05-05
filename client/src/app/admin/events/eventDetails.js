"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { formatLocalTime } from "@/lib/dateFormatter.js";
import { api } from "@/lib/admin/eventApi";
import ExportRegistrationsButton from "@/components/ExportRegistrationsButton"; // ← existing

export function EventDetailsModal({ event, onClose }) {
  if (!event) return null;

  const commonFields = [
    { label: "Location", value: event.location },
    { label: "Description", value: event.description },
    { label: "Start", value: formatLocalTime(event.startDateTime) },
    { label: "End", value: formatLocalTime(event.endDateTime) },
    { label: "Registration Deadline", value: formatLocalTime(event.registrationDeadline) },
    {
      label: "Type",
      value: event.eventType
        ? String(event.eventType).charAt(0).toUpperCase() + String(event.eventType).slice(1)
        : event.eventType,
    },
  ];

  // participants (vendors) for bazaars/booths
  const [participants, setParticipants] = useState([]);
  const [partsLoading, setPartsLoading] = useState(false);
  const [partsError, setPartsError] = useState(null);

  useEffect(() => {
    let mounted = true;
    const loadParticipants = async () => {
      // only fetch for bazaars or booths
      if (!event || !["bazaar", "booth"].includes(String(event.eventType || event.type || "").toLowerCase())) {
        setParticipants([]);
        return;
      }
      setPartsLoading(true);
      setPartsError(null);
      try {
        const id = event._id || event.id;
        const resp = await api(`/event/${id}/participants`);
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
    return () => {
      mounted = false;
    };
  }, [event]);

  // Dynamically get extra fields
  const extraFields = [];

  if (event.eventType === "conference") {
    if (event.fullAgenda) extraFields.push({ label: "Full Agenda", value: event.fullAgenda });
    if (event.conferenceWebsiteLink)
      extraFields.push({
        label: "Website",
        value: (
          <a
            href={event.conferenceWebsiteLink}
            target="_blank"
            rel="noopener noreferrer"
            className="text-root-primary underline"
          >
            {event.conferenceWebsiteLink}
          </a>
        ),
      });
    if (event.budget) extraFields.push({ label: "Budget", value: `$${event.budget}` });
    if (event.fundingSource) extraFields.push({ label: "Funding Source", value: event.fundingSource });
    if (event.extraRequiredResources?.length) {
      extraFields.push({
        label: "Extra Required Resources",
        value: (
          <ul className="list-disc pl-5">
            {event.extraRequiredResources.map((res) => (
              <li key={res._id}>{res.resourceName} (Qty: {res.quantity})</li>
            ))}
          </ul>
        ),
      });
    }
  }

  if (event.eventType === "trip") {
    if (event.price) extraFields.push({ label: "Price", value: `$${event.price}` });
    if (event.capacity) extraFields.push({ label: "Capacity", value: event.capacity });
  }

  // helpers
  const eventId = event._id || event.id;
  const isConference = String(event.eventType).toLowerCase() === "conference";
  const isBazaar = String(event.eventType).toLowerCase() === "bazaar";
  const isBooth = String(event.eventType).toLowerCase() === "booth";
  const isCareerFair = /career\s*fair/i.test(String(event.name || ""));
  const canShowExternalQR = Boolean((isBazaar || isBooth || isCareerFair) && event.externalVisitorsEnabled);

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black/40 z-50 p-4">
      <div className="bg-surface text-root-primary rounded-2xl p-6 w-[90%] max-w-lg space-y-4 relative overflow-auto max-h-[90vh] shadow-elevated border border-root">
        <button
          onClick={onClose}
          className="absolute top-3 right-3 text-white/70 hover:text-white text-lg"
        >
          ✕
        </button>

        <h2 className="text-xl text-center font-semibold mb-2">{event.name}</h2>

        <div className="space-y-2 text-sm">
          {commonFields.map(
            (field) =>
              field.value && (
                <p key={field.label}>
                  <strong>{field.label}:</strong> {field.value}
                </p>
              )
          )}
          {extraFields.map((field) => (
            <p key={field.label}>
              <strong>{field.label}:</strong> {field.value}
            </p>
          ))}

          {/* Participants / Vendors (for bazaars / booths) */}
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
                      const name =
                        isString
                          ? String(p)
                          : p?.name ||
                            p?.companyName ||
                            p?.displayName ||
                            (typeof p?.vendor === "string" ? p.vendor : p?.vendor?.name) ||
                            "Vendor";
                      const key = isString ? `vendor-${name}` : p._id || p.id || `vendor-${name}`;
                      return (
                        <li key={key} className="px-3 py-2 rounded-md input-surface text-sm">
                          <div className="flex justify-between items-center">
                            <div className="font-medium text-root-primary">{name}</div>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Actions row: Export + External QR */}
        <div className="flex flex-wrap gap-2 justify-between items-center pt-2">
          {/* Export registrations (hide for conferences) */}
          {!isConference && <ExportRegistrationsButton eventId={eventId} />}

          {/* External visitor QR (bazaars, booths & career fairs) */}
          {canShowExternalQR && (
            <Link
              href={`/admin/events/${eventId}/external-qr`} // ← admin alias route (prevents 404 from admin)
              className="inline-flex items-center px-3 py-2 rounded-md border border-black/10 hover:border-black/20 transition"
            >
              External visitor QR
            </Link>
          )}
        </div>

        <div className="flex justify-end mt-4">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-2xl bg-primary text-root-primary hover:opacity-90"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
