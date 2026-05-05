"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { get } from "@/lib/api";
import { CATEGORY_EMOJI } from "@/lib/end-user/gymTaxonomy";
import { toSlug } from "@/lib/end-user/gymRoutes";

export default function GymCategoriesPage() {
  const ORDERED = ["Mind–Body", "Dance", "Cardio", "Strength", "Combat", "Mobility"];

  const router = useRouter();
  const [allowed, setAllowed] = useState(null); // null = checking, true = allowed, false = denied

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const json = await get("/auth/me");
        const role = json?.user?.role ?? json?.role ?? null;
        if (!mounted) return;
        if (role === "admin" || role === "eventOffice") {
          setAllowed(false);
          router.replace("/404");
        } else {
          setAllowed(true);
        }
      } catch (e) {
        if (!mounted) return;
        // On error, redirect to 404
        setAllowed(false);
        router.replace("/404");
      }
    })();

    return () => {
      mounted = false;
    };
  }, [router]);

  if (allowed === null) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center py-8">
        <div className="mx-auto w-full max-w-5xl px-4 text-center text-gray-300">Checking access...</div>
      </div>
    );
  }

  if (!allowed) return null;

  return (
    // Full-height flex wrapper to center the card block
    <div className="min-h-[70vh] flex items-center justify-center py-8">
      <div className="mx-auto w-full max-w-5xl px-4">
        {/* Outer card – same recipe used on /sports, but now fills more of the page */}
        <section className="rounded-2xl bg-neutral-900 ring-2 ring-neutral-800 shadow-[0_20px_40px_rgba(0,0,0,.45)] px-6 sm:px-8 py-8 md:py-10">
          <h1 className="text-center text-3xl md:text-4xl font-semibold text-white mb-6">
            Gym Sessions Reservation
          </h1>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {ORDERED.map((c) => (
              <CategoryCard key={c} name={c} />
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

function CategoryCard({ name }) {
  const emoji = CATEGORY_EMOJI[name] || "🏋️";
  const slug = toSlug(name);

  return (
    <Link
      href={`/gym/${encodeURIComponent(slug)}`}
      className={[
        "group block rounded-2xl px-5 py-5",
        // 3D: thicker ring + subtle top highlight + soft drop
        "bg-neutral-950 ring-2 ring-neutral-700",
        "bg-gradient-to-b from-neutral-950 to-neutral-900",
        "shadow-[inset_0_1px_0_rgba(255,255,255,.06),0_14px_30px_rgba(0,0,0,.55)]",
        "transition-all duration-150 hover:ring-neutral-500 hover:-translate-y-0.5",
      ].join(" ")}
    >
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span
            className="inline-flex items-center justify-center w-9 h-9 rounded-full ring-1 ring-neutral-700 bg-neutral-800/70 text-lg"
            aria-hidden
          >
            {emoji}
          </span>
          <span className="text-white font-medium tracking-tight">{name}</span>
        </div>

        {/* compact chevron chip (replaces plain arrow) */}
        <span className="inline-flex items-center text-xs font-semibold px-2 py-0.5 rounded-full ring-1 ring-neutral-700 bg-neutral-800/60 text-gray-200 transition group-hover:ring-neutral-500">
          ▸
        </span>
      </div>
    </Link>
  );
}
