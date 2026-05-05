"use client";
import { formatLocalTime } from "@/lib/dateFormatter";

export function TripDetailsModal({ trip, onClose }) {
  if (!trip) return null;

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black/40 z-50 p-4">
      <div className="bg-surface text-root-primary rounded-2xl p-6 w-[90%] max-w-lg space-y-4 relative overflow-auto max-h-[90vh] shadow-elevated border border-root">
        <button
          onClick={onClose}
          className="absolute top-3 right-3 text-root-secondary hover:text-root-primary text-lg"
          aria-label="Close"
        >
          ✕
        </button>

        <h2 className="text-xl font-semibold mb-2">{trip.name}</h2>

        <div className="space-y-2 text-sm">
          {trip.location && (
            <p>
              <strong>Location:</strong> {trip.location}
            </p>
          )}

          {trip.description && (
            <p>
              <strong>Description:</strong> {trip.description}
            </p>
          )}

          {trip.price !== undefined && (
            <p>
              <strong>Price:</strong> {trip.price}
            </p>
          )}

          {trip.capacity !== undefined && (
            <p>
              <strong>Capacity:</strong> {trip.capacity}
            </p>
          )}

          {trip.registrationDeadline && (
            <p>
              <strong>Registration Deadline:</strong> {formatLocalTime(trip.registrationDeadline)}
            </p>
          )}

          {trip.startDateTime && (
            <p>
              <strong>Start:</strong> {formatLocalTime(trip.startDateTime)}
            </p>
          )}

          {trip.endDateTime && (
            <p>
              <strong>End:</strong> {formatLocalTime(trip.endDateTime)}
            </p>
          )}

          {trip.extraRequiredResources?.length > 0 && (
            <div className="mt-3">
              <strong>Extra Required Resources:</strong>
              <ul className="list-disc ml-5 mt-1">
                {trip.extraRequiredResources.map((r, i) => (
                  <li key={i}>
                    {r.resourceName} — Qty: {r.quantity}
                  </li>
                ))}
              </ul>
            </div>
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