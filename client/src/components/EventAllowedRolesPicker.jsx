"use client";
import { useMemo } from "react";

const ALL = ['student','staff','ta','professor','vendor','admin','event_office'];

export default function EventAllowedRolesPicker({ value = ALL, onChange }) {
  const selected = useMemo(() => new Set(value), [value]);
  const toggle = (role) => {
    const next = new Set(selected);
    next.has(role) ? next.delete(role) : next.add(role);
    onChange?.(Array.from(next));
  };

  return (
    <div className="space-y-2">
      <div className="text-sm font-medium">Allowed Roles</div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {ALL.map((r) => (
          <label key={r} className="flex items-center gap-2 px-3 py-2 rounded-md border border-black/10 hover:border-black/20 transition">
            <input
              type="checkbox"
              className="h-4 w-4"
              checked={selected.has(r)}
              onChange={() => toggle(r)}
            />
            <span className="capitalize">{r.replace("_"," ")}</span>
          </label>
        ))}
      </div>
      <p className="text-xs text-black/60">
        If you leave everything selected, the event remains visible/registrable to everyone (backward compatible).
      </p>
    </div>
  );
}
