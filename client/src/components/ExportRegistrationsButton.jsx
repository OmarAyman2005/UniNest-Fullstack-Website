// client/src/components/ExportRegistrationsButton.jsx
"use client";
import { useCallback } from "react";
import { FaFileExcel } from "react-icons/fa";

function getApiBase() {
  const a = process?.env?.NEXT_PUBLIC_API_BASE;
  const b = process?.env?.NEXT_PUBLIC_API_URL;
  const env = (a || b || "").replace(/\/+$/, "");
  if (env) return env;
  const { protocol, hostname } = window.location;
  return `${protocol}//${hostname}:5000/api`;
}

export default function ExportRegistrationsButton({ eventId, className = "" }) {
  const onClick = useCallback(() => {
    if (!eventId) return;
    const base = getApiBase();
    window.open(`${base}/event/${eventId}/export-registrations.xlsx`, "_blank", "noopener,noreferrer");
  }, [eventId]);

  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-2 px-3 py-2 rounded-md input-surface hover:opacity-90 transition ${className}`}
      title="Export registrations (.xlsx)"
      aria-label="Export registrations"
    >
      <FaFileExcel className="text-sm" />
      <span>Export</span>
    </button>
  );
}
