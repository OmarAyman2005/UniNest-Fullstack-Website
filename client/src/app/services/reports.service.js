export async function fetchAttendeesReport({ eventName, eventType, from, to } = {}) {
  const qs = new URLSearchParams();
  if (eventName) qs.set("eventName", eventName);
  if (eventType) qs.set("eventType", eventType);
  if (from) qs.set("from", from);
  if (to) qs.set("to", to);

  const res = await fetch(`/api/public/reports/attendees?${qs.toString()}`, { credentials: "include" });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).message || "Failed to load attendees report");
  return res.json();
}

export async function fetchSalesReport({ eventType, from, to, sort = "desc" } = {}) {
  const qs = new URLSearchParams();
  if (eventType) qs.set("eventType", eventType);
  if (from) qs.set("from", from);
  if (to) qs.set("to", to);
  qs.set("sort", sort);

  const res = await fetch(`/api/public/reports/sales?${qs.toString()}`, { credentials: "include" });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).message || "Failed to load sales report");
  return res.json();
}
