// app/(end-user)/vendorApplyingLoyaltyProgram/[id]/page.js
import { cookies } from "next/headers";
import { redirect, notFound } from "next/navigation";
import { API_BASE } from "@/app/services/http";
import VendorApplyingLoyaltyProgram from "../vendorApplyingLoyaltyProgram";

export default async function Page({ params }) {
  const cookieStore = cookies(); // no need to await
  const token = cookieStore.get("token")?.value;
  if (!token) redirect("/welcome");

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

  const eventId = params?.id ?? null;

  return <VendorApplyingLoyaltyProgram me={user} eventId={eventId} />;
}
