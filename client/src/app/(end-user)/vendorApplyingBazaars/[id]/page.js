// app/(end-user)/vendorApplyingBazaars/page.js
import { cookies } from "next/headers";
import { redirect, notFound } from "next/navigation";
import { API_BASE } from "@/app/services/http";
import VendorApplyingBazaars from "./vendorApplyingBazaars";

export default async function Page({ params }) {
  const token = cookies().get("token")?.value;
  if (!token) redirect("/welcome");

  // Strip trailing /api so we don't call /api/api/...
  const API_ORIGIN = API_BASE.replace(/\/api\/?$/, "");

  const res = await fetch(`${API_ORIGIN}/api/auth/me`, {
    method: "GET",
    headers: { Cookie: `token=${token}` },
    cache: "no-store",
  });

  if (!res.ok) redirect("/welcome");

  const meJson = await res.json().catch(() => null);
  const user = meJson?.user;
  const role = String(user?.role || "").toLowerCase();

  if (role !== "vendor") notFound();

  return <VendorApplyingBazaars eventId={params.id} me={user} />;
}
