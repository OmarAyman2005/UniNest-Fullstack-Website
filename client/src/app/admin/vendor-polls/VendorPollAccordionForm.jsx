"use client";
import React from "react";

export function VendorPollAccordionForm({
  open,
  setOpen,
  events,
  eventsLoading,
  selectedEventId,
  onEventChange,
  pollTitle,
  setPollTitle,
  pollDescription,
  setPollDescription,
  eligibleVendors,
  eligibleLoading,
  selectedVendorIds,
  toggleVendor,
  allVendorsSelected,
  toggleSelectAllVendors,
  handleCreatePoll,
  creating,
}) {
  return (
    <div className="rounded-2xl overflow-hidden bg-surface text-root-secondary">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex justify-between items-center px-4 py-3 text-left font-semibold bg-surface hover:bg-highlight transition"
      >
        <span className={`${!open ? "text-white" : ""}`}>
          {open ? "Create New Vendor Poll" : "Create Vendor Poll"}
        </span>
        <span className="text-xl">{open ? "−" : "+"}</span>
      </button>

      <div
        className={`transition-all duration-500 ease-in-out overflow-hidden ${
          open ? "max-h-[1000px] opacity-100" : "max-h-0 opacity-0"
        }`}
      >
        <form onSubmit={handleCreatePoll} className="p-4 space-y-3 bg-surface text-root-primary">
          <div className="grid grid-cols-1 gap-3">
            <div className="flex flex-col">
              <label className="mb-1 text-sm font-medium text-root-secondary">Booth event</label>
              <select
                className="px-3 py-2 rounded input-surface border border-root/70"
                value={selectedEventId}
                onChange={onEventChange}
                disabled={eventsLoading}
              >
                <option value="">{eventsLoading ? "Loading events…" : "Select a Booth event"}</option>
                {events.map((ev) => (
                  <option key={ev.id} value={ev.id}>
                    {ev.name}{ev.location ? ` – ${ev.location}` : ""}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col">
              <label className="mb-1 text-sm font-medium text-root-secondary">Poll title</label>
              <input
                type="text"
                className="px-3 py-2 rounded input-surface border border-root/70"
                value={pollTitle}
                onChange={(e) => setPollTitle(e.target.value)}
                placeholder='e.g. "Which vendor should get the clashing booth?"'
              />
            </div>

            <div className="flex flex-col">
              <label className="mb-1 text-sm font-medium text-root-secondary">Description (optional)</label>
              <textarea
                className="px-3 py-2 rounded input-surface border border-root/70 min-h-[40px]"
                value={pollDescription}
                onChange={(e) => setPollDescription(e.target.value)}
                placeholder="Any instructions or extra info for voters."
              />
            </div>

            {selectedEventId && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs text-root-secondary">
                  <span className="font-semibold uppercase tracking-wide">Clashing vendors</span>
                  <span>
                    {eligibleLoading ? "Loading…" : `${eligibleVendors.length} vendor${eligibleVendors.length === 1 ? "" : "s"}`}
                  </span>
                </div>

                {eligibleLoading ? (
                  <p className="text-sm text-root-secondary">Loading eligible vendors…</p>
                ) : eligibleVendors.length === 0 ? (
                  <div className="rounded-xl bg-black/30 border border-dashed border-root/50 px-4 py-4 text-sm text-root-secondary">
                    No clashes found for this event.
                  </div>
                ) : (
                  <div className="overflow-auto rounded-2xl p-2">
                    <table className="w-full text-sm">
                      <thead className="bg-black/25 text-root-secondary">
                        <tr>
                          <th className="p-2">
                            <label className="inline-flex items-center gap-2 cursor-pointer">
                              <input
                                type="checkbox"
                                className="accent-primary"
                                checked={allVendorsSelected}
                                onChange={toggleSelectAllVendors}
                              />
                              <span>Select all</span>
                            </label>
                          </th>
                          <th className="p-2 text-left">Vendor</th>
                          <th className="p-2 text-left">Booth</th>
                          <th className="p-2 text-left">Reservation window</th>
                        </tr>
                      </thead>
                      <tbody>
                        {eligibleVendors.map((v) => {
                          const idStr = String(v.applicationId);
                          const checked = selectedVendorIds.includes(idStr);
                          const rangeLabel = v.reservationStart && v.reservationEnd
                            ? `${new Date(v.reservationStart).toLocaleString()} → ${new Date(v.reservationEnd).toLocaleString()}`
                            : "—";
                          return (
                            <tr key={idStr} className="border-t border-root/70">
                              <td className="p-2">
                                <input
                                  type="checkbox"
                                  className="accent-primary"
                                  checked={checked}
                                  onChange={() => toggleVendor(idStr)}
                                />
                              </td>
                              <td className="p-2">{v.vendorName || "Vendor"}</td>
                              <td className="p-2">{v.boothNumber || "—"}</td>
                              <td className="p-2">{rangeLabel}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="flex justify-start pt-4 border-t border-root/40 mt-4">
            <button
              type="submit"
              disabled={creating || !selectedEventId || eligibleVendors.length === 0 || selectedVendorIds.length < 2}
              className="px-5 py-2.5 rounded-2xl bg-primary text-root-primary text-sm font-medium hover:opacity-90 disabled:opacity-60 disabled:cursor-not-allowed transition"
            >
              {creating ? "Creating Poll…" : "Create Vendor Poll"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}