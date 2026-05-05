"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { api } from "@/lib/api";
import { X, ShieldCheck } from "lucide-react";

export default function WelcomeSignIn() {
  const router = useRouter();
  const search = useSearchParams();

  const [form, setForm] = useState({ email: "", password: "" });
  const [user, setUser] = useState(null);
  const [busy, setBusy] = useState(false);
  const [banner, setBanner] = useState({ text: "", tone: "info" }); // success | error | info

  // show green banner if redirected with ?loggedout=1
  const justLoggedOut = useMemo(() => search.get("loggedout") === "1", [search]);
  useEffect(() => {
    if (justLoggedOut) {
      setBanner({ text: "You’ve been logged out successfully.", tone: "success" });
      const url = new URL(window.location.href);
      url.searchParams.delete("loggedout");
      window.history.replaceState({}, "", url.toString());
    }
  }, [justLoggedOut]);

  const safeNavigate = (target) => {
    router.replace(target);
    setTimeout(() => {
      if (typeof window !== "undefined" && window.location.pathname !== target) {
        window.location.assign(target);
      }
    }, 80);
  };

  const doLogin = async (e) => {
    e.preventDefault();
    setBanner({ text: "", tone: "info" });
    setBusy(true);
    try {
      const res = await api("/auth/login", { method: "POST", body: form });
      const role = res?.user?.role;
      setUser(res.user || null);

      const target = (role === "admin" || role === "event_office") ? "/admin" : "/home";
      safeNavigate(target);
    } catch (e) {
      setBanner({ text: e.message || "Login failed", tone: "error" });
    } finally {
      setBusy(false);
    }
  };

  const Banner = ({ text, tone }) => {
    if (!text) return null;
    const styles =
      tone === "success"
        ? "bg-green-600/20 border-green-500/40 text-green-50"
        : tone === "error"
        ? "bg-red-600/20 border-red-500/40 text-red-100"
        : "bg-black/30 border-white/10 text-secondary";

    return (
      <div className={`rounded-xl border px-3 py-2 text-sm flex items-start justify-between ${styles} text-root-primary`}>
        <span className="pr-3">{text}</span>
        <button
          aria-label="Dismiss"
          className="opacity-80 hover:opacity-100"
          onClick={() => setBanner({ text: "", tone: "info" })}
        >
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

            {user && (
              <div className="mb-4 rounded-xl border border-green-500/30 bg-green-600/15 text-green-50 px-4 py-3">
                <div className="flex items-center gap-3">
                  <span className="inline-flex items-center justify-center rounded-lg bg-green-600/25 w-9 h-9">
                    <ShieldCheck className="w-5 h-5" />
                  </span>
                  <div className="leading-tight">
                    <p className="text-root-secondary font-semibold">
                      Welcome, <span className="font-bold">{user.fullName}</span>
                    </p>
                    <p className="text-xs opacity-80">Signed in as {user.role}</p>
                  </div>
                </div>
              </div>
            )}

            <form onSubmit={doLogin} className="space-y-4">
              <div>
                <label className="text-sm block mb-1 text-root-secondary">Email</label>
                <input
                  type="email"
                  required
                  autoFocus
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  className="w-full rounded-lg input-surface px-3 py-2 outline-none"
                  placeholder=""
                />
              </div>
              <div>
                <label className="text-sm block mb-1 text-root-secondary">Password</label>
                <input
                  type="password"
                  required
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  className="w-full rounded-lg input-surface px-3 py-2 outline-none"
                  placeholder=""
                />
              </div>

              <button
                type="submit"
                disabled={busy}
                className="w-full rounded-2xl bg-primary text-root-primary py-2.5 disabled:opacity-60"
              >
                {busy ? "Signing in…" : "Sign in"}
              </button>
            </form>

            <p className="mt-4 text-sm text-center text-root-secondary">
              Don’t have an account?{" "}
              <Link href="/welcome/register" className="underline text-root-primary">
                Sign Up
              </Link>
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}