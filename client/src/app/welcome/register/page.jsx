"use client";

import { useMemo, useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { api } from "@/lib/api";
import { X } from "lucide-react";

/* ---------- logic ---------- */
const REGISTER_ROLES = ["student", "staff", "ta", "professor", "vendor"];
const ROLE_LABELS = { student: "Student", staff: "Staff", ta: "TA", professor: "Professor", vendor: "Vendor" };
const ID_PATTERN = "^\\d{2}-\\d{4}$" || "^\\d{2}-\\d{5}$";
const isGucEmail = (email) => /^[^@\s]+@([\w.-]+\.)?guc\.edu\.eg$/i.test(String(email || ""));

export default function WelcomeRegister() {
  const [form, setForm] = useState({
    role: "student",
    firstName: "",
    lastName: "",
    companyName: "",
    email: "",
    password: "",
    studentId: "",
    staffId: "",
  });

  const [busy, setBusy] = useState(false);

  const [banner, setBanner] = useState({ text: "", tone: "info" });
  useEffect(() => {
    if (!banner.text) return;
    const t = setTimeout(() => setBanner({ text: "", tone: "info" }), 5000);
    return () => clearTimeout(t);
  }, [banner.text]);

  const isVendor = useMemo(() => form.role === "vendor", [form.role]);
  const needsStaffId = useMemo(() => ["staff", "ta", "professor"].includes(form.role), [form.role]);
  const needsStudentId = useMemo(() => form.role === "student", [form.role]);

  const showMsg = (text, tone = "error") => setBanner({ text, tone });

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);

    const fullName = isVendor
      ? String(form.companyName || "").trim()
      : `${form.firstName} ${form.lastName}`.replace(/\s+/g, " ").trim();

    if (!isVendor && !isGucEmail(form.email)) {
      showMsg("Use your @guc.edu.eg (or GUC subdomain) email.");
      setBusy(false);
      return;
    }
    if (needsStudentId && !new RegExp(ID_PATTERN).test(form.studentId)) {
      showMsg("Student ID must match format xx-xxxx (digits only).");
      setBusy(false);
      return;
    }
    if (needsStaffId && !new RegExp(ID_PATTERN).test(form.staffId)) {
      showMsg("Staff ID must match format xx-xxxx (digits only).");
      setBusy(false);
      return;
    }

    try {
      const body = {
        fullName,
        email: String(form.email || "").trim().toLowerCase(),
        password: form.password,
        role: form.role,
      };
      if (needsStudentId) body.studentId = form.studentId;
      if (needsStaffId) body.staffId = form.staffId;

      const res = await api("/auth/register", { method: "POST", body });

      showMsg(
        res.needsApproval
          ? "Registered. Awaiting admin approval."
          : res.needsVerification
          ? "Registered. Check your email to verify your account."
          : "Registered. You can now log in.",
        "success"
      );

      setForm((f) => ({
        role: f.role,
        firstName: "",
        lastName: "",
        companyName: "",
        email: "",
        password: "",
        studentId: "",
        staffId: "",
      }));
    } catch (err) {
      showMsg(err.message || "Registration failed", "error");
    } finally {
      setBusy(false);
    }
  };

  /* ---------- shared banner component (same style as welcome/login) ---------- */
  const Banner = ({ text, tone }) => {
    if (!text) return null;
    const base = "rounded-xl border px-3 py-2 text-sm flex items-start justify-between";
    if (tone === "success") {
      return (
        <div className={`${base} bg-success border-root text-root-primary`}>
          <span className="pr-3">{text}</span>
          <button aria-label="Dismiss" className="opacity-80 hover:opacity-100" onClick={() => setBanner({ text: "", tone: "info" })}>
            <X className="w-4 h-4" />
          </button>
        </div>
      );
    }
    if (tone === "error") {
      return (
        <div className={`${base} bg-error border-root text-root-primary`}>
          <span className="pr-3">{text}</span>
          <button aria-label="Dismiss" className="opacity-80 hover:opacity-100" onClick={() => setBanner({ text: "", tone: "info" })}>
            <X className="w-4 h-4" />
          </button>
        </div>
      );
    }
    return (
      <div className={`${base} border-root text-root-secondary`}>
        <span className="pr-3">{text}</span>
        <button aria-label="Dismiss" className="opacity-80 hover:opacity-100" onClick={() => setBanner({ text: "", tone: "info" })}>
          <X className="w-4 h-4" />
        </button>
      </div>
    );
  };

  return (
    <main className="min-h-screen grid md:grid-cols-[380px_1fr] bg-root text-root-primary">
      <aside className="hidden md:flex items-center justify-center bg-surface text-root-primary p-10">
        <Image
          src="/logo.png"
          alt="UniNest"
          width={280}
          height={220}
          priority
          className="object-contain"
        />
      </aside>

      <section className="flex items-center justify-center p-6">
        <div className="w-full max-w-lg">
          <div className="md:hidden mb-8 flex items-center justify-center">
            <div className="relative w-24 h-24">
              <Image src="/logo.png" alt="UniNest" fill className="object-contain" />
            </div>
          </div>

          <div className="rounded-2xl bg-highlight text-root-primary p-6 shadow-elevated">
            <div className="mb-4">
              <Banner text={banner.text} tone={banner.tone} />
            </div>

            <h1 className="text-xl font-semibold mb-4">Create account</h1>

            <form onSubmit={submit} className="space-y-4">
              {/* Account type */}
              <label className="block text-sm opacity-90">
                Account type
                <select
                  className="mt-1 w-full px-4 py-2 rounded input-surface"
                  value={form.role}
                  onChange={(e) => setForm({ ...form, role: e.target.value })}
                >
                  {REGISTER_ROLES.map((r) => (
                    <option key={r} value={r}>
                      {ROLE_LABELS[r]}
                    </option>
                  ))}
                </select>
              </label>

              {/* Name or Company */}
              {!isVendor ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <input
                    className="w-full px-4 py-2 rounded input-surface"
                    placeholder="First name"
                    value={form.firstName}
                    onChange={(e) => setForm({ ...form, firstName: e.target.value })}
                    required
                  />
                  <input
                    className="w-full px-4 py-2 rounded input-surface"
                    placeholder="Last name"
                    value={form.lastName}
                    onChange={(e) => setForm({ ...form, lastName: e.target.value })}
                    required
                  />
                </div>
              ) : (
                <input
                  className="w-full px-4 py-2 rounded input-surface"
                  placeholder="Company name"
                  value={form.companyName}
                  onChange={(e) => setForm({ ...form, companyName: e.target.value })}
                  required
                />
              )}

              {/* IDs */}
              {needsStudentId && (
                <input
                  className="w-full px-4 py-2 rounded input-surface"
                  placeholder="Student ID (e.g., 12-3456)"
                  value={form.studentId}
                  onChange={(e) => setForm({ ...form, studentId: e.target.value })}
                  pattern={ID_PATTERN}
                  title="Use the format xx-xxxx (digits only)."
                  required
                />
              )}

              {needsStaffId && (
                <input
                  className="w-full px-4 py-2 rounded input-surface"
                  placeholder="Staff ID (e.g., 12-3456)"
                  value={form.staffId}
                  onChange={(e) => setForm({ ...form, staffId: e.target.value })}
                  pattern={ID_PATTERN}
                  title="Use the format xx-xxxx (digits only)."
                  required
                />
              )}

              {/* Email */}
              <div>
                <input
                  className="w-full px-4 py-2 rounded input-surface"
                  placeholder={isVendor ? "Company email" : "University email"}
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  pattern={isVendor ? undefined : "^[^@\\s]+@([\\w.-]+\\.)?guc\\.edu\\.eg$"}
                  title={isVendor ? "Any company email is allowed" : "Use your GUC email"}
                  required
                />
                {!isVendor && (
                  <p className="mt-1 text-xs opacity-70">
                    Use your <b>@guc.edu.eg</b> (or a GUC subdomain like <code>student.guc.edu.eg</code>) email.
                  </p>
                )}
              </div>

              {/* Password */}
              <input
                className="w-full px-4 py-2 rounded input-surface"
                placeholder="Password"
                type="password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                minLength={6}
                required
              />

              <button
                disabled={busy}
                className="w-full py-2.5 rounded-2xl bg-primary text-root-primary disabled:opacity-60"
              >
                {busy ? "Creating..." : "Register"}
              </button>

              {!isVendor ? (
                <p className="text-xs opacity-70">
                  Staff / TA / Professor require admin approval and email verification.
                </p>
              ) : (
                <p className="text-xs opacity-70">Vendors can register with any company email.</p>
              )}
            </form>

            <p className="mt-6 text-sm text-center opacity-80">
              Already have an account?{" "}
              <Link href="/welcome" className="underline">
                Login
              </Link>
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
