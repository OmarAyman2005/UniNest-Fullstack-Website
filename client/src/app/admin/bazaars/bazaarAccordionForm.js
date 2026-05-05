"use client";

export function BazaarAccordionForm({
    form,
    setForm,
    editingId,
    setEditingId,
    resetForm,
    handleSubmit,
    open,
    setOpen
}) {
    return (
        <div className="rounded-2xl overflow-hidden bg-surface text-root-secondary">
            {/* Accordion Header */}
            <button
                onClick={() => setOpen(!open)}
                className="w-full flex justify-between items-center px-4 py-3 text-left font-semibold bg-surface hover:bg-highlight transition"
            >
                <span className={`${!open && !editingId ? "text-white" : ""}`}>
                    {editingId ? "Edit Bazaar" : "Create New Bazaar"}
                </span>
                <span className="text-xl">{open ? "−" : "+"}</span>
            </button>

            {/* Accordion Body */}
            <div
                className={`transition-all duration-500 ease-in-out overflow-hidden ${
                    open ? "max-h-[1000px] opacity-100" : "max-h-0 opacity-0"
                }`}
            >
                <form onSubmit={handleSubmit} className="p-4 space-y-3 bg-surface text-root-primary">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {/* Bazaar Name */}
                        <div className="flex flex-col">
                            <label className="mb-1 text-sm font-medium text-white/80">Bazaar Name</label>
                            <input
                                className="px-3 py-2 rounded input-surface text-white"
                                placeholder="Enter Bazaar Name"
                                value={form.name}
                                onChange={(e) => setForm({ ...form, name: e.target.value })}
                                required
                            />
                        </div>

                        {/* Location */}
                        <div className="flex flex-col">
                            <label className="mb-1 text-sm font-medium text-white/80">Location</label>
                            <input
                                type="text"
                                className="px-3 py-2 rounded input-surface text-white"
                                placeholder="Enter Location"
                                value={form.location}
                                onChange={(e) => setForm({ ...form, location: e.target.value })}
                                required
                            />
                        </div>

                        {/* Start Date & Time */}
                        <div className="flex flex-col">
                            <label className="mb-1 text-sm font-medium text-white/80">Start Date & Time</label>
                            <input
                                type="datetime-local"
                                className="px-3 py-2 rounded input-surface text-white"
                                value={form.startDateTime}
                                onChange={(e) => setForm({ ...form, startDateTime: e.target.value })}
                                required
                            />
                        </div>

                        {/* End Date & Time */}
                        <div className="flex flex-col">
                            <label className="mb-1 text-sm font-medium text-white/80">End Date & Time</label>
                            <input
                                type="datetime-local"
                                className="px-3 py-2 rounded input-surface text-white"
                                value={form.endDateTime}
                                onChange={(e) => setForm({ ...form, endDateTime: e.target.value })}
                                required
                            />
                        </div>

                        {/* Registration Deadline */}
                        <div className="flex flex-col">
                            <label className="mb-1 text-sm font-medium text-white/80">Registration Deadline</label>
                            <input
                                type="datetime-local"
                                className="px-3 py-2 rounded input-surface text-white"
                                value={form.registrationDeadline}
                                onChange={(e) => setForm({ ...form, registrationDeadline: e.target.value })}
                                required
                            />
                        </div>

                        {/* Description */}
                        <div className="flex flex-col md:col-span-2">
                            <label className="mb-1 text-sm font-medium text-white/80">Description</label>
                            <textarea
                                className="px-3 py-2 rounded input-surface text-white"
                                placeholder="Short Description"
                                value={form.description}
                                onChange={(e) => setForm({ ...form, description: e.target.value })}
                                rows={3}
                                required
                            />
                        </div>
                    </div>

                    <div className="flex gap-3">
                        <button
                            type="submit"
                            className="px-4 py-2 rounded-2xl bg-primary text-secondary hover:opacity-90 transition"
                        >
                            {editingId ? "Update Bazaar" : "Create Bazaar"}
                        </button>

                        {editingId && (
                            <button
                                type="button"
                                className="px-4 py-2 rounded-2xl input-surface hover:opacity-80 transition"
                                onClick={() => {
                                    resetForm();
                                    setEditingId(null);
                                    setOpen(false);
                                }}
                            >
                                Cancel Edit
                            </button>
                        )}
                    </div>
                </form>
            </div>
        </div>
    );
}