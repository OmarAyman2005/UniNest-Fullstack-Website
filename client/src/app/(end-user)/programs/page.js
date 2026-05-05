// app/programs/page.js
import { cookies } from "next/headers";
import { API_BASE } from "@/app/services/http";
import ProgramsClient from "./programs";

export default async function Page() {
  const cookieStore = await cookies();
  const token = cookieStore.get("token")?.value;

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

  return <ProgramsClient currentUserId={currentUserId} currentUserRole={role} />;
}
