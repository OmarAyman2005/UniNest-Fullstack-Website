// app/events/registered/page.js
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { API_BASE } from "@/app/services/http";
import RegisteredEventsPage from "./RegisteredEventsPage";

export default async function Page() {
  const token = cookies().get("token")?.value;
  let currentUser = null;

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
        currentUser = {
          id: user.id || user._id || user.userId || user.uuid || null,
          fullName: user.fullName || user.name || "",
          email: user.email || "",
            role: String(user.role || "").toLowerCase() || null,
        };
      }
    } catch {
      // leave currentUser as null
    }
  }
    // If the logged-in user is admin or eventOffice, redirect to 404
    const lowerRole = String(currentUser?.role || "").toLowerCase();
    if (lowerRole === "admin" || lowerRole === "eventoffice" || lowerRole === "event-office") {
      redirect("/404");
    }

  return <RegisteredEventsPage currentUser={currentUser} />;
}
