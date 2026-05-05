"use client";
import React from "react";

export default function Pagination({ page, limit, totalCount, onPageChange, onLimitChange }) {
    const totalPages = Math.max(1, Math.ceil((totalCount || 0) / (limit || 1)));

    return (
        <div className="flex flex-col md:flex-row justify-between items-center gap-3 mt-4">
            {/* Records per page selector */}
            <div className="flex items-center gap-2">
                <label className="text-sm text-root-secondary">Records per page:</label>
                <select
                    value={limit}
                    onChange={(e) => onLimitChange(parseInt(e.target.value))}
                    className="px-2 py-1 rounded-xl input-surface border border-root"
                >
                    {[5, 8, 10, 15, 20].map((num) => (
                        <option key={num} value={num}>
                            {num}
                        </option>
                    ))}
                </select>
            </div>

            {/* Page navigation */}
            <div className="flex items-center gap-3">
                <button
                    disabled={page === 1}
                    onClick={() => onPageChange(Math.max(1, page - 1))}
                    className="px-3 py-1 rounded-lg input-surface border border-root hover:opacity-80 disabled:opacity-40"
                >
                    ← Prev
                </button>

                <div className="flex items-center gap-2">
                    <span className="text-root-secondary">Page</span>
                    <select
                        value={page}
                        onChange={(e) => onPageChange(parseInt(e.target.value))}
                        className="px-2 py-1 rounded-xl input-surface border border-root"
                    >
                        {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                            <option key={p} value={p}>
                                {p}
                            </option>
                        ))}
                    </select>
                    <span className="text-root-secondary">of {totalPages}</span>
                </div>

                <button
                    disabled={page >= totalPages}
                    onClick={() => onPageChange(page + 1)}
                    className="px-3 py-1 rounded-lg input-surface border border-root hover:opacity-80 disabled:opacity-40"
                >
                    Next →
                </button>
            </div>
        </div>
    );
}