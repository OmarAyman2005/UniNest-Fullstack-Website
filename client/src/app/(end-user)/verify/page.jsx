"use client";
import { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";

export default function Verify() {
  const params = useSearchParams();
  const router = useRouter();
  const token = params.get("token");
  const [msg, setMsg] = useState("Verifying token…");
  const [ok, setOk] = useState(false);

  useEffect(() => {
    const run = async () => {
      if (!token) { setMsg("Missing token"); return; }
      const url = `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api"}/auth/verify?token=${encodeURIComponent(token)}`;
      const res = await fetch(url, { credentials: "include" });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setOk(true);
        setMsg("Your email has been verified. Redirecting to login…");
        setTimeout(() => router.replace("/welcome"), 1500);
      } else {
        setOk(false);
        setMsg(data?.message || "Verification failed");
      }
    };
    run();
  }, [token, router]);

  return (
    <div className="max-w-lg mx-auto p-8 rounded-2xl bg-gray-dark text-secondary">
      <h1 className="text-2xl font-semibold mb-4">Account Verification</h1>
      <p className="mb-4">{ok ? "✅ " : "❌ "}{msg}</p>
      {!ok && <a className="px-4 py-2 rounded-2xl bg-primary text-secondary" href="/register">Create an account</a>}
    </div>
  );
}
