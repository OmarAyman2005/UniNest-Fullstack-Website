"use client";
import { formatLocalTime } from "@/lib/dateFormatter";

export function ConferenceDetailsModal({ conference, onClose }) {
  if (!conference) return null;

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

        <h2 className="text-xl font-semibold mb-2">{conference.name}</h2>

        <div className="space-y-2 text-sm">
          {conference.location && (
            <p>
              <strong>Location:</strong> {conference.location}
            </p>
          )}

          {conference.description && (
            <p>
              <strong>Description:</strong> {conference.description}
            </p>
          )}

          {conference.fullAgenda && (
            <p>
              <strong>Full Agenda:</strong> {conference.fullAgenda}
            </p>
          )}

          {conference.conferenceWebsiteLink && (
            <p>
              <strong>Website:</strong>{" "}
              <a
                href={conference.conferenceWebsiteLink}
                target="_blank"
                rel="noopener noreferrer"
                className="text-root-primary underline"
              >
                {conference.conferenceWebsiteLink}
              </a>
            </p>
          )}

          {conference.fundingSource && (
            <p>
              <strong>Funding Source:</strong> {conference.fundingSource}
            </p>
          )}

          {conference.budget !== undefined && (
            <p>
              <strong>Budget:</strong> {conference.budget}
            </p>
          )}

          {conference.registrationDeadline && (
            <p>
              <strong>Registration Deadline:</strong> {formatLocalTime(conference.registrationDeadline)}
            </p>
          )}

          {conference.startDateTime && (
            <p>
              <strong>Start:</strong> {formatLocalTime(conference.startDateTime)}
            </p>
          )}

          {conference.endDateTime && (
            <p>
              <strong>End:</strong> {formatLocalTime(conference.endDateTime)}
            </p>
          )}

          {conference.extraRequiredResources?.length > 0 && (
            <div className="mt-3">
              <strong>Extra Required Resources:</strong>
              <ul className="list-disc ml-5 mt-1">
                {conference.extraRequiredResources.map((r, i) => (
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