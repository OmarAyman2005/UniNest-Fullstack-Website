// client/src/app/admin/vendor-requests/page.js
import VendorRequests from "./vendor-requests";
import { notFound, redirect } from "next/navigation";
import { cookies } from "next/headers";
import { API_BASE } from "@/app/services/http";

export default async function Page() {
  // ✅ MUST await cookies()
  const cookieStore = await cookies();
  const token = cookieStore.get("token")?.value;
  if (!token) redirect("/welcome");

  // Keep using your API_BASE, but strip trailing /api to build full origin
  const API_ORIGIN = API_BASE.replace(/\/api\/?$/, "");

  // Forward the raw cookie to the Express API
  const res = await fetch(`${API_ORIGIN}/api/auth/me`, {
    method: "GET",
    headers: { Cookie: `token=${token}` },
    cache: "no-store",
  });

  if (!res.ok) redirect("/welcome");

  const me = await res.json().catch(() => null);
  const role = String(me?.user?.role || "").toLowerCase();
  const id = me?.user?.id || me?.user?._id;

  const ALLOWED = new Set(["admin", "event_office", "vendor"]);
  if (!ALLOWED.has(role)) notFound();

  const vendorId = role === "vendor" ? id : undefined;

  return <VendorRequests vendorId={vendorId} role={role} />;
}
