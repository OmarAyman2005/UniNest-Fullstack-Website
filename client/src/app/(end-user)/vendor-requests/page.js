// client/src/app/(end-user)/vendor-requests/page.js
import VendorRequests from "./vendor-requests";
import { notFound, redirect } from "next/navigation";
import { cookies } from "next/headers";
import { API_BASE } from "@/app/services/http";

export default async function Page() {
  // Read HttpOnly JWT stored for localhost:3000
  const token = cookies().get("token")?.value;
  if (!token) redirect("/welcome");

  // Your .env.local sets NEXT_PUBLIC_API_URL=http://localhost:5000/api
  // We need the ORIGIN only, so we don’t end up calling /api/api/...
  const API_ORIGIN = API_BASE.replace(/\/api\/?$/, "");

  // Ask backend who we are, forwarding the cookie explicitly
  const res = await fetch(`${API_ORIGIN}/api/auth/me`, {
    method: "GET",
    headers: { Cookie: `token=${token}` },
    cache: "no-store",
  });

  if (!res.ok) {
    // token invalid/expired → go to login
    redirect("/welcome");
  }

  const me = await res.json().catch(() => null);
  const role = String(me?.user?.role || "").toLowerCase();
  const id = me?.user?.id || me?.user?._id;

  // Only allow these roles
  const ALLOWED = new Set(["admin", "event_office", "vendor"]);
  if (!ALLOWED.has(role)) notFound();

  // Vendors see only their requests; admin/event_office see all
  const vendorId = role === "vendor" ? id : undefined;
  const vendorN = me?.user?.fullName || "Unknown";

  return <VendorRequests vendorId={vendorId} role={role} vendorName={vendorN}/>;
}
