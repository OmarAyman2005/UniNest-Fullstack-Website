"use client";
import React, { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/admin/eventApi";

// wallet icon component (inline SVG)
function WalletIcon({ className = "w-6 h-6", stroke = "currentColor" }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <rect x="2" y="6" width="20" height="12" rx="2" stroke={stroke} strokeWidth="1.5" />
      <path d="M2 9h20" stroke={stroke} strokeWidth="1.2" strokeLinecap="round" />
      <circle cx="17" cy="12" r="1.2" fill={stroke} />
    </svg>
  );
}

export default function WalletPage() {
  const [userId, setUserId] = useState("");
  const [userName, setUserName] = useState("");
  const [autodetected, setAutodetected] = useState(false);
  const [wallet, setWallet] = useState(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [autoCreateTried, setAutoCreateTried] = useState(false); // avoid repeated auto-create attempts

  useEffect(() => {
    async function fetchCurrentUser() {
      try {
        const resp = await api("/auth/me");
        const data = resp?.data ?? resp;
        const user = data?.user ?? data;
        const uid = user?.id || user?._id || user?.userId;
        const name = user?.fullName || user?.name || user?.email || "";
        if (uid) {
          setUserId(uid);
          setUserName(name);
          setAutodetected(true);
          return;
        }
      } catch (e) { /* ignore */ }

      if (typeof window !== "undefined" && window.__USER_ID__) {
        setUserId(window.__USER_ID__);
        setUserName(window.__USER_NAME__ || "");
        setAutodetected(true);
      }
    }
    fetchCurrentUser();
  }, []);

  useEffect(() => {
    if (!userId) return;
    (async function fetchWallet() {
      setLoading(true);
      setMessage("");
      try {
        const resp = await api(`/wallets/${encodeURIComponent(userId)}`);
        const res = resp?.data ?? resp;
        const candidate = res?.wallet ?? res ?? null;
        setWallet(candidate);
        if (!candidate) {
          setMessage("No wallet found for this user.");
          // will attempt auto-create in separate effect
        }
      } catch (e) {
        setMessage(e?.message || "Failed to load wallet");
        setWallet(null);
      } finally {
        setLoading(false);
      }
    })();
  }, [userId]);

  // Auto-create a wallet for signed-in users if none exists (try once)
  useEffect(() => {
    if (!autodetected || !userId) return;
    if (wallet === null && !autoCreateTried) {
      setAutoCreateTried(true);
      (async () => {
        setLoading(true);
        setMessage("");
        try {
          const resp = await api(`/wallets`, { method: "POST", body: { userId } });
          const res = resp?.data ?? resp;
          if (!res?.error) {
            const created = res?.wallet ?? res ?? null;
            setWallet(created);
            setMessage("Wallet created");
            setAutoCreateTried(false); // reset so future explicit flows can retry if needed
          } else {
            // don't spam UI for silent auto create; keep message minimal
            setMessage("Unable to create wallet automatically.");
          }
        } catch (err) {
          setMessage("Automatic wallet creation failed.");
        } finally {
          setLoading(false);
        }
      })();
    }
  }, [autodetected, userId, wallet, autoCreateTried]);

  function formatAmount(amount, currency) {
    try {
      const num = Number(amount ?? 0);
      return new Intl.NumberFormat(undefined, {
        style: "currency",
        currency: (currency || "EGP").toUpperCase(),
        maximumFractionDigits: 2,
      }).format(num);
    } catch {
      return `${amount ?? 0} ${currency || "EGP"}`;
    }
  }

  return (
    <main className="max-w-4xl mx-auto p-8">
      <header className="flex items-center gap-6 mb-6">
        <div className="rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 p-4 shadow-md flex items-center justify-center">
          <WalletIcon className="w-16 h-16 text-white" stroke="#fff" />
        </div>

        <div className="flex-1">
          <h1 className="text-2xl sm:text-3xl font-semibold text-white">Wallet</h1>
          <p className="mt-1 text-sm text-slate-500">
            View your wallet balance and details.
          </p>
        </div>
      </header>

      <section className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        <div className="md:col-span-2 p-6 bg-white rounded-lg shadow-sm border">
          <h2 className="text-lg font-medium text-slate-700 mb-3">Balance</h2>

          {loading ? (
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-slate-100 animate-pulse" />
              <div className="flex-1 space-y-2">
                <div className="h-4 bg-slate-100 rounded w-1/3 animate-pulse" />
                <div className="h-3 bg-slate-100 rounded w-1/6 animate-pulse" />
              </div>
            </div>
          ) : wallet ? (
            <div className="flex items-center justify-between">
              <div>
                <div className="text-3xl font-semibold text-emerald-600">
                  {formatAmount(wallet.balance ?? 0, wallet.currency || "EGP")}
                </div>
                <div className="text-sm text-slate-500 mt-1">Available balance • {wallet.enabled ? "Active" : "Disabled"}</div>
              </div>

              <div className="text-right">
                <div className="text-sm text-slate-500">Currency</div>
                <div className="font-medium text-slate-700">{(wallet.currency || "EGP").toUpperCase()}</div>
              </div>
            </div>
          ) : (
            <div className="text-sm text-slate-500">No wallet available. Create one to start using wallet payments.</div>
          )}

        </div>

        <aside className="p-6 bg-white rounded-lg shadow-sm border">
          <h3 className="text-sm font-medium text-slate-700 mb-2">Account</h3>
          <dl className="text-sm text-slate-600">
            <div className="flex justify-between py-1"><dt className="text-slate-500">Name</dt><dd className="font-medium">{userName || "-"}</dd></div>
            <div className="flex justify-between py-1"><dt className="text-slate-500">Status</dt><dd className="font-medium">{wallet ? (wallet.enabled ? "Enabled" : "Disabled") : "No wallet"}</dd></div>
          </dl>
        </aside>
      </section>
    </main>
  );
}