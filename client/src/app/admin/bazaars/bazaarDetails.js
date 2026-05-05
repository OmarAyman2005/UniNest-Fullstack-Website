"use client";
import { formatLocalTime } from "@/lib/dateFormatter";

export function BazaarDetailsModal({ bazaar, onClose }) {
    if (!bazaar) return null;

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

                <h2 className="text-xl font-semibold mb-2">{bazaar.name}</h2>

                <div className="space-y-2 text-sm">
                    {bazaar.location && (
                        <p>
                            <strong>Location:</strong> {bazaar.location}
                        </p>
                    )}
                    {bazaar.description && (
                        <p>
                            <strong>Description:</strong> {bazaar.description}
                        </p>
                    )}
                    {bazaar.startDateTime && (
                        <p>
                            <strong>Start:</strong> {formatLocalTime(bazaar.startDateTime)}
                        </p>
                    )}
                    {bazaar.endDateTime && (
                        <p>
                            <strong>End:</strong> {formatLocalTime(bazaar.endDateTime)}
                        </p>
                    )}
                    {bazaar.registrationDeadline && (
                        <p>
                            <strong>Registration Deadline:</strong> {formatLocalTime(bazaar.registrationDeadline)}
                        </p>
                    )}
                    {bazaar.eventType && (
                        <p>
                            <strong>Type:</strong> {" "}
                            {String(bazaar.eventType).charAt(0).toUpperCase() + String(bazaar.eventType).slice(1)}
                        </p>
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