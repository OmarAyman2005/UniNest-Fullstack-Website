"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Heart, X } from "lucide-react";

/*
  Server-backed favorites tied to a userId.
  - If userId is provided, client will use the API at /api/users/:userId/favorites
  - If API is unreachable or userId is not provided, falls back to localStorage per-user (KEY_PREFIX + userId)
*/

const KEY_PREFIX = "favorites_acl:";

function storageKey(userId) {
  if (userId) return KEY_PREFIX + String(userId);
  // for anonymous clients, use a per-browser client id (so different browsers/devices don't share one "anon" list)
  try {
    const clientIdKey = KEY_PREFIX + "clientId";
    let clientId = localStorage.getItem(clientIdKey);
    if (!clientId) {
      // use crypto.randomUUID when available
      clientId = (typeof crypto !== "undefined" && crypto.randomUUID) ? crypto.randomUUID() : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
      localStorage.setItem(clientIdKey, clientId);
    }
    return `${KEY_PREFIX}client:${clientId}`;
  } catch {
    // fallback
    return KEY_PREFIX + "anon";
  }
}

function readFavoritesLocal(userId) {
  try {
    const raw = localStorage.getItem(storageKey(userId));
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeFavoritesLocal(list, userId) {
  try {
    localStorage.setItem(storageKey(userId), JSON.stringify(list));
    window.dispatchEvent(new CustomEvent("favorites:changed", { detail: { userId: userId ?? "anon", list } }));
    window.dispatchEvent(new CustomEvent(`favorites:changed:${storageKey(userId)}`, { detail: list }));
  } catch {}
}

function getApiBase() {
  const base = process.env.NEXT_PUBLIC_API_BASE || process.env.NEXT_PUBLIC_API_URL || "";
  if (base) return base.replace(/\/+$/, "");
  if (typeof window !== "undefined") {
    return `${window.location.protocol}//${window.location.hostname}:5000`;
  }
  return "";
}

async function safeJson(res) {
  try {
    return await res.json();
  } catch {
    return null;
  }
}

async function fetchFavoritesApi(userId) {
  if (!userId) return null;
  try {
    const res = await fetch(`${getApiBase()}/api/users/${encodeURIComponent(userId)}/favorites`, {
      method: "GET",
      credentials: "include",
      headers: { Accept: "application/json" },
    });
    const json = await safeJson(res);
    if (!res.ok) return null;
    return Array.isArray(json?.data) ? json.data : Array.isArray(json) ? json : [];
  } catch {
    return null;
  }
}

async function addFavoriteApi(userId, item) {
  if (!userId) return null;
  try {
    const res = await fetch(`${getApiBase()}/api/users/${encodeURIComponent(userId)}/favorites`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: item.id, name: item.name, href: item.href }),
    });
    const json = await safeJson(res);
    if (!res.ok) return null;
    return Array.isArray(json?.data) ? json.data : null;
  } catch {
    return null;
  }
}

async function removeFavoriteApi(userId, id) {
  if (!userId) return null;
  try {
    const res = await fetch(
      `${getApiBase()}/api/users/${encodeURIComponent(userId)}/favorites/${encodeURIComponent(id)}`,
      { method: "DELETE", credentials: "include", headers: { Accept: "application/json" } }
    );
    const json = await safeJson(res);
    if (!res.ok) return null;
    return Array.isArray(json?.data) ? json.data : null;
  } catch {
    return null;
  }
}

async function clearFavoritesApi(userId) {
  if (!userId) return null;
  try {
    const res = await fetch(`${getApiBase()}/api/users/${encodeURIComponent(userId)}/favorites`, {
      method: "DELETE",
      credentials: "include",
      headers: { Accept: "application/json" },
    });
    const json = await safeJson(res);
    if (!res.ok) return null;
    return Array.isArray(json?.data) ? json.data : null;
  } catch {
    return null;
  }
}

// Public helpers used by other parts of the client
export async function toggleFavorite(item, userId = null) {
  if (!item || !item.id) return null;

  if (userId) {
    // try server
    const apiList = await fetchFavoritesApi(userId);
    if (apiList === null) {
      // fallback to local
      const cur = readFavoritesLocal(userId);
      const exists = cur.some((f) => String(f.id) === String(item.id));
      const next = exists ? cur.filter((f) => String(f.id) !== String(item.id)) : [{ id: item.id, name: item.name || "Event", href: item.href || `/events/${item.id}` }, ...cur];
      writeFavoritesLocal(next, userId);
      return next;
    }

    const exists = apiList.some((f) => String(f.id) === String(item.id));
    const result = exists ? await removeFavoriteApi(userId, item.id) : await addFavoriteApi(userId, item);
    if (Array.isArray(result)) {
      writeFavoritesLocal(result, userId); // keep local cache in sync
      return result;
    }
    // try fetch fresh
    const fresh = await fetchFavoritesApi(userId);
    if (Array.isArray(fresh)) {
      writeFavoritesLocal(fresh, userId);
      return fresh;
    }
    return null;
  } else {
    // anon/local only
    const cur = readFavoritesLocal(null);
    const exists = cur.some((f) => String(f.id) === String(item.id));
    const next = exists ? cur.filter((f) => String(f.id) !== String(item.id)) : [{ id: item.id, name: item.name || "Event", href: item.href || `/events/${item.id}` }, ...cur];
    writeFavoritesLocal(next, null);
    return next;
  }
}

export async function isFavorite(id, userId = null) {
  if (userId) {
    const list = await fetchFavoritesApi(userId);
    if (Array.isArray(list)) return list.some((f) => String(f.id) === String(id));
    const local = readFavoritesLocal(userId);
    return local.some((f) => String(f.id) === String(id));
  }
  const cur = readFavoritesLocal(null);
  return cur.some((f) => String(f.id) === String(id));
}

/* Small button to add/remove a single event from favorites */
export function FavoriteAddButton({ id, name, href, className = "", userId = null }) {
  const [active, setActive] = useState(false);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const v = await isFavorite(id, userId);
      if (mounted) setActive(Boolean(v));
    })();

    function onChange(e) {
      // user-specific or generic change
      if (e?.detail && typeof e.detail === "object" && "userId" in e.detail) {
        if (String(e.detail.userId) !== String(userId ?? "anon")) return;
      }
      (async () => {
        const v = await isFavorite(id, userId);
        if (mounted) setActive(Boolean(v));
      })();
    }

    const key = storageKey(userId);
    window.addEventListener("favorites:changed", onChange);
    window.addEventListener(`favorites:changed:${key}`, onChange);
    return () => {
      mounted = false;
      window.removeEventListener("favorites:changed", onChange);
      window.removeEventListener(`favorites:changed:${key}`, onChange);
    };
  }, [id, userId]);

  const onToggle = async (e) => {
    e.stopPropagation();
    const next = await toggleFavorite({ id, name, href }, userId);
    const nowActive = Array.isArray(next) ? next.some((f) => String(f.id) === String(id)) : await isFavorite(id, userId);
    setActive(Boolean(nowActive));
  };

  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={active}
      title={active ? "Remove from favorites" : "Add to favorites"}
      className={`p-1 rounded-md transition ${active ? "text-amber-400" : "text-gray-400 hover:text-amber-400"} ${className}`}
      style={{ display: "inline-flex", alignItems: "center", justifyContent: "center" }}
    >
      {active ? (
        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 6 4 4 6.5 4c1.74 0 3.41.81 4.5 2.09C12.09 4.81 13.76 4 15.5 4 18 4 20 6 20 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
        </svg>
      ) : (
        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
        </svg>
      )}
    </button>
  );
}

/* Topbar favorites button + dropdown list
   Pass userId prop to scope list to the logged-in user */
export default function FavoriteList({ className = "", userId = null }) {
  const [open, setOpen] = useState(false);
  const [favorites, setFavorites] = useState(() => (userId ? readFavoritesLocal(userId) : readFavoritesLocal(null)));
  const ref = useRef(null);

  useEffect(() => {
    let mounted = true;

    (async () => {
      if (!mounted) return;
      if (userId) {
        const list = await fetchFavoritesApi(userId);
        if (mounted && Array.isArray(list)) {
          setFavorites(list);
          writeFavoritesLocal(list, userId);
        } else if (mounted) {
          setFavorites(readFavoritesLocal(userId));
        }
      } else {
        setFavorites(readFavoritesLocal(null));
      }
    })();

    function onChange(e) {
      if (!mounted) return;
      // if event.detail.userId present only react to that user's events
      if (e?.detail && typeof e.detail === "object" && "userId" in e.detail) {
        if (String(e.detail.userId) !== String(userId ?? "anon")) return;
        setFavorites(Array.isArray(e.detail.list) ? e.detail.list : readFavoritesLocal(userId));
        return;
      }
      // otherwise re-read for current userId
      setFavorites(readFavoritesLocal(userId));
    }

    function onDocClick(ev) {
      if (ref.current && !ref.current.contains(ev.target)) setOpen(false);
    }

    const key = storageKey(userId);
    window.addEventListener("favorites:changed", onChange);
    window.addEventListener(`favorites:changed:${key}`, onChange);
    document.addEventListener("click", onDocClick);

    return () => {
      mounted = false;
      window.removeEventListener("favorites:changed", onChange);
      window.removeEventListener(`favorites:changed:${key}`, onChange);
      document.removeEventListener("click", onDocClick);
    };
  }, [userId]);

  const removeOne = async (id) => {
    const result = userId ? await removeFavoriteApi(userId, id) : null;
    if (Array.isArray(result)) {
      writeFavoritesLocal(result, userId);
      setFavorites(result);
    } else {
      // fallback to toggle which will update local
      await toggleFavorite({ id }, userId);
      setFavorites(readFavoritesLocal(userId));
    }
  };

  const clearAll = async () => {
    if (userId) {
      const result = await clearFavoritesApi(userId);
      if (Array.isArray(result)) {
        writeFavoritesLocal(result, userId);
        setFavorites(result);
        setOpen(false);
        return;
      }
    }
    // fallback local clear
    writeFavoritesLocal([], userId);
    setFavorites([]);
    setOpen(false);
  };

  return (
    <div ref={ref} className={`relative ${className}`}>
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); setOpen((s) => !s); }}
        aria-haspopup="menu"
        aria-expanded={open}
        title="Favorites"
        className="flex items-center gap-2 py-1 rounded-md"
      >
        <Heart className="w-6 h-6 text-primary hover:text-primary cursor-pointer" />
        <span className="text-sm">{favorites.length}</span>
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-72 bg-root text-root-primary border border-root rounded-md shadow-elevated z-50">
          <div className="p-3 space-y-2">
            <div className="flex items-center justify-between">
              <strong>Favorites</strong>
              <div className="flex items-center gap-2">
                <button type="button" onClick={clearAll} className="text-xs px-2 py-1 rounded input-surface cursor-pointer">Clear</button>
                <button type="button" onClick={() => setOpen(false)} className="px-1 rounded input-surface">
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {favorites.length === 0 ? (
              <div className="text-sm text-gray-400">No favorites yet.</div>
            ) : (
              <ul className="space-y-2 max-h-60 overflow-auto">
                {favorites.map((f) => (
                  <li key={f.id} className="flex items-center justify-between">
                    <Link href={f.href || "#"} className="text-sm px-2 py-1 w-full" onClick={() => setOpen(false)}>
                      {f.name}
                    </Link>
                    <button type="button" onClick={() => removeOne(f.id)} title="Remove" className="px-2 py-1 rounded input-surface ml-2 text-sm cursor-pointer">Remove</button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}