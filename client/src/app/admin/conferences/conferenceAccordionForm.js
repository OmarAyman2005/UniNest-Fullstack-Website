"use client";

export function ConferenceAccordionForm({ form, setForm, editingId, setEditingId, resetForm, handleSubmit, open, setOpen }) {
  const handleResourceChange = (index, field, value) => {
    const newResources = [...(form.extraRequiredResources || [])];
    newResources[index] = { ...newResources[index], [field]: field === "quantity" ? Number(value) : value };
    setForm({ ...form, extraRequiredResources: newResources });
  };

  const addResource = () => {
    setForm({
      ...form,
      extraRequiredResources: [...(form.extraRequiredResources || []), { resourceName: "", quantity: 1 }],
    });
  };

  const removeResource = (index) => {
    const newResources = (form.extraRequiredResources || []).filter((_, i) => i !== index);
    setForm({ ...form, extraRequiredResources: newResources });
  };

  return (
    <div className="rounded-2xl overflow-hidden bg-surface text-root-secondary">
      {/* Accordion Header */}
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex justify-between items-center px-4 py-3 text-left font-semibold bg-surface hover:bg-highlight transition"
      >
        <span className={`${!open && !editingId ? "text-white" : ""}`}>
          {editingId ? "Edit Conference" : "Create New Conference"}
        </span>
        <span className="text-xl">{open ? "−" : "+"}</span>
      </button>

      {/* Accordion Body */}
      <div className={`transition-all duration-500 ease-in-out overflow-hidden ${open ? "max-h-[1000px] opacity-100" : "max-h-0 opacity-0"}`}>
        <form onSubmit={handleSubmit} className="p-4 space-y-3 bg-surface text-root-primary">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {/* Conference Name */}
            <div className="flex flex-col">
              <label className="mb-1 text-sm font-medium text-white/80">Conference Name</label>
              <input
                className="px-3 py-2 rounded input-surface text-white"
                placeholder="Enter Conference Name"
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

            {/* Budget */}
            <div className="flex flex-col">
              <label className="mb-1 text-sm font-medium text-white/80">Budget</label>
              <input
                type="number"
                className="px-3 py-2 rounded input-surface text-white"
                value={form.budget}
                onChange={(e) => setForm({ ...form, budget: e.target.value })}
                required
              />
            </div>

            {/* Funding Source */}
            <div className="flex flex-col">
              <label className="mb-1 text-sm font-medium text-white/80">Funding Source</label>
              <select
                className="px-3 py-2 rounded input-surface text-white"
                value={form.fundingSource}
                onChange={(e) => setForm({ ...form, fundingSource: e.target.value })}
                required
              >
                <option value="GUC">GUC</option>
                <option value="External">External</option>
              </select>
            </div>

            {/* Website Link */}
            <div className="flex flex-col md:col-span-2">
              <label className="mb-1 text-sm font-medium text-white/80">Conference Website Link</label>
              <input
                type="url"
                className="px-3 py-2 rounded input-surface text-white"
                placeholder="https://"
                value={form.conferenceWebsiteLink}
                onChange={(e) => setForm({ ...form, conferenceWebsiteLink: e.target.value })}
              />
            </div>

            {/* Full Agenda */}
            <div className="flex flex-col md:col-span-2">
              <label className="mb-1 text-sm font-medium text-white/80">Full Agenda</label>
              <textarea
                className="px-3 py-2 rounded input-surface text-white"
                placeholder="Full Agenda"
                value={form.fullAgenda}
                onChange={(e) => setForm({ ...form, fullAgenda: e.target.value })}
                rows={3}
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
              />
            </div>

            {/* Extra Required Resources */}
            <div className="md:col-span-2">
              <label className="mb-2 text-sm font-medium text-white/80">Extra Required Resources</label>
              {(form.extraRequiredResources || []).map((r, i) => (
                <div key={i} className="flex items-center gap-2 mb-2">
                  <input
                    className="flex-1 px-3 py-2 rounded input-surface text-white"
                    placeholder="Resource Name"
                    value={r.resourceName}
                    onChange={(e) => handleResourceChange(i, "resourceName", e.target.value)}
                  />
                  <input
                    type="number"
                    min="1"
                    className="w-24 px-3 py-2 rounded input-surface text-white"
                    placeholder="Qty"
                    value={r.quantity}
                    onChange={(e) => handleResourceChange(i, "quantity", e.target.value)}
                  />
                  {(form.extraRequiredResources || []).length > 1 && (
                    <button
                      type="button"
                      className="px-3 py-1 rounded bg-red-600/30 hover:bg-red-600/40 transition"
                      onClick={() => removeResource(i)}
                    >
                      ×
                    </button>
                  )}
                </div>
              ))}

              <button
                type="button"
                onClick={addResource}
                className="px-3 py-1 mt-1 rounded bg-black/40 hover:bg-black/50 transition text-sm"
              >
                + Add Resource
              </button>
            </div>
          </div>

          <div className="flex gap-3">
            <button type="submit" className="px-4 py-2 rounded-2xl bg-primary text-secondary hover:opacity-90 transition">
              {editingId ? "Update Conference" : "Create Conference"}
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