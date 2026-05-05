"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api, appLogout as _appLogout } from "@/lib/api";

export default function LogoutButton({
  className = "flex items-center gap-2 w-full rounded-xl bg-red-600 text-white px-4 py-3 hover:opacity-90",
  children = "Logout",
  onDone,
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  const handleClick = async () => {
    if (busy) return;
    setBusy(true);
    try {
      // Prefer the helper if present, otherwise fall back to a direct call.
      if (typeof _appLogout === "function") {
        await _appLogout(router);
      } else {
        try { await api("/auth/logout", { method: "POST" }); } catch {}
        router.replace("/welcome?cleared=1");
        router.refresh?.();
      }
      onDone?.();
    } catch (e) {
      console.error("Logout error:", e);
      // Still navigate to login to ensure the session is cleared on the client.
      router.replace("/welcome?cleared=1");
      router.refresh?.();
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={busy}
      aria-disabled={busy}
      className={`${className} ${busy ? "opacity-70 cursor-not-allowed" : ""}`}
      title={busy ? "Logging out…" : "Logout"}
    >
      {busy ? "Logging out…" : children}
    </button>
  );
}
