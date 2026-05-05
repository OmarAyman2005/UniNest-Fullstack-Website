import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { API_BASE } from "@/app/services/http";
import EventDetailsPageClient from "./EventDetailsPageClient.jsx";

export default async function Page({ params }) {
  const token = cookies().get("token")?.value;
  let currentUserId = null;
  let role = null;

  if (token) {
    const API_ORIGIN = API_BASE.replace(/\/api\/?$/, "");
    try {
      const res = await fetch(`${API_ORIGIN}/api/auth/me`, {
        method: "GET",
        headers: { Cookie: `token=${token}` },
        cache: "no-store",
      });
      if (res.ok) {
        const meJson = await res.json().catch(() => null);
        const user = meJson?.user || {};
        currentUserId = user.id || user._id || user.userId || user.uuid || null;
        role = String(user.role || "").toLowerCase() || null;
      }
    } catch {
      // leave as nulls
    }
  }

  const { id } = await params;
  // restrict access for admin or eventOffice roles -> show 404
  const lowerRole = String(role || "").toLowerCase();
  if (lowerRole === "admin" || lowerRole === "eventoffice" || lowerRole === "event-office") {
    redirect("/404");
  }
  return <EventDetailsPageClient eventId={id} currentUserId={currentUserId} currentUserRole={role} />;
}