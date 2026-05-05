"use client";
import { useState } from "react";

export default function ExternalVisitorQRButton({ eventId, className = "" }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [qr, setQr] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  const generate = async () => {
    try {
      setErr("");
      setLoading(true);
      const qs = new URLSearchParams();
      if (name) qs.set("name", name);
      if (email) qs.set("email", email);
      const res = await fetch(`/api/event/${eventId}/external-visitor-qr?${qs.toString()}`, {
        credentials: "include",
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.message || "Failed to generate QR");
      setQr(json.dataUrl);
    } catch (e) {
      setQr("");
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className={`inline-flex items-center px-3 py-2 rounded-md border border-black/10 hover:border-black/20 transition ${className}`}
      >
        Visitor QR
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/30" onClick={() => setOpen(false)} />
          <div className="relative z-10 w-full max-w-md rounded-xl bg-white border border-black/10 shadow-sm p-4 sm:p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">External Visitor QR</h2>
              <button className="px-2 py-1 rounded border border-black/10" onClick={() => setOpen(false)}>Close</button>
            </div>

            <div className="grid gap-3">
              <input
                className="border rounded px-3 py-2"
                placeholder="Visitor name (optional)"
                value={name}
                onChange={(e)=>setName(e.target.value)}
              />
              <input
                className="border rounded px-3 py-2"
                placeholder="Visitor email (optional)"
                value={email}
                onChange={(e)=>setEmail(e.target.value)}
              />

              <div className="flex gap-2">
                <button
                  onClick={generate}
                  disabled={loading}
                  className="px-3 py-2 rounded border border-black/10 hover:border-black/20 transition disabled:opacity-50"
                >
                  {loading ? "Generating…" : "Generate QR"}
                </button>
                {qr && (
                  <a
                    href={qr}
                    download={`visitor-qr-${eventId}.png`}
                    className="px-3 py-2 rounded border border-black/10 hover:border-black/20 transition"
                  >
                    Download PNG
                  </a>
                )}
              </div>

              {err && <div className="text-sm text-red-600">{err}</div>}

              <div className="flex items-center justify-center min-h-48 border border-dashed rounded">
                {qr ? (
                  <img src={qr} alt="QR code" className="w-56 h-56" />
                ) : (
                  <span className="text-sm opacity-60">
                    Enter optional details and click <strong>Generate QR</strong>.
                  </span>
                )}
              </div>

              <p className="text-xs text-black/60">
                Works only if the event is a <b>bazaar</b> or <b>booth</b> (or a career fair) and <b>Allow External Visitors</b> is enabled.
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
