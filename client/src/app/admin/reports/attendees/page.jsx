// client/src/app/admin/reports/attendees/page.js
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { API_BASE } from "@/app/services/http";

export default async function Page() {
  const cookieStore = await cookies();
  const token = cookieStore.get("token")?.value;
  if (!token) redirect("/welcome");

  const API_ORIGIN = API_BASE.replace(/\/api\/?$/, "");
  // You can add query params here if you have filters in the UI
  const res = await fetch(`${API_ORIGIN}/api/public/reports/attendees`, {
    headers: { Cookie: `token=${token}` },
    cache: "no-store",
  });

  if (res.status === 401 || res.status === 403) redirect("/welcome");
  if (!res.ok) throw new Error("Failed to load attendees report");

  const payload = await res.json();
  const rows = payload?.data ?? [];

  return (
    <main className="p-6 space-y-4">
      <h1 className="text-2xl font-semibold text-root-primary">Attendees Report</h1>
      <div className="rounded-2xl bg-surface border border-root overflow-auto">
        <table className="w-full text-sm">
          <thead className="text-root-secondary">
            <tr>
              <th className="p-2 text-left">Event</th>
              <th className="p-2 text-left">Type</th>
              <th className="p-2 text-left">Total Attendees</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td className="p-3 text-root-secondary" colSpan={3}>No data.</td></tr>
            ) : (
              rows.map(r => (
                <tr key={r._id} className="border-t border-root">
                  <td className="p-2">{r.eventName}</td>
                  <td className="p-2">{r.eventType}</td>
                  <td className="p-2">{r.count}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </main>
  );
}
