"use client";

import React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { GYM_CATEGORIES, GYM_TYPES, TYPE_EMOJI } from "@/lib/end-user/gymTaxonomy";
import { toSlug } from "@/lib/end-user/gymRoutes";

export default function GymTypesPage({ params }) {
  const { category: catSlug } = params;
  const router = useRouter();

  const catMap = React.useMemo(
    () => Object.fromEntries(GYM_CATEGORIES.map((c) => [toSlug(c), c])),
    []
  );
  const category = catMap[catSlug];

  React.useEffect(() => {
    if (!category) router.replace("/gym");
  }, [category, router]);

  const types = (GYM_TYPES[category] || []).map((t) => ({
    name: t,
    slug: toSlug(t),
    emoji: TYPE_EMOJI[t] || "🏋️",
  }));

  // emoji to show beside category (like page 3)
  const categoryEmoji =
    (category && TYPE_EMOJI[types?.[0]?.name]) || "🧘"; // safe fallback

  return (
    // Center the whole card vertically & horizontally, similar to categories page
    <div className="min-h-[70vh] flex items-center justify-center py-8">
      <div className="mx-auto w-full max-w-5xl px-4">
        {/* sports-like card */}
        <section className="rounded-2xl bg-neutral-900 ring-2 ring-neutral-800 shadow-[0_20px_40px_rgba(0,0,0,.45)] px-6 sm:px-8 py-8 md:py-10 space-y-6">
          {/* Header aligned like page 3 */}
          <div className="text-center space-y-1">
            <div className="text-sm text-gray-300">{category}</div>
            <h1 className="text-2xl md:text-3xl font-semibold text-white flex items-center justify-center gap-2">
              <span aria-hidden className="text-xl">{categoryEmoji}</span>
              Session Types
            </h1>

            {/* Back just below the title (matches page 3 positioning) */}
            <div className="flex justify-center mt-3">
              <Link
                href="/gym"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-full ring-1 ring-neutral-700 bg-neutral-800 text-gray-200 hover:ring-neutral-500 hover:text-white transition"
              >
                ← Back to Categories
              </Link>
            </div>
          </div>

          {/* Type list */}
          <div className="max-w-3xl mx-auto space-y-4">
            {types.map(({ name, slug, emoji }) => (
              <Link
                key={slug}
                href={`/gym/${encodeURIComponent(catSlug)}/${encodeURIComponent(slug)}`}
                className={[
                  "group flex items-center justify-between gap-3 rounded-full px-5 py-4",
                  // MATCH category card look: bg, ring, gradient, shadow, hover
                  "bg-neutral-950 ring-2 ring-neutral-700",
                  "bg-gradient-to-b from-neutral-950 to-neutral-900",
                  "shadow-[inset_0_1px_0_rgba(255,255,255,.06),0_14px_30px_rgba(0,0,0,.55)]",
                  "transition-all duration-150 hover:ring-neutral-500 hover:-translate-y-0.5",
                ].join(" ")}
              >
                <div className="flex items-center gap-3">
                  {/* Icon circle styled like category card */}
                  <span
                    className="inline-flex items-center justify-center w-9 h-9 rounded-full ring-1 ring-neutral-700 bg-neutral-800/70 text-lg"
                    aria-hidden
                  >
                    {emoji}
                  </span>
                  <span className="text-white font-medium tracking-tight">{name}</span>
                </div>

                {/* Keep same blue “View timings” chip */}
                <span className="text-[11px] px-2 py-1 rounded-full ring-1 ring-blue-500/40 bg-blue-500/15 text-blue-200">
                  View timings →
                </span>
              </Link>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
