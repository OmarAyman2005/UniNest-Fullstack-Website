"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import "./applicationSubmittedVendor.css";

export default function ApplicationSubmittedVendorPage() {
  const search = useSearchParams();
  const type = (search.get("type") || "booth").toLowerCase();
  const ref = search.get("ref");

  const title =
    type === "bazaar"
      ? "Bazaar application submitted!"
      : "Booth application submitted!";

  const subtitle =
    type === "bazaar"
      ? "Your bazaar request has been received. We’ll review it and notify you by email."
      : "Your booth request has been received. We’ll review it and notify you by email.";

  return (
    <div className="min-h-screen bg-root px-6 py-10 text-root-secondary flex items-center">
      <div className="w-full max-w-xl mx-auto">
        <div className="rounded-2xl bg-surface p-8 shadow-elevated">
          <div className="flex items-center gap-4 mb-4">
            <div className="status-icon" aria-hidden="true">
              <svg
                width="56"
                height="56"
                viewBox="0 0 24 24"
                role="img"
                className="text-primary"
              >
                <circle
                  cx="12"
                  cy="12"
                  r="10"
                  fill="currentColor"
                  opacity="0.12"
                />
                <path
                  d="M7 12.5l3.2 3.2L17 9.9"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>

            <div>
              <h1 className="text-2xl md:text-3xl mb-1">{title}</h1>
              <p className="text-sm text-root-secondary">{subtitle}</p>
            </div>
          </div>

          {ref && (
            <p className="text-sm text-root-secondary mb-4">
              Reference:{" "}
              <span className="text-root-primary">{ref}</span>
            </p>
          )}

          <div className="mt-6 flex justify-center items-center gap-3">
            <Link href="/vendor-requests" className="btn btn-primary" role="button">
              View my applications
            </Link>
            <Link href="/home" className="btn btn-ghost" role="button">
              Return to home
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
