// client/src/lib/end-user/gymRoutes.js
// Lightweight helpers to convert between display labels and URL-safe slugs

export function toSlug(label) {
  return encodeURIComponent(
    String(label)
      .trim()
      .toLowerCase()
      .replace(/[&]/g, "and")
      .replace(/[^a-z0-9]+/g, "-") // collapse non-alphanum to hyphens
      .replace(/(^-|-$)/g, "")
  );
}

// Known special labels that need exact casing/punctuation
const SPECIALS = new Map([
  ["mind-body", "Mind–Body"],   // en-dash
  ["hiit", "HIIT"],
  ["trx", "TRX"],
  ["mma-fitness", "MMA Fitness"],
  ["bodypump", "BodyPump"],
  ["boxfit", "BoxFit"],
  ["stretch-flow", "Stretch & Flow"],
  ["self-defense", "Self-Defense"],
  ["cross-circuit", "Cross Circuit"],
  ["kettlebell", "Kettlebell"],
]);

export function slugToLabel(slug) {
  const clean = decodeURIComponent(String(slug || "")).toLowerCase();
  if (SPECIALS.has(clean)) return SPECIALS.get(clean);
  // Generic Title Case fallback
  return clean
    .split("-")
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}
