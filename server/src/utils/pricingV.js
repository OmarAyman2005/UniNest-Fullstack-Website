// server/src/utils/pricingV.js

/**
 * TEST/DEV "manipulative" pricing:
 *  - For BOOTH applications: price is derived from the booth number.
 *    Example: "B09" -> 9, "1" -> 1, "A12" -> 12.
 *    We multiply by 100 to convert to Stripe minor units (cents/piasters).
 *
 *  - For BAZAAR applications: keep the original configurable logic with
 *    sensible fallbacks, still in minor units.
 *
 * Notes:
 *  - Currency must be lowercase for Stripe, so we normalize to "egp".
 *  - If you’d like USD for testing, change FALLBACK.currency = "usd".
 */

/* ------------------------- Optional per-event config shape ------------------ *
 * event.pricing = {
 *   currency: "egp",
 *   booth: { perWeekByLocation: { A: 250000, B: 200000, C: 150000 } },
 *   bazaar: {
 *     baseByLocation: { A: 150000, B: 120000, C: 100000 },
 *     sizeAdd: { "2x2": 0, "4x4": 80000 }
 *   }
 * }
 * --------------------------------------------------------------------------- */

// Fallbacks if the Event doc has no pricing.
// Amounts are in MINOR UNITS (e.g., 150000 = 1,500.00 EGP).
const FALLBACK = {
  currency: "egp",
  booth: {
    perWeekByLocation: { A: 250000, B: 200000, C: 150000 },
  },
  bazaar: {
    baseByLocation: { A: 150000, B: 120000, C: 100000 },
    sizeAdd: { "2x2": 0, "4x4": 80000 },
  },
};

/**
 * Compute price for an EventApplication + Event.
 * Returns: { amount, currency, kind, breakdown }
 */
export function resolveApplicationPrice(app, event) {
  // Normalize currency to lowercase for Stripe
  const currencyRaw = event?.pricing?.currency || FALLBACK.currency;
  const currency = String(currencyRaw).toLowerCase();

  // Determine if this is a BOOTH app (has boothNumber or duration)
  const isBooth = Boolean(app.boothNumber || app.setupDurationWeeks);

  if (isBooth) {
    // ====== BOOTH PRICING (manipulative): amount = boothNumber (numeric) * 100 ======
    // Extract first number sequence from boothNumber, e.g. "B09" -> "09" -> 9.
    const rawMatch = String(app.boothNumber || "").match(/\d+/);
    const raw = rawMatch?.[0] ?? "";
    let boothNumeric = raw ? parseInt(raw, 10) : 0;

    // If parsing failed but boothNumber is a plain number/string, fall back
    if (!boothNumeric && app.boothNumber != null) {
      const direct = Number(app.boothNumber);
      if (Number.isFinite(direct) && direct > 0) {
        boothNumeric = direct;
      }
    }

    // Ensure at least 1 so we never end up with 0 amount
    const safeBoothNumeric = Math.max(boothNumeric, 1);

   // 1 EGP = 100 minor units.
    // Enforce a minimum of 20 EGP => 2000 minor units.
    const STRIPE_MIN_EGP_MINOR = 5000;

    let amount = safeBoothNumeric * 100;
    amount = Math.max(amount, STRIPE_MIN_EGP_MINOR);


    return {
      amount,
      currency,
      kind: "booth",
      breakdown: {
        boothNumber: app.boothNumber ?? null,
        boothNumeric: safeBoothNumeric,
        note: "Booth price = booth number * 100 (minor units)",
      },
    };
  }

  // ====== BAZAAR PRICING (as before, with a safety floor) ======
  const cfg = event?.pricing || FALLBACK;
  const baseMap = cfg.bazaar?.baseByLocation || FALLBACK.bazaar.baseByLocation;
  const addMap = cfg.bazaar?.sizeAdd || FALLBACK.bazaar.sizeAdd;

  const base = baseMap?.[app.setupLocation] ?? 0;
  const add = addMap?.[app.boothSize] ?? 0;
  let amount = base + add;

  // Safety floor: never allow 0 -> at least 1.00 in currency
  if (!Number.isFinite(amount) || amount <= 0) {
    amount = 100;
  }

  return {
    amount,
    currency,
    kind: "bazaar",
    breakdown: {
      base,
      add,
      location: app.setupLocation || null,
      boothSize: app.boothSize || null,
      note: "Bazaar price = baseByLocation + sizeAdd (with 100 minor-unit safety floor)",
    },
  };
}
