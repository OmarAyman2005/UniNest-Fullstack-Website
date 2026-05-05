"use client";

import React, { useEffect, useState } from "react";
import { applicationsService } from "@/app/services/applications.service";
import { eventsService } from "@/app/services/events.service";

const normalizeEvent = (eventish) => {
  if (!eventish) return null;
  if (eventish.data && (eventish.data._id || eventish.data.name || eventish.data.title))
    return eventish.data;
  if (eventish._id || eventish.name || eventish.title) return eventish;
  return null;
};

const prettyEventType = (t) => {
  const raw = String(t || "").trim();
  if (!raw) return "";
  const low = raw.toLowerCase().replace(/\s+/g, "");
  if (low === "loyaltyprogram" || low === "loyalty_program") {
    return "Loyalty Program";
  }
  return raw.charAt(0).toUpperCase() + raw.slice(1);
};

const hasValue = (v) => {
  if (v === null || v === undefined) return false;
  if (typeof v === "string") return v.trim().length > 0;
  return true;
};

function mapToOffer(app, eventDocRaw) {
  const ev = normalizeEvent(eventDocRaw) || {};
  const loyalty = app?.loyalty || {};

  const discountRate =
    typeof loyalty.discountRate === "number"
      ? loyalty.discountRate
      : Number(loyalty.discountRate);

  if (!hasValue(loyalty.promoCode) || Number.isNaN(discountRate)) {
    return null;
  }

  return {
    id: app._id,
    vendorName: app?.applicantName || "Vendor",
    promoCode: String(loyalty.promoCode).trim(),
    discountRate,
    terms: loyalty.terms || "",
    eventName: ev.name || ev.title || "",
    eventType: ev.eventType || ev.type || "",
    eventLocation: ev.location || "",
  };
}

export default function GucLoyaltyProgram() {
  const [offers, setOffers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [copiedId, setCopiedId] = useState(null);

  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        setLoading(true);
        setErr("");

        const apps = await applicationsService.listLoyaltyProgram();

        const cache = new Map();
        const getEvent = async (id) => {
          const key = String(id);
          if (cache.has(key)) return cache.get(key);
          const res = await eventsService.getById(key).catch(() => null);
          const doc = res && res.data ? res.data : res;
          cache.set(key, doc);
          return doc;
        };

        const mapped = await Promise.all(
          (apps || []).map(async (app) => {
            let eventDoc =
              normalizeEvent(app.event) || normalizeEvent(app.eventId);

            if (!eventDoc && app.eventId && typeof app.eventId === "string") {
              eventDoc = await getEvent(app.eventId);
            }

            return mapToOffer(app, eventDoc);
          })
        );

        const validOffers = mapped
          .filter(Boolean)
          .sort((a, b) => (b.discountRate || 0) - (a.discountRate || 0));

        if (alive) setOffers(validOffers);
      } catch (e) {
        if (alive) setErr(e?.message || "Failed to load loyalty offers.");
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, []);

  const handleCopy = async (offer) => {
    if (!offer?.promoCode) return;
    try {
      await navigator.clipboard.writeText(offer.promoCode);
      setCopiedId(offer.id);
      setTimeout(() => setCopiedId(null), 1500);
    } catch {
      // ignore
    }
  };

  return (
    <main className="min-h-screen bg-root text-root-primary">
      <section className="max-w-6xl mx-auto px-4 py-10">
        <header className="mb-10 text-center">
          <p className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-highlight text-root-secondary border border-root mb-3 shadow-soft">
            GUC Exclusive
            <span className="inline-block h-1 w-1 rounded-full bg-primary" />
          </p>
          <h1 className="text-3xl md:text-4xl font-semibold mb-3">
            GUC Loyalty Program
          </h1>
          <p className="text-sm md:text-base text-root-secondary max-w-2xl mx-auto">
            Discover all vendors participating in the official loyalty program.
            Enjoy exclusive discounts, special promo codes, and offers tailored
            for the GUC community.
          </p>
        </header>

        {loading && (
          <div className="flex justify-center py-10">
            <div className="animate-pulse text-root-secondary text-sm">
              Loading loyalty offers…
            </div>
          </div>
        )}

        {!loading && err && (
          <div className="mb-6 rounded-2xl border border-error/60 bg-error/10 px-4 py-3 text-sm text-root-primary">
            {err}
          </div>
        )}

        {!loading && !err && offers.length === 0 && (
          <div className="mt-10 text-center text-root-secondary text-sm">
            No active loyalty offers have been published yet.
          </div>
        )}

        {!loading && !err && offers.length > 0 && (
          <>
            <div className="mb-6 flex flex-wrap items-center gap-3 text-xs text-root-secondary">
              <span className="px-3 py-1 rounded-full bg-highlight border border-root">
                {offers.length}{" "}
                {offers.length === 1 ? "active offer" : "active offers"}
              </span>
              <span className="text-root-secondary">
                Tap on any card to copy the promo code and view more details.
              </span>
            </div>

            <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
              {offers.map((offer) => {
                const discountLabel =
                  typeof offer.discountRate === "number"
                    ? `${offer.discountRate}% OFF`
                    : "Special Offer";

                const eventType = prettyEventType(offer.eventType);

                const initials =
                  (offer.vendorName || "V")
                    .split(" ")
                    .map((p) => p[0])
                    .join("")
                    .slice(0, 2)
                    .toUpperCase() || "V";

                const isCopied = copiedId === offer.id;

                return (
                  <article
                    key={offer.id}
                    className="relative overflow-hidden rounded-2xl border border-root bg-surface shadow-elevated"
                  >
                    <div className="pointer-events-none absolute -top-20 -right-10 h-40 w-40 rounded-full bg-primary/10 blur-3xl" />

                    <div className="p-5 space-y-4 relative">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-highlight border border-root text-xs font-semibold text-root-primary">
                            {initials}
                          </div>
                          <div>
                            <h2 className="text-sm font-semibold text-root-primary">
                              {offer.vendorName}
                            </h2>
                            {eventType && (
                              <p className="text-[11px] uppercase tracking-wide text-root-secondary">
                                {eventType}
                              </p>
                            )}
                          </div>
                        </div>

                        <div className="text-right">
                          <p className="text-[11px] uppercase tracking-wide text-root-secondary">
                            Up to
                          </p>
                          <p className="text-lg font-semibold text-root-primary">
                            {discountLabel}
                          </p>
                        </div>
                      </div>

                      {offer.eventName && (
                        <div className="text-xs rounded-xl bg-highlight border border-root px-3 py-2">
                          <p className="font-medium text-root-primary">
                            {offer.eventName}
                          </p>
                          {offer.eventLocation && (
                            <p className="text-[11px] text-root-secondary">
                              📍 {offer.eventLocation}
                            </p>
                          )}
                        </div>
                      )}

                      <div className="flex items-center justify-between gap-3">
                        <div className="flex flex-col">
                          <span className="text-[11px] uppercase tracking-wide text-root-secondary">
                            Promo Code
                          </span>
                          <span className="mt-0.5 inline-flex items-center rounded-lg bg-root px-3 py-1 text-sm font-mono tracking-wide text-root-primary border border-root">
                            {offer.promoCode}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleCopy(offer)}
                          className="px-3 py-1.5 rounded-xl text-[11px] font-semibold border border-root bg-primary text-root-primary hover:bg-primary-hover transition"
                        >
                          {isCopied ? "Copied!" : "Copy"}
                        </button>
                      </div>

                      {hasValue(offer.terms) && (
                        <div className="text-[11px] text-root-secondary border-t border-root/60 pt-3">
                          <p className="uppercase tracking-wide text-root-secondary mb-1">
                            Terms &amp; Conditions
                          </p>
                          <p className="line-clamp-3 whitespace-pre-line">
                            {offer.terms}
                          </p>
                        </div>
                      )}

                      <p className="text-[10px] text-root-secondary pt-1">
                        * Offers are managed by the respective vendors and may
                        be subject to change.
                      </p>
                    </div>
                  </article>
                );
              })}
            </div>
          </>
        )}
      </section>
    </main>
  );
}
