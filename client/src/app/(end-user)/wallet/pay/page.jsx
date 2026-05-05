"use client";
import React, { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/admin/eventApi";

// re-use same wallet icon as main wallet view
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

export default function WalletPayPage() {
  const [userId, setUserId] = useState("");
  const [userName, setUserName] = useState("");
  const [wallet, setWallet] = useState(null);
  const [eventId, setEventId] = useState("");
  const [eventName, setEventName] = useState("");
  const [amount, setAmount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [autoCreateTried, setAutoCreateTried] = useState(false);

  const searchParams = useSearchParams();

  useEffect(() => {
    async function loadUser() {
      try {
        const resp = await api("/auth/me");
        const data = resp?.data ?? resp;
        const user = data?.user ?? data;
        const uid = user?.id || user?._id || user?.userId;
        const name = user?.fullName || user?.name || user?.email || "";
        if (uid) {
          setUserId(uid);
          setUserName(name);
          return;
        }
      } catch (err) {
        /* ignore */
      }
      if (typeof window !== "undefined" && window.__USER_ID__) {
        setUserId(window.__USER_ID__);
        setUserName(window.__USER_NAME__ || "");
      }
    }
    loadUser();
  }, []);

  // populate event info from query params (eventId, eventName, amount)
  useEffect(() => {
    if (!searchParams) return;
    const qEventId = searchParams.get("eventId") || "";
    const qEventName = searchParams.get("eventName") || "";
    const qAmount = searchParams.get("amount");
    setEventId(qEventId);
    setEventName(qEventName);
    if (qAmount !== null) {
      const n = Number(qAmount);
      if (!Number.isNaN(n)) setAmount(n);
    }
  }, [searchParams]);

  // fetch wallet for user
  useEffect(() => {
    if (!userId) return;
    (async () => {
      setLoading(true);
      setMessage("");
      try {
        const resp = await api(`/wallets/${encodeURIComponent(userId)}`);
        const res = resp?.data ?? resp;
        const found = res?.wallet ?? res ?? null;
        setWallet(found);
        if (!found) setMessage("No wallet found — will attempt to create one automatically.");
      } catch (err) {
        setMessage(err?.message || "Failed to load wallet");
        setWallet(null);
      } finally {
        setLoading(false);
      }
    })();
  }, [userId]);

  // Auto-create wallet once for signed-in users if none exists
  useEffect(() => {
    if (!userId || wallet !== null || autoCreateTried) return;
    setAutoCreateTried(true);
    (async () => {
      setLoading(true);
      try {
        const resp = await api("/wallets", { method: "POST", body: { userId } });
        const res = resp?.data ?? resp;
        if (!res?.error) {
          const created = res?.wallet ?? res ?? null;
          setWallet(created);
          setMessage("Wallet created successfully.");
        } else {
          setMessage("Unable to create wallet automatically.");
        }
      } catch (err) {
        setMessage("Automatic wallet creation failed.");
      } finally {
        setLoading(false);
      }
    })();
  }, [userId, wallet, autoCreateTried]);

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

  const projectedBalance = (() => {
    try {
      const bal = Number(wallet?.balance ?? 0);
      const amt = Number(amount ?? 0);
      if (Number.isNaN(bal) || Number.isNaN(amt)) return null;
      return bal - amt;
    } catch {
      return null;
    }
  })();

  async function handlePay() {
    if (!userId || !eventId) {
      setMessage("Please provide an event ID.");
      return;
    }
    setLoading(true);
    setMessage("");
    try {
      // ensure wallet exists before paying
      if (!wallet) {
        const ensureResp = await api("/wallets", { method: "POST", body: { userId } });
        const ensureRes = ensureResp?.data ?? ensureResp;
        if (ensureRes?.error) {
          setMessage(ensureRes.error || "Unable to prepare wallet for payment.");
          setLoading(false);
          return;
        }
        setWallet(ensureRes?.wallet ?? ensureRes ?? null);
      }

      // check sufficient funds if amount known
      if (amount && wallet && typeof wallet.balance !== "undefined") {
        const bal = Number(wallet.balance ?? 0);
        const amt = Number(amount ?? 0);
        if (!Number.isNaN(bal) && !Number.isNaN(amt) && bal < amt) {
          setMessage("Insufficient wallet balance for this payment.");
          setLoading(false);
          return;
        }
      }

      const resp = await api("/payments/wallet", { method: "POST", body: { userId, eventId, amount } });
      const res = resp?.data ?? resp;
      if (res?.error) {
        setMessage(res.error || "Payment failed.");
      } else {
        setMessage("Payment successful. Your wallet has been debited.");
        // refresh wallet state
        const r = await api(`/wallets/${encodeURIComponent(userId)}`);
        const rr = r?.data ?? r;
        setWallet(rr?.wallet ?? rr ?? null);
      }
    } catch (err) {
      setMessage(err?.message || "Network error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="max-w-3xl mx-auto p-8">
      <header className="flex items-center gap-6 mb-6">
        <div className="rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 p-4 shadow-md flex items-center justify-center">
          <WalletIcon className="w-12 h-12 text-white" stroke="#fff" />
        </div>

        <div className="flex-1">
          <h1 className="text-2xl sm:text-3xl font-semibold text-white">Pay for Event</h1>
          <p className="mt-1 text-sm text-slate-500">Use your wallet balance to register for an event quickly.</p>
        </div>
      </header>

      <section className="p-6 bg-white rounded-lg shadow-sm border mb-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
          <div className="md:col-span-2">
            <label className="text-sm text-slate-600">User</label>
            <div className="mt-1 text-sm text-slate-800">{userName || userId || "-"}</div>
          </div>

          <div className="text-right">
            <label className="text-sm text-slate-600">Balance</label>
            <div className="mt-1 font-medium text-emerald-600">
              {wallet ? formatAmount(wallet.balance ?? 0, wallet.currency) : "—"}
            </div>
            <div className="text-xs text-slate-400">{wallet ? (wallet.enabled ? "Active" : "Disabled") : ""}</div>
          </div>
        </div>
        {/* user-visible messages (errors/status) */}
        {message ? (
          <div className="mt-4 p-3 rounded bg-yellow-50 border border-yellow-200 text-yellow-800 text-sm">
            {message}
          </div>
        ) : null}

        <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-slate-600 mb-2">Event</label>
            <div className="w-full p-3 border rounded bg-gray-50 outline-none text-slate-800">  
            <div className="font-medium">{eventName || eventId || "-"}</div>
            </div>
          </div>

          <div className="text-right">
            <label className="block text-sm text-slate-600 mb-2">Amount to pay</label>
            <div className="mt-1 font-medium text-slate-800">{formatAmount(amount ?? 0, wallet?.currency)}</div>
            <div className="text-xs text-slate-400">Projected balance: {projectedBalance !== null ? formatAmount(projectedBalance, wallet?.currency) : "—"}</div>
            <div className="mt-3">
              <button
                onClick={handlePay}
                disabled={
                  loading || !eventId || !userId || (amount && wallet && Number(wallet.balance ?? 0) < Number(amount ?? 0))
                }
                className="px-5 py-3 bg-indigo-600 text-white rounded shadow hover:bg-indigo-700 disabled:opacity-60"
              >
                {loading ? "Processing…" : "Pay with Wallet"}
              </button>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}