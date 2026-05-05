"use client";
import { formatLocalTime } from "@/lib/dateFormatter";

export default function ViewDetailsModal({ request, onClose }) {
  if (!request) return null;
  const workshop = request.workshop || {};
  const professors = workshop.professors || [];
  const resources = workshop.extraRequiredResources || [];

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

        <h2 className="text-xl font-semibold mb-2">
          {workshop.name || "Workshop Details"}
        </h2>

        <div className="space-y-2 text-sm">
          {workshop.location && (
            <p>
              <strong>Location:</strong> {workshop.location}
            </p>
          )}

          {workshop.description && (
            <p>
              <strong>Description:</strong> {workshop.description}
            </p>
          )}

          {workshop.startDateTime && (
            <p>
              <strong>Start:</strong> {formatLocalTime(workshop.startDateTime)}
            </p>
          )}

          {workshop.endDateTime && (
            <p>
              <strong>End:</strong> {formatLocalTime(workshop.endDateTime)}
            </p>
          )}

          {workshop.registrationDeadline && (
            <p>
              <strong>Registration Deadline:</strong>{" "}
              {formatLocalTime(workshop.registrationDeadline)}
            </p>
          )}

          {professors.length > 0 && (
            <div className="mt-3">
              <strong>Professors:</strong>
              <ul className="list-disc ml-5 mt-1">
                {professors.map((p, i) => (
                  <li key={i}>
                    {(p.fullName || p.name || String(p)) +
                      (p.contribution ? ` — ${p.contribution}` : "")}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {resources.length > 0 && (
            <div className="mt-3">
              <strong>Extra Required Resources:</strong>
              <ul className="list-disc ml-5 mt-1">
                {resources.map((r, i) => (
                  <li key={i}>
                    {r.resourceName} — Qty: {r.quantity}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {request.status != "pending" && (
            <div className="mt-3 rounded-md border border-root bg-surface p-3">
              <p className="text-sm text-center">
                <strong
                  className={
                    request.status === "edit_required"
                      ? "text-yellow-500"
                      : request.status === "rejected"
                        ? "text-red-500"
                        : "text-green-500"
                  }
                >
                  {request.status === "edit_required"
                    ? "Edit Required"
                    : request.status === "rejected"
                      ? "Rejected"
                      : "Accepted"}
                </strong>
              </p>
              {request.comment && (
                <p className="mt-1 text-sm">
                  <strong>Admin Comment:</strong> {request.comment}
                </p>
              )}
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
