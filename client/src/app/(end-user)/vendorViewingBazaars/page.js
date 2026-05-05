"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import "./vendorViewingBazaars.css";
import { eventsService } from "@/app/services/events.service";

function fmtDateTime(dt) {
  if (!dt) return "—";
  return new Date(dt).toLocaleString("en-EG", {
    timeZone: "Africa/Cairo",
    weekday: "short",
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function mapBazaar(x) {
  return {
    id: x._id || x.id,
    name: x.name || x.title,
    start: x.startDateTime || x.startsAt,
    end: x.endDateTime || x.endsAt,
    location: x.location,
    description: x.description || x.shortDescription,
    registrationDeadline: x.registrationDeadline,
  };
}

export default function VendorViewingBazaarPage() {
  const [items, setItems] = useState([]);
  const [expandedId, setExpandedId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setErr("");
    try {
      // Use eventsService and ask for type='bazaar'
      const raw = await eventsService.listRaw({ type: "bazaar" });

      const now = Date.now();
      const data = (raw || [])
        // Ensure type is bazaar (server-side filter + client safety)
        .filter(
          (e) => String(e.eventType || e.type || "").toLowerCase() === "bazaar"
        )
        // Upcoming only
        .filter((e) => {
          const t = new Date(e.startDateTime || e.startsAt).getTime();
          return Number.isFinite(t) ? t >= now : true; // if date missing, keep it
        })
        .map(mapBazaar)
        .sort((a, b) => new Date(a.start) - new Date(b.start));

      setItems(data);
    } catch (e) {
      setErr(e?.message || "Failed to load bazaars");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const toggle = useCallback(
    (id) => setExpandedId((curr) => (curr === id ? null : id)),
    []
  );

  const onKeyToggle = useCallback(
    (e, id) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        toggle(id);
      }
    },
    [toggle]
  );

  return (
    <main className="vendor-bazaars">
      <h1 className="vb-title">Upcoming Bazaars</h1>

      {loading && <div className="vb-empty">Loading…</div>}
      {err && !loading && <div className="vb-empty">Error: {err}</div>}

      {!loading && !err && (
        <div className="vb-list" role="list">
          <div className="vb-header">
            <span>Bazaar</span>
            <span>Start</span>
          </div>

          {items.map((bz) => {
            const isOpen = expandedId === bz.id;
            return (
              <div key={bz.id} className="vb-group" role="listitem">
                {/* Row */}
                <div
                  className={`vb-row ${isOpen ? "is-open" : ""}`}
                  onClick={() => toggle(bz.id)}
                  onKeyDown={(e) => onKeyToggle(e, bz.id)}
                  role="button"
                  tabIndex={0}
                  aria-expanded={isOpen}
                  aria-controls={`details-${bz.id}`}
                >
                  <span className="vb-name">{bz.name}</span>
                  <time className="vb-date">{fmtDateTime(bz.start)}</time>
                </div>

                {/* Details */}
                {isOpen && (
                  <div
                    id={`details-${bz.id}`}
                    className="vb-details"
                    aria-live="polite"
                  >
                    <div className="vb-details__main">
                      <div className="vb-field">
                        <span className="vb-label">Starts:</span>
                        <time>{fmtDateTime(bz.start)}</time>
                      </div>
                      <div className="vb-field">
                        <span className="vb-label">Ends:</span>
                        <time>{fmtDateTime(bz.end)}</time>
                      </div>
                      <div className="vb-field">
                        <span className="vb-label">Location:</span>
                        <span>{bz.location || "—"}</span>
                      </div>
                      <div className="vb-field">
                        <span className="vb-label">Registration deadline:</span>
                        <time>{fmtDateTime(bz.registrationDeadline)}</time>
                      </div>

                      <p className="vb-details__desc">{bz.description}</p>
                    </div>

                    <div className="vb-details__actions">
                      <Link
                        href={`/vendorApplyingBazaars/${bz.id}`}
                        className="vb-apply-btn"
                        prefetch={false}
                        title={`Apply to ${bz.name}`}
                      >
                        Apply Now
                      </Link>
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          {items.length === 0 && (
            <div className="vb-empty">No upcoming bazaars yet.</div>
          )}
        </div>
      )}
    </main>
  );
}
