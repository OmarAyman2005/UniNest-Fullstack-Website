// IMPORTANT: use ?? not || so empty string is respected
const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5000";

async function request(path, init = {}) {
  const url = path.startsWith("http") ? path : `${API_BASE}${path}`;
  const res = await fetch(url, {
    method: "GET",
    headers: { "Content-Type": "application/json", ...(init.headers || {}) },
    cache: "no-store",
    credentials: "include",              // <-- always include cookies
    ...init,
    body: init.body && typeof init.body !== "string" ? JSON.stringify(init.body) : init.body,
  });
  const ct = res.headers.get("content-type") || "";
  const isJson = ct.includes("application/json");
  const data = isJson ? await res.json().catch(() => ({})) : await res.text();
  if (!res.ok) {
    const msg = (isJson && (data?.message || data?.error)) || `HTTP ${res.status}`;
    const err = new Error(msg); err.status = res.status; err.data = data; throw err;
  }
  return data;
}
export const http = {
  get: (p, i) => request(p, { ...i, method: "GET" }),
  post: (p, b, i) => request(p, { ...i, method: "POST", body: b }),
  patch: (p, b, i) => request(p, { ...i, method: "PATCH", body: b }),
  del: (p, i) => request(p, { ...i, method: "DELETE" }),
};
export { API_BASE };
