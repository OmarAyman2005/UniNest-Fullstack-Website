import { cookies } from "next/headers";
import { redirect, notFound } from "next/navigation";
import { API_BASE } from "@/app/services/http";
import ClientBoothPage from "./ClientBoothPage";

export default async function Page(props) {
  const { params } = await props;

  // Require login
  const token = cookies().get("token")?.value;
  if (!token) redirect("/welcome");

  // Verify role + get user id
  const API_ORIGIN = API_BASE.replace(/\/api\/?$/, "");
  const res = await fetch(`${API_ORIGIN}/api/auth/me`, {
    method: "GET",
    headers: { Cookie: `token=${token}` },
    cache: "no-store",
  });
  if (!res.ok) redirect("/welcome");

  const meJson = await res.json().catch(() => null);
  const user = meJson?.user || {};
  const role = String(user?.role || "").toLowerCase();
  if (role !== "vendor") notFound();

  // Be robust about id field shape
  const userId =
    user.id ||
    user._id ||
    user.userId ||
    user.uuid ||
    null;

  if (!userId) {
    // If your /api/auth/me doesn't include an id, update the backend to send it.
    // For now, block & force re-auth.
    redirect("/welcome");
  }

  const { eventId } = params;
  return <ClientBoothPage eventId={eventId} userId={userId} />;
}
