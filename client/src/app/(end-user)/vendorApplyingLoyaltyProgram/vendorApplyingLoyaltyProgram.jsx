"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import "./vendorApplyingLoyaltyProgram.css";
import { useRouter } from "next/navigation";
import { applicationsService } from "@/app/services/applications.service";

export default function VendorApplyingLoyaltyProgram({ me, eventId }) {
  const router = useRouter();

  const [discountRate, setDiscountRate] = useState("");
  const [promoCode, setPromoCode] = useState("");
  const [terms, setTerms] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const errors = useMemo(() => {
    const e = {};
    const rateNum = Number(discountRate);
    if (discountRate === "") e.discountRate = "Discount rate is required";
    else if (Number.isNaN(rateNum)) e.discountRate = "Must be a number";
    else if (rateNum < 0 || rateNum > 100)
      e.discountRate = "Must be between 0 and 100";

    if (!promoCode.trim()) e.promoCode = "Promo code is required";
    if (!terms.trim()) e.terms = "Terms & Conditions are required";

    return e;
  }, [discountRate, promoCode, terms]);

  const hasErrors = Object.keys(errors).length > 0;

  const onSubmit = async (e) => {
    e.preventDefault();
    setServerError("");

    if (hasErrors) {
      document
        .querySelector(".form-error")
        ?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }

    const userId = me?._id || me?.id;
    if (!userId) {
      setServerError("You must be logged in to proceed.");
      return;
    }

    try {
      setSubmitting(true);

      // Uppercase promoCode for consistency
      const promo = promoCode.trim().toUpperCase();

      await applicationsService.createLoyalty({
        userId,
        eventId: eventId || undefined,
        discountRate,
        promoCode: promo,
        terms,
        participants: [], // not used for loyalty, but API allows it
      });

      setSubmitted(true);
      // Optional redirect:
      // router.push(`/applicationSubmittedVendor?type=loyalty${eventId ? `&id=${encodeURIComponent(eventId)}` : ""}`);
    } catch (err) {
      const msg =
        err?.message ||
        err?.response?.data?.message ||
        "Something went wrong while submitting. Please try again.";
      setServerError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="min-h-[calc(100vh-80px)] bg-root text-root-primary flex items-center justify-center px-4 py-10">
      <form
        className="w-full max-w-xl bg-surface border border-root rounded-2xl shadow-elevated p-6 md:p-8 space-y-6"
        onSubmit={onSubmit}
        noValidate
      >
        <header className="space-y-1">
          <h1 className="text-2xl md:text-3xl font-semibold">
            Create Loyalty Program
          </h1>
          {/* Event ID display removed */}
        </header>

        {submitted ? (
          <div
            className="server-success rounded-xl border border-emerald-400/40 bg-emerald-500/15 px-4 py-3 text-sm text-emerald-100 flex items-center gap-2"
            role="status"
          >
            <span className="text-lg">🎉</span>
            <span>Loyalty Program application submitted successfully.</span>
          </div>
        ) : (
          <>
            {/* Program Details */}
            <section className="fieldset rounded-2xl bg-highlight border border-root px-4 py-4 md:px-5 md:py-5 space-y-4">
              <div className="legend text-xs font-semibold uppercase tracking-wide text-root-secondary mb-1">
                Program Details
              </div>

              {/* Discount + Promo code */}
              <div className="row grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="field flex flex-col gap-1">
                  <label
                    htmlFor="discountRate"
                    className="text-xs uppercase tracking-wide text-root-secondary"
                  >
                    Discount Rate (%)
                  </label>
                  <input
                    id="discountRate"
                    type="number"
                    inputMode="decimal"
                    step="0.01"
                    min="0"
                    max="100"
                    placeholder="e.g., 10"
                    value={discountRate}
                    onChange={(e) => setDiscountRate(e.target.value)}
                    aria-invalid={!!errors.discountRate}
                    className="input-surface px-3 py-2 rounded-xl text-sm focus:outline-none focus:ring-0"
                  />
                  {errors.discountRate && (
                    <div className="form-error text-xs text-red-300 mt-1">
                      {errors.discountRate}
                    </div>
                  )}
                </div>

                <div className="field flex flex-col gap-1">
                  <label
                    htmlFor="promoCode"
                    className="text-xs uppercase tracking-wide text-root-secondary"
                  >
                    Promo Code
                  </label>
                  <input
                    id="promoCode"
                    type="text"
                    placeholder="e.g., ACL10OFF"
                    value={promoCode}
                    onChange={(e) => setPromoCode(e.target.value)}
                    aria-invalid={!!errors.promoCode}
                    className="input-surface px-3 py-2 rounded-xl text-sm focus:outline-none focus:ring-0"
                  />
                  {errors.promoCode && (
                    <div className="form-error text-xs text-red-300 mt-1">
                      {errors.promoCode}
                    </div>
                  )}
                </div>
              </div>

              {/* Terms */}
              <div className="row">
                <div className="field flex flex-col gap-1 w-full">
                  <label
                    htmlFor="terms"
                    className="text-xs uppercase tracking-wide text-root-secondary"
                  >
                    Terms &amp; Conditions
                  </label>
                  <textarea
                    id="terms"
                    placeholder="Describe the terms and conditions for using this loyalty program…"
                    rows={6}
                    value={terms}
                    onChange={(e) => setTerms(e.target.value)}
                    aria-invalid={!!errors.terms}
                    style={{ resize: "vertical" }}
                    className="input-surface px-3 py-2 rounded-xl text-sm leading-relaxed focus:outline-none focus:ring-0"
                  />
                  {errors.terms && (
                    <div className="form-error text-xs text-red-300 mt-1">
                      {errors.terms}
                    </div>
                  )}
                </div>
              </div>
            </section>

            {serverError && (
              <div
                className="server-error rounded-xl border border-red-400/40 bg-red-600/25 px-4 py-3 text-sm text-red-50"
                role="alert"
              >
                {serverError}
              </div>
            )}

            {/* Actions */}
            <div className="form-actions flex items-center justify-end gap-3 pt-2">
              <Link
                className="btn ghost px-4 py-2 rounded-2xl border border-root text-sm text-root-secondary hover:bg-white/5 transition"
                href="/programs"
              >
                Cancel
              </Link>
              <button
                className="btn px-4 py-2 rounded-2xl bg-primary text-root-primary text-sm font-semibold hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition"
                type="submit"
                disabled={submitting || hasErrors}
                aria-busy={submitting}
              >
                {submitting ? "Submitting..." : "Submit"}
              </button>
            </div>
          </>
        )}
      </form>
    </main>
  );
}
