// app/(end-user)/vendorApplyingBazaars/vendorApplyingBazaars.jsx
"use client";

import { useMemo, useState, useEffect } from "react";
import Link from "next/link";
import "../vendorApplyingBazaars.css";
import { useRouter } from "next/navigation";
import { applicationsService } from "@/app/services/applications.service";
import clsx from "clsx";
import { getEventById } from "@/lib/admin/eventApi";

const MAX_ATTENDEES = 5;
const BOOTH_SIZES = [
  { label: "2 × 2 m", value: "2x2", w: 2, d: 2 },
  { label: "4 × 4 m", value: "4x4", w: 4, d: 4 },
];

export default function VendorApplyingBazaars({ eventId, me }) {
  const router = useRouter();

  const [attendees, setAttendees] = useState([{ name: "", email: "" }]);
  // match ClientBoothPage: allow toggling the ID upload row per attendee
  const [idDocs, setIdDocs] = useState([{ open: false, file: null }]);
  const [boothSize, setBoothSize] = useState("2x2");
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState("");
  const [registrationDeadline, setRegistrationDeadline] = useState(null);
  const [registrationClosed, setRegistrationClosed] = useState(false);

  const canAddMore = attendees.length < MAX_ATTENDEES;

  // toggle upload row visibility for an attendee
  const toggleIdOpen = (idx) => {
    setIdDocs((prev) => {
      const cp = [...prev];
      cp[idx] = { ...cp[idx], open: !cp[idx]?.open };
      return cp;
    });
  };

  const errors = useMemo(() => {
    const e = {};
    attendees.forEach((p, idx) => {
      const row = {};
      if (!p.name.trim()) row.name = "Required";
      if (!p.email.trim()) row.email = "Required";
      else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(p.email)) row.email = "Invalid email";
      if (Object.keys(row).length) e[`attendee_${idx}`] = row;
    });
    if (!BOOTH_SIZES.some((s) => s.value === boothSize)) e.boothSize = "Please select a booth size";
    return e;
  }, [attendees, boothSize]);

  const hasErrors = Object.keys(errors).length > 0;

  const updateAttendee = (index, field, value) => {
    setAttendees((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  };

  const addAttendee = () => {
    if (!canAddMore) return;
    setAttendees((prev) => [...prev, { name: "", email: "" }]);
  };

  // keep idDocs synced with attendees
  useEffect(() => {
    setIdDocs((prev) => {
      const arr = [...prev];
      if (arr.length < attendees.length) {
        for (let i = arr.length; i < attendees.length; i++) arr.push({ open: false, file: null });
      } else if (arr.length > attendees.length) arr.length = attendees.length;
      return arr;
    });
  }, [attendees.length]);

  // load event to check registration deadline
  useEffect(() => {
    let mounted = true;
    (async () => {
      if (!eventId) return;
      try {
        const ev = await getEventById(String(eventId));
        if (!mounted) return;
        const rd = ev?.registrationDeadline ?? ev?.registrationDeadlineAt ?? null;
        setRegistrationDeadline(rd || null);
        if (rd) {
          try {
            const closed = Date.now() > new Date(rd).getTime();
            setRegistrationClosed(Boolean(closed));
          } catch {
            setRegistrationClosed(false);
          }
        } else {
          setRegistrationClosed(false);
        }
      } catch (err) {
        // silently ignore — if we can't load the event we won't block submit here
        setRegistrationDeadline(null);
        setRegistrationClosed(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [eventId]);

  const setIdFile = (idx, file) => {
    setIdDocs((prev) => {
      const cp = [...prev];
      cp[idx] = { ...(cp[idx] || {}), file };
      return cp;
    });
  };

  const removeAttendee = (index) => setAttendees((prev) => prev.filter((_, i) => i !== index));

  const onSubmit = async (e) => {
    e.preventDefault();
    setServerError("");

    if (hasErrors) {
      document.querySelector(".form-error")?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }

    const userId = me?.id || me?._id;
    if (!userId) {
      setServerError("You must be logged in to apply.");
      return;
    }

    for (let k = 0; k < attendees.length; k++) {
      if (!idDocs[k]?.file) {
        setServerError(`Please upload an ID for person #${k + 1}.`);
        return;
      }
    }

    const applicantName =
      (me?.fullName && me.fullName.trim()) ||
      ([me?.firstName, me?.lastName].filter(Boolean).join(" ").trim()) ||
      (me?.name && me.name.trim()) ||
      (me?.email && me.email.trim()) ||
      "Unknown Vendor";

    const payload = {
      userId,
      eventId: String(eventId),
      participants: attendees.map((a) => ({ name: a.name.trim(), email: a.email.trim() })),
      boothSize,
      applicantName,
    };

    setSubmitting(true);
    try {
      const created = await applicationsService.create(payload);
      const applicationId = created?.data?._id || created?._id || created?.id;
      if (applicationId) {
        for (let k = 0; k < attendees.length; k++) {
          const f = idDocs[k]?.file;
          if (!f) continue;
          const form = new FormData();
          form.set("file", f);
          await applicationsService.uploadParticipantId(applicationId, k, form).catch(() => {});
        }
      }

      // redirect to submission confirmation (same behavior as ClientBoothPage)
      router.push(`/applicationSubmittedVendor?type=bazaar&id=${encodeURIComponent(eventId)}`);
    } catch (err) {
      if (err?.status === 409) {
        setServerError(err?.data?.message || "You have already applied to this event.");
      } else {
        setServerError(err?.message || "Something went wrong. Please try again.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  const disabledReason = (() => {
    if (submitting) return "Submitting application…";
    if (registrationClosed)
      return registrationDeadline
        ? `Registration closed on ${new Date(registrationDeadline).toLocaleString()}`
        : `Registration closed.`;
    return "";
  })();

  return (
    <main className="min-h-screen bg-root px-6 py-10 text-root-secondary">
      <div className="max-w-7xl mx-auto">
        <div className="apply-head">
          <div className="apply-breadcrumbs">
                      </div>

          <div className="flex items-center justify-between gap-4">
            <h1 className="text-4xl md:text-5xl font-bold mb-1">Bazaar Application</h1>
            <Link href="/events" className="btn btn-primary text-sm" aria-label="Back to events">
              ← Back to Events
            </Link>
            
          </div>
          <p className="text-sm text-root-secondary">
            Add up to 5 workers, upload each worker’s ID (image/PDF), choose
            booth size (2×2 or 4×4).
          </p>
        </div>

        <div className="apply-card">
          <form className="apply-form" onSubmit={onSubmit} noValidate>
            <section className="fieldset">
              <div className="legend">Booth Staff (max {MAX_ATTENDEES})</div>

              {attendees.map((p, idx) => {
                const rowErr = errors[`attendee_${idx}`] || {};
                return (
                  <div key={idx} className="row attendees-row">
                    <div className="field">
                      <label htmlFor={`name_${idx}`}>Full Name</label>
                      <input
                        id={`name_${idx}`}
                        type="text"
                        value={p.name}
                        onChange={(e) => updateAttendee(idx, "name", e.target.value)}
                        placeholder="e.g., Ahmed Ali"
                      />
                      {rowErr.name && rowErr.name !== "Required" && <div className="form-error">{rowErr.name}</div>}
                    </div>

                    <div className="field">
                      <label htmlFor={`email_${idx}`}>Email</label>
                      <input
                        id={`email_${idx}`}
                        type="email"
                        inputMode="email"
                        value={p.email}
                        onChange={(e) => updateAttendee(idx, "email", e.target.value)}
                        placeholder="name@example.com"
                      />
                      {rowErr.email && rowErr.email !== "Required" && <div className="form-error">{rowErr.email}</div>}
                    </div>

                    <div className="row-actions att-actions-col">
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        onClick={() => toggleIdOpen(idx)}
                        aria-expanded={idDocs[idx]?.open ? "true" : "false"}
                        title="Upload ID for this person"
                      >
                        {idDocs[idx]?.open ? "Hide ID" : "Upload ID"}
                      </button>

                      {attendees.length > 1 && (
                        <button type="button" className="btn btn-ghost btn-sm" onClick={() => removeAttendee(idx)} aria-label={`Remove person ${idx + 1}`}>
                          Remove
                        </button>
                      )}
                    </div>

                    {idDocs[idx]?.open && (
                      <div className="id-upload-row" style={{ gridColumn: "1 / -1", marginTop: 8 }}>
                        <label className="id-label" htmlFor={`id_${idx}`}>
                          ID File (PNG/JPG/PDF)
                        </label>
                        <input
                          id={`id_${idx}`}
                          type="file"
                          accept=".png,.jpg,.jpeg,.pdf"
                          className="input-surface"
                          onChange={(e) => setIdFile(idx, e.target.files?.[0] || null)}
                        />
                        {idDocs[idx]?.file && (
                          <div className="id-file-name">
                            Selected:&nbsp;<span>{idDocs[idx].file.name}</span>
                          </div>
                        )}
                        <p className="id-hint">
                          Required: every person must have an ID uploaded to submit the application.
                        </p>
                      </div>
                    )}
                  </div>
                );
              })}

              <div className="row">
                <button type="button" className="btn btn-ghost" style={{ justifySelf: "start" }} onClick={addAttendee} disabled={!canAddMore}>
                   Add person
                </button>
              </div>
            </section>

            {/* Booth size */}
            <div className="form-field">
              <label>Booth Size</label>
              <div className="size-row" role="group" aria-label="Booth size">
                {BOOTH_SIZES.map((s) => {
                  const active = boothSize === s.value;
                  return (
                    <button
                      key={s.value}
                      type="button"
                      className={clsx("size-chip", active && "active")}
                      onClick={() => setBoothSize(s.value)}
                      aria-pressed={active}
                      style={{ padding: "0 14px", height: 40, borderRadius: 999, cursor: "pointer" }}
                    >
                      {s.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {serverError && <div className="server-error" role="alert">{serverError}</div>}

            <div className="form-actions">
              <Link className="btn btn-ghost" href="/events">Cancel</Link>
              <div
                className="flex flex-col items-end gap-2"
                title={disabledReason || undefined}
                aria-hidden={Boolean(disabledReason) ? "false" : "true"}
              >
                <button
                  className="btn btn-primary"
                  type="submit"
                  disabled={submitting || registrationClosed}
                  aria-busy={submitting}
                  aria-disabled={submitting || registrationClosed}
                >
                  {submitting ? "Submitting..." : "Submit Application"}
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </main>
  );
}
