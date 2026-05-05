"use client";
import React from "react";

export default function FilterPanel({ filters, setFilters, filterConfig, onReset }) {
  return (
    <div className="bg-gray-dark p-4 rounded-2xl text-secondary space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <h2 className="font-semibold text-lg">Filters</h2>
        <button
          onClick={onReset}
          className="px-3 py-1 text-sm rounded-2xl bg-black/30 hover:bg-black/50 transition text-white/80"
        >
          Reset Filters
        </button>
      </div>

      {/* Scrollable Filter Row */}
      <div className="overflow-x-auto">
        <div className="flex gap-3 min-w-max">
          {filterConfig.map(({ key, label, type, placeholder, options }) => (
            <div key={key} className="flex flex-col min-w-[180px]">
              <label className="mb-1 text-sm text-white/70">{label}</label>

              {type === "datetime-local" ? (
                <input
                  type="datetime-local"
                  value={filters[key] || ""}
                  onChange={(e) =>
                    setFilters((prev) => ({
                      ...prev,
                      [key]: e.target.value,
                      page: 1,
                    }))
                  }
                  className="px-3 py-2 rounded bg-black/30"
                />
              ) : type === "select" ? (
                <select
                  value={filters[key] || ""}
                  onChange={(e) =>
                    setFilters((prev) => ({
                      ...prev,
                      [key]: e.target.value,
                      page: 1,
                    }))
                  }
                  className="px-3 py-2 rounded bg-black/30"
                >
                  <option value="">{placeholder}</option>
                  {options?.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  type={type || "text"}
                  placeholder={placeholder}
                  value={filters[key] || ""}
                  onChange={(e) =>
                    setFilters((prev) => ({
                      ...prev,
                      [key]: e.target.value,
                      page: 1,
                    }))
                  }
                  className="px-3 py-2 rounded bg-black/30"
                />
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}