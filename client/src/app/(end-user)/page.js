"use client";

import Link from "next/link";
import { CalendarDays, Users, ShieldCheck } from "lucide-react";

export default function Home() {
  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
      <section
        className="
          rounded-2xl
          bg-surface
          border border-root
          shadow-elevated
          p-6 sm:p-8
        "
      >
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-6">
          <div className="flex-1">
            <h1 className="text-2xl sm:text-3xl font-bold text-root-primary">UNINEST</h1>
            <p className="mt-2 text-sm sm:text-base text-root-secondary">
              Discover, Book, Attend — explore events, workshops, trips, and campus activities.
            </p>

            {/* Single CTA */}
            <div className="mt-5">
              <Link
                href="/events"
                className="inline-block px-5 py-2.5 rounded-2xl btn-primary transition"
              >
                Browse Events
              </Link>
            </div>

            <div className="mt-5 flex flex-wrap items-center gap-4 text-sm text-root-secondary">
              <div className="flex items-center gap-2">
                <span className="inline-block w-3 h-3 rounded-full bg-highlight" />
                Weekly events
              </div>
              <div className="flex items-center gap-2">
                <span className="inline-block w-3 h-3 rounded-full bg-highlight" />
                On-campus & off-campus
              </div>
            </div>
          </div>

          {/* Callout */}
          <div
            className="
              flex-1 rounded-xl
              bg-root/60
              border border-root
              shadow-elevated
              p-5
            "
          >
            <h3 className="font-semibold text-root-primary text-center">Discover & Join</h3>
            <p className="text-center text-sm text-root-secondary mt-1">
              Browse activities, RSVP, and track your participation.
            </p>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <FeatureCard
          icon={<CalendarDays className="w-5 h-5" />}
          title="Curated events"
          text="From tech talks to trips—organized for students, staff, TAs, and professors."
        />
        <FeatureCard
          icon={<Users className="w-5 h-5" />}
          title="Smart participation"
          text="RSVP, receive reminders, and keep track of what you've joined."
        />
        <FeatureCard
          icon={<ShieldCheck className="w-5 h-5" />}
          title="Verified accounts"
          text="University emails and admin approval help keep the community safe."
        />
      </section>

      {/* CTA band */}
      <section className="rounded-2xl bg-surface text-root-primary p-6 sm:p-8 shadow-elevated">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h3 className="text-xl font-semibold">Ready to explore?</h3>
            <p className="text-sm text-root-secondary">
              See what's happening this week and reserve your spot.
            </p>
          </div>
          <Link
            href="/events"
            className="self-start md:self-auto px-5 py-2.5 rounded-2xl btn-primary hover:bg-primary-hover transition"
          >
            Browse Events
          </Link>
        </div>
      </section>
    </div>
  );
}

/* ---------------------------- helpers ---------------------------- */

function FeatureCard({ icon, title, text }) {
  return (
    <div
      className="
        rounded-2xl
        bg-surface
        border border-root
        shadow-elevated
        p-5
      "
    >
      <div className="flex items-center gap-3">
        <div
          className="
            inline-flex items-center justify-center
            rounded-lg bg-root border border-root
            w-9 h-9
          "
        >
          <span className="text-root-primary">{icon}</span>
        </div>
        <h4 className="font-semibold text-root-primary">{title}</h4>
      </div>
      <p className="mt-2 text-sm text-root-secondary">{text}</p>

      <div className="mt-3 h-px border-t border-root" />
    </div>
  );
}
