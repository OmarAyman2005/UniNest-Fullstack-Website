"use client";
import "@/globals.css";
import { useEffect, useState, useRef } from "react";
import {
  FaMapMarkerAlt,
  FaCalendarAlt,
  FaClock,
  FaUsers,
  FaPlus,
  FaEdit,
  FaTrash,
} from "react-icons/fa";
import Toast from "@/components/toast.js";
import ViewDetailsButton from "@/app/admin/workshops/viewDetails";
import { convertToUTC } from "@/lib/dateFormatter.js";
import { api } from "@/lib/api";

export default function WorkshopsPage() {
  const [workshops, setWorkshops] = useState([]);
  const [workshopRequests, setWorkshopRequests] = useState({}); // Map of workshopId -> request data
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [showParticipantsModal, setShowParticipantsModal] = useState(false);
  const [selectedWorkshop, setSelectedWorkshop] = useState(null);
  const [participants, setParticipants] = useState([]);
  const [participantsStats, setParticipantsStats] = useState(null);
  const [loadingParticipants, setLoadingParticipants] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmPayload, setConfirmPayload] = useState(null);
  // single shared transient toast (uses components/toast.js)
  const [toastState, setToastState] = useState(null);
  const toastTimerRef = useRef(null);
  const [formData, setFormData] = useState({
    name: "",
    location: "GUC Cairo",
    description: "",
    registrationDeadline: "",
    startDateTime: "",
    endDateTime: "",
    faculty: "MET",
    budget: "",
    price: 0,
    fundingSource: "GUC",
    capacity: "",
    fullAgenda: "",
    professors: [{ id: "", contribution: "" }],
    extraRequiredResources: [{ resourceName: "", quantity: 1 }],
  });
  const [step, setStep] = useState(1);
  const [editMode, setEditMode] = useState(false);
  const [selectedWorkshopId, setSelectedWorkshopId] = useState(null);
  const [professorsList, setProfessorsList] = useState([]);
  const [hoveredCard, setHoveredCard] = useState(null);

  const showToast = (type = "success", title = "", description = "", duration = 4000) => {
    // compose message like previous behaviour: "Title — Description"
    const message = description ? `${title} — ${description}` : title || "";

    // clear previous timer
    if (toastTimerRef.current) {
      clearTimeout(toastTimerRef.current);
      toastTimerRef.current = null;
    }

    setToastState({ message, type: type === "error" ? "error" : type === "warning" ? "warning" : "success" });

    if (duration > 0) {
      toastTimerRef.current = setTimeout(() => {
        setToastState(null);
        toastTimerRef.current = null;
      }, duration);
    }
  };

  // cleanup timers on unmount
  useEffect(() => {
    return () => {
      if (toastTimerRef.current) {
        clearTimeout(toastTimerRef.current);
        toastTimerRef.current = null;
      }
    };
  }, []);

  const fetchProfessors = async () => {
    try {
      const res = await api('/public/professors');
      let payload = res;
      if (res && typeof res.json === 'function') payload = await res.json();
      const list = Array.isArray(payload) ? payload : payload?.data ?? payload?.items ?? [];
      setProfessorsList(Array.isArray(list) ? list : []);
    } catch (err) {
      console.error("Failed to load professors:", err);
      showToast?.("error", "Failed to load professors");
    }
  };

  const fetchWorkshops = async () => {
    try {
      setLoading(true);
      const meRes = await api('/auth/me');
      let mePayload = meRes;
      if (meRes && typeof meRes.json === 'function') mePayload = await meRes.json();
      const me = mePayload?.data ?? mePayload?.user ?? mePayload;
      const userId = me?._id ?? me?.id ?? me?.sub;
      if (!userId) {
        setWorkshops([]);
        return;
      }
      const res = await api(`/workshop/professor/${userId}`);
      let payload = res;
      if (res && typeof res.json === 'function') payload = await res.json();
      const list = payload?.data ?? (Array.isArray(payload) ? payload : []);
      setWorkshops(Array.isArray(list) ? list : []);

      // Fetch workshop requests for each workshop
      if (Array.isArray(list) && list.length > 0) {
        fetchWorkshopRequests(list);
      }
    } catch (err) {
      console.error("Error fetching workshops:", err);
      showToast("error", "Failed to load workshops", "Check console for details.");
    } finally {
      setLoading(false);
    }
  };

  const fetchWorkshopRequests = async (workshopList) => {
    try {
      const requestsMap = {};
      for (const workshop of workshopList) {
        try {
          const res = await api(`/workshopRequests?workshop=${workshop._id}`);
          let payload = res;
          if (res && typeof res.json === 'function') payload = await res.json();
          const requests = payload?.data ?? (Array.isArray(payload) ? payload : []);
          if (requests.length > 0) {
            // Get the most recent request
            requestsMap[workshop._id] = requests[0];
          }
        } catch (err) {
          console.error(`Failed to fetch request for workshop ${workshop._id}:`, err);
        }
      }
      setWorkshopRequests(requestsMap);
    } catch (err) {
      console.error("Error fetching workshop requests:", err);
    }
  };

  useEffect(() => {
    fetchWorkshops();
    fetchProfessors();
  }, []);

  const handleInput = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleResourceChange = (index, field, value) => {
    const updatedResources = [...formData.extraRequiredResources];
    updatedResources[index][field] = value;
    setFormData({ ...formData, extraRequiredResources: updatedResources });
  };

  const handleProfessorChange = (index, field, value) => {
    setFormData((prev) => {
      const updated = [...prev.professors];
      updated[index] = { ...updated[index], [field]: value };
      return { ...prev, professors: updated };
    });
  };

  const addResource = () => {
    setFormData({
      ...formData,
      extraRequiredResources: [
        ...formData.extraRequiredResources,
        { resourceName: "", quantity: 1 },
      ],
    });
  };

  const addProfessor = () => {
    setFormData((prev) => ({
      ...prev,
      professors: [...prev.professors, { id: "", contribution: "" }],
    }));
  };

  const removeProfessor = (index) => {
    setFormData((prev) => ({
      ...prev,
      professors: prev.professors.filter((_, i) => i !== index),
    }));
  };

  const removeResource = (index) => {
    const updatedResources = formData.extraRequiredResources.filter((_, i) => i !== index);
    setFormData({ ...formData, extraRequiredResources: updatedResources });
  };

  const nextStep = () => setStep((s) => Math.min(s + 1, 4));
  const prevStep = () => setStep((s) => Math.max(s - 1, 1));

  const openCreateModal = () => {
    setFormData({
      name: "",
      location: "GUC Cairo",
      description: "",
      registrationDeadline: "",
      startDateTime: "",
      endDateTime: "",
      faculty: "MET",
      budget: "",
      fundingSource: "GUC",
      capacity: "",
      fullAgenda: "",
      professors: [{ id: "", contribution: "" }],
      extraRequiredResources: [{ resourceName: "", quantity: 1 }],
    });
    setStep(1);
    setEditMode(false);
    setShowModal(true);
  };

  const openEditModal = (workshop) => {
    setFormData({
      name: workshop.name || "",
      location: workshop.location || "GUC Cairo",
      description: workshop.description || "",
      registrationDeadline: workshop.registrationDeadline?.slice(0, 16) || "",
      startDateTime: workshop.startDateTime?.slice(0, 16) || "",
      endDateTime: workshop.endDateTime?.slice(0, 16) || "",
      faculty: workshop.faculty || "MET",
      budget: workshop.budget || "",
      price: workshop.price ?? "",
      fundingSource: workshop.fundingSource || "GUC",
      capacity: workshop.capacity || "",
      fullAgenda: workshop.fullAgenda || "",
      professors: workshop.professors?.length
        ? workshop.professors.map((p) =>
          typeof p === "string" || p instanceof String
            ? { id: p, contribution: "" }
            : { id: p._id || p.id || "", contribution: p.contribution || "" }
        )
        : [{ id: "", contribution: "" }],
      extraRequiredResources: workshop.extraRequiredResources || [{ resourceName: "", quantity: 1 }],
    });
    setSelectedWorkshopId(workshop._id);
    setStep(1);
    setEditMode(true);
    setShowModal(true);
  };

  const handleSubmit = async () => {
    try {
      if (!editMode) {
        formData.startDateTime = convertToUTC(formData.startDateTime);
        formData.endDateTime = convertToUTC(formData.endDateTime);
        formData.registrationDeadline = convertToUTC(formData.registrationDeadline);
      }

      const payload = {
        ...formData,
        eventType: "workshop",
        professors: (formData.professors || []).map((p) => p.id || p._id || p).filter(Boolean),
        extraRequiredResources: formData.extraRequiredResources.map(({ resourceName, quantity }) => ({ resourceName, quantity })),
      };

      const path = editMode ? `/workshop/${selectedWorkshopId}` : "/workshop";
      const method = editMode ? "PATCH" : "POST";
      const result = await api(path, { method, body: payload });

      if (result && typeof result.ok === "boolean") {
        if (result.ok) {
          showToast("success", editMode ? "Workshop updated" : "Workshop created", editMode ? "Updated successfully." : "Created successfully.");
          setShowModal(false);
          fetchWorkshops();
        } else {
          const errText = await result.text().catch(() => "Server responded with an error.");
          showToast("error", "Failed to submit workshop", errText);
        }
      } else {
        if (result && (result.status === "success" || result.data)) {
          showToast("success", editMode ? "Workshop updated" : "Workshop created", editMode ? "Updated successfully." : "Created successfully.");
          setShowModal(false);
          fetchWorkshops();
        } else {
          showToast("error", "Failed to submit workshop", result?.message || JSON.stringify(result || "Unknown error"));
        }
      }
    } catch (err) {
      showToast("error", "Error submitting form", err.message || "Check console for details.");
      setShowModal(false);
    }
  };

  const requestDelete = (id, name) => {
    setConfirmPayload({
      id,
      message: `Are you sure you want to delete the workshop "${name}"? This action cannot be undone.`,
      onConfirm: () => performDelete(id),
    });
    setConfirmOpen(true);
  };

  const performDelete = async (id) => {
    setConfirmOpen(false);
    setConfirmPayload(null);
    try {
      const result = await api(`/event/${id}`, { method: "DELETE" });
      if (result && typeof result.ok === "boolean") {
        if (result.ok) {
          showToast("success", "Workshop deleted", "The workshop was deleted successfully.");
          fetchWorkshops();
        } else {
          const errMsg = await result.text().catch(() => "Server responded with an error.");
          showToast("error", "Failed to delete workshop", errMsg);
        }
      } else {
        if (result && result.status === "success") {
          showToast("success", "Workshop deleted", "The workshop was deleted successfully.");
          fetchWorkshops();
        } else {
          showToast("error", "Failed to delete workshop", result?.message || JSON.stringify(result || "Unknown error"));
        }
      }
    } catch (err) {
      showToast("error", "Error deleting workshop", err.message || "Check console for details.");
    }
  };

  const openDetailsModal = async (workshop) => {
    const w = { ...workshop };
    if (Array.isArray(w.professors) && w.professors.length > 0) {
      const resolved = await Promise.all(
        w.professors.map(async (p) => {
          if (!p) return p;
          if (typeof p === "string" || typeof p === "number") {
            const prof = await fetchProfessorById(String(p));
            return prof ? { _id: prof._id || prof.id || String(p), fullName: prof.fullName || prof.name || prof.email, email: prof.email || "" } : { _id: String(p) };
          }
          if (p._id && (p.fullName || p.name)) return p;
          const prof = await fetchProfessorById(p._id || p.id);
          return prof ? { _id: prof._id || prof.id, fullName: prof.fullName || prof.name || prof.email, email: prof.email || "", contribution: p.contribution } : p;
        })
      );
      w.professors = resolved;
    }

    setSelectedWorkshop(w);
    setShowDetailsModal(true);
  };

  const closeDetailsModal = () => {
    setShowDetailsModal(false);
    setSelectedWorkshop(null);
  };

  const openParticipantsModal = async (workshop) => {
    setSelectedWorkshop(workshop);
    setShowParticipantsModal(true);
    setLoadingParticipants(true);

    try {
      const res = await api(`/workshop/${workshop._id}/participants`);
      let payload = res;
      if (res && typeof res.json === 'function') payload = await res.json();

      if (payload && payload.status === 'success') {
        setParticipants(payload.data?.participants || []);
        setParticipantsStats(payload.data?.stats || null);
      } else {
        showToast('error', 'Failed to load participants', payload?.message || '');
        setParticipants([]);
        setParticipantsStats(null);
      }
    } catch (err) {
      showToast('error', 'Error loading participants', err.message || 'Check console for details.');
      setParticipants([]);
      setParticipantsStats(null);
    } finally {
      setLoadingParticipants(false);
    }
  };

  const closeParticipantsModal = () => {
    setShowParticipantsModal(false);
    setSelectedWorkshop(null);
    setParticipants([]);
    setParticipantsStats(null);
  };

  const fetchProfessorById = async (id) => {
    if (!id) return null;
    try {
      const res = await api(`/public/professors/${id}`);
      let payload = res;
      if (res && typeof res.json === 'function') payload = await res.json();
      return payload?.data ?? (Array.isArray(payload) ? payload[0] : payload) ?? null;
    } catch (err) {
      console.error("Failed to fetch professor", id, err);
      return null;
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen text-root-secondary bg-root">
        Loading workshops...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-root px-6 py-10 text-root-secondary">
      {toastState && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50">
          <Toast
            key={Date.now()}
            message={toastState.message}
            type={toastState.type}
            duration={4000}
            onClose={() => setToastState(null)}
          />
        </div>
      )}

      <h1 className="text-3xl font-bold text-center mb-10 text-root-primary">Workshops</h1>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-8">
        {workshops.map((workshop) => {
          const request = workshopRequests[workshop._id];
          const statusColors = {
            pending: 'bg-yellow-500 text-white',
            accepted: 'bg-green-500 text-white',
            rejected: 'bg-red-500 text-white',
            edit_required: 'bg-orange-500 text-white',
          };
          const statusLabels = {
            pending: 'Pending',
            accepted: 'Accepted',
            rejected: 'Rejected',
            edit_required: 'Edit Required',
          };

          return (
            <div
              key={workshop._id}
              onMouseEnter={() => setHoveredCard(workshop._id)}
              onMouseLeave={() => setHoveredCard(null)}
              className={
                (hoveredCard === workshop._id
                  ? "bg-primary text-root-primary"
                  : "bg-surface text-root-secondary") +
                " border border-root rounded-2xl p-6 hover:shadow-elevated transition-colors duration-300 flex flex-col justify-between cursor-pointer relative"
              }
            >
              <div>
                {/* Status Label Badge */}
                {request && (
                  <div className="mb-3">
                    <div
                      className={`inline-block px-3 py-1 rounded-lg text-xs font-semibold ${statusColors[request.status] || 'bg-gray-500 text-white'} shadow-md`}
                    >
                      {statusLabels[request.status] || request.status}
                    </div>
                    {/* Show comment/edits required if available */}
                    {request.comment && (
                      <div className="mt-2 p-3 bg-surface border border-root rounded-lg">
                        <p className="text-xs font-semibold text-root-primary mb-1">
                          {request.status === 'edit_required' ? 'Edits Required:' :
                            request.status === 'rejected' ? 'Rejection Reason:' : 'Comment:'}
                        </p>
                        <p className="text-sm text-root-secondary">{request.comment}</p>
                      </div>
                    )}
                  </div>
                )}

                <div className="flex justify-between items-center mb-3">
                  <h2 className="text-xl font-semibold text-root-primary">
                    {workshop.name}
                  </h2>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => openEditModal(workshop)}
                      className="text-root-secondary hover:text-root-primary transition cursor-pointer"
                      title="Edit Workshop"
                    >
                      <FaEdit size={22} />
                    </button>
                    <button
                      onClick={() => requestDelete(workshop._id, workshop.name)}
                      className="text-error hover:opacity-90 transition cursor-pointer"
                      title="Delete Workshop"
                    >
                      <FaTrash size={22} />
                    </button>
                  </div>
                </div>

                <p className="text-root-secondary text-sm mb-5 line-clamp-3">
                  {workshop.description}
                </p>

                <div className="flex items-center text-root-secondary text-sm mb-2">
                  <FaMapMarkerAlt className="mr-2 text-root-secondary" />
                  {workshop.location}
                </div>

                <div className="flex items-center text-root-secondary text-sm mb-2">
                  <FaCalendarAlt className="mr-2 text-root-secondary" />
                  {new Date(workshop.startDateTime).toLocaleDateString()} — {new Date(workshop.endDateTime).toLocaleDateString()}
                </div>

                <div className="flex items-center text-root-secondary text-sm mb-2">
                  <FaClock className="mr-2 text-root-secondary" />
                  {new Date(workshop.startDateTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} - {new Date(workshop.endDateTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </div>

                <div className="flex items-center text-root-secondary text-sm mb-4">
                  <FaUsers className="mr-2 text-root-secondary" />
                  Capacity: {workshop.capacity}
                </div>
              </div>

              <div className="space-y-2">
                <ViewDetailsButton onClick={() => openDetailsModal(workshop)} />
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    openParticipantsModal(workshop);
                  }}
                  className="w-full px-4 py-2 bg-surface border border-root text-root-primary rounded-lg hover:bg-primary hover:text-root-primary transition-colors text-sm font-medium"
                >
                  View Participants
                </button>
              </div>
            </div>
          );
        })}

        <div
          onMouseEnter={() => setHoveredCard("create")}
          onMouseLeave={() => setHoveredCard(null)}
          onClick={openCreateModal}
          className={
            (hoveredCard === "create" ? "bg-primary text-root-primary" : "bg-surface text-root-secondary") +
            " border-2 border-dashed border-root hover:opacity-90 rounded-2xl p-6 flex flex-col items-center justify-center text-center cursor-pointer transition-colors duration-300"
          }
        >
          <FaPlus className="text-4xl mb-2 text-root-primary" />
          <p className="text-root-primary font-medium">Create New Workshop</p>
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50">
          <div className="bg-surface border border-root rounded-2xl p-8 w-full max-w-3xl relative text-root-primary max-h-[90vh] min-h-[90vh] overflow-y-auto flex flex-col">
            <h2 className="text-2xl font-semibold text-center mb-6">
              {editMode ? `Edit Workshop (Step ${step}/4)` : `Create Workshop (Step ${step}/4)`}
            </h2>

            {step === 1 && (
              <div className="space-y-4">
                <label className="block text-sm text-root-secondary">Workshop Name</label>
                <input type="text" name="name" value={formData.name} onChange={handleInput} className="w-full input-surface p-2 rounded" />
                <label className="block text-sm text-root-secondary">Description</label>
                <textarea name="description" value={formData.description} onChange={handleInput} className="w-full input-surface p-2 rounded" />
                <label className="block text-sm text-root-secondary">Location</label>
                <select name="location" value={formData.location} onChange={handleInput} className="w-full input-surface p-2 rounded">
                  <option>GUC Cairo</option>
                  <option>GUC Berlin</option>
                </select>
                <label className="block text-sm text-root-secondary">Start Date & Time</label>
                <input type="datetime-local" name="startDateTime" value={formData.startDateTime} onChange={handleInput} className="w-full input-surface p-2 rounded" />
                <label className="block text-sm text-root-secondary">End Date & Time</label>
                <input type="datetime-local" name="endDateTime" value={formData.endDateTime} onChange={handleInput} className="w-full input-surface p-2 rounded" />
                <label className="block text-sm text-root-secondary">Registration Deadline</label>
                <input type="datetime-local" name="registrationDeadline" value={formData.registrationDeadline} onChange={handleInput} className="w-full input-surface p-2 rounded" />
              </div>
            )}

            {step === 2 && (
              <div className="space-y-4">
                <label className="block text-sm text-root-secondary">Capacity</label>
                <input type="number" name="capacity" value={formData.capacity} onChange={handleInput} className="w-full input-surface p-2 rounded" />
                <label className="block text-sm text-root-secondary">Budget</label>
                <input type="number" name="budget" value={formData.budget} onChange={handleInput} className="w-full input-surface p-2 rounded" />
                <label className="block text-sm text-root-secondary">Price</label>
                <input type="number" name="price" value={formData.price} onChange={handleInput} className="w-full input-surface p-2 rounded" />
                <label className="block text-sm text-root-secondary">Funding Source</label>
                <select name="fundingSource" value={formData.fundingSource} onChange={handleInput} className="w-full input-surface p-2 rounded">
                  <option>GUC</option>
                  <option>External</option>
                </select>
                <label className="block text-sm font-medium text-root-secondary mt-4">Full Agenda</label>
                <textarea name="fullAgenda" value={formData.fullAgenda} onChange={handleInput} rows={5} placeholder="e.g. 09:30 - Intro to Robotics..." className="w-full input-surface p-2 rounded mt-1" />
              </div>
            )}

            {step === 3 && (
              <div className="space-y-4">
                <label className="block text-sm font-medium text-root-secondary">Extra Required Resources</label>
                {formData.extraRequiredResources.map((res, index) => (
                  <div key={index} className="flex items-center gap-2 input-surface p-2 rounded">
                    <input type="text" placeholder="Resource Name" value={res.resourceName} onChange={(e) => handleResourceChange(index, "resourceName", e.target.value)} className="flex-1 bg-transparent text-root-primary p-1" />
                    <input type="number" min="1" value={res.quantity} onChange={(e) => handleResourceChange(index, "quantity", e.target.value)} className="w-20 bg-transparent text-root-primary p-1" />
                    <button onClick={() => removeResource(index)} className="text-error hover:opacity-90"><FaTrash /></button>
                  </div>
                ))}
                <button onClick={addResource} className="px-3 py-1 bg-primary text-root-primary rounded hover:opacity-90 flex items-center gap-1"><FaPlus /> Add Resource</button>
              </div>
            )}

            {step === 4 && (
              <div className="space-y-5">
                <label className="block text-sm font-medium text-root-secondary">Professors</label>
                {formData.professors.map((prof, index) => (
                  <div key={index} className="flex flex-wrap gap-2 input-surface p-2 rounded items-center">
                    <select
                      value={prof.id || ""}
                      onChange={(e) => handleProfessorChange(index, "id", e.target.value)}
                      className="flex-1 input-surface p-1 rounded"
                    >
                      <option value="">Select professor</option>
                      {professorsList.map((u) => (
                        <option key={u._id} value={u._id}>
                          {u.fullName || u.name || u.email}{u.department ? ` — ${u.department}` : ""}
                        </option>
                      ))}
                    </select>
                    <input
                      type="text"
                      placeholder="Contribution (optional)"
                      value={prof.contribution || ""}
                      onChange={(e) => handleProfessorChange(index, "contribution", e.target.value)}
                      className="flex-1 input-surface p-1 rounded"
                    />
                    <button onClick={() => removeProfessor(index)} className="text-error hover:opacity-90"><FaTrash /></button>
                  </div>
                ))}
                <label className="block text-sm text-root-secondary">Faculty</label>
                <select name="faculty" value={formData.faculty} onChange={handleInput} className="w-full input-surface p-2 rounded">
                  <option>MET</option>
                  <option>IET</option>
                  <option>EMS</option>
                  <option>MBA</option>
                  <option>MGT</option>
                  <option>LAW</option>
                </select>
                <button onClick={addProfessor} className="px-3 py-1 bg-primary text-root-primary rounded hover:opacity-90 flex items-center gap-1"><FaPlus /> Add Professor</button>
              </div>
            )}

            <div className="flex justify-between mt-auto pt-6">
              <button onClick={() => { setShowModal(false); setStep(1); }} className="px-4 py-2 rounded input-surface hover:opacity-80">Cancel</button>
              <div className="space-x-3">
                {step > 1 && <button onClick={prevStep} className="px-4 py-2 rounded input-surface hover:opacity-80">Back</button>}
                {step < 4 ? (
                  <button onClick={nextStep} className="px-4 py-2 rounded bg-primary text-root-primary font-medium hover:opacity-90">Next</button>
                ) : (
                  <button onClick={handleSubmit} className="px-4 py-2 rounded bg-primary text-root-primary font-medium hover:opacity-90">{editMode ? "Save Changes" : "Submit"}</button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {showDetailsModal && selectedWorkshop && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50">
          <div className="bg-surface border border-root rounded-2xl p-6 w-full max-w-xl text-root-primary max-h-[85vh] overflow-y-auto" role="dialog" aria-modal="true" aria-labelledby="workshop-details-title">
            <div className="flex justify-between items-start">
              <h2 id="workshop-details-title" className="text-2xl font-semibold mb-2">{selectedWorkshop.name}</h2>
            </div>

            <p className="text-root-secondary mb-3">{selectedWorkshop.description}</p>

            <div className="flex items-center text-root-secondary text-sm mb-2">
              <FaCalendarAlt className="mr-2 text-root-secondary" />
              <span>Schedule: {selectedWorkshop.startDateTime && selectedWorkshop.endDateTime ? `${new Date(selectedWorkshop.startDateTime).toLocaleString()} — ${new Date(selectedWorkshop.endDateTime).toLocaleString()}` : "N/A"}</span>
            </div>

            <div className="flex items-center text-root-secondary text-sm mb-2">
              <FaMapMarkerAlt className="mr-2 text-root-secondary" />
              <span>{selectedWorkshop.location || "N/A"}</span>
            </div>

            <div className="flex items-center text-root-secondary text-sm mb-2">
              <FaUsers className="mr-2 text-root-secondary" />
              <span>Capacity: {selectedWorkshop.capacity ?? "N/A"}</span>
            </div>

            <div className="flex items-center text-root-secondary text-sm mb-2">
              <span className="mr-2 text-root-secondary font-medium">Faculty:</span>
              <span>{selectedWorkshop.faculty || "N/A"}</span>
            </div>

            <div className="flex items-center text-root-secondary text-sm mb-2">
              <span className="mr-2 text-root-secondary font-medium">Budget:</span>
              <span>{selectedWorkshop.budget ?? "N/A"}</span>
              <span className="ml-3 text-root-secondary">({selectedWorkshop.fundingSource || "N/A"})</span>
            </div>

            <div className="flex items-center text-root-secondary text-sm mb-2">
              <span className="mr-2 text-root-secondary font-medium">Price:</span>
              <span>{selectedWorkshop.price != null ? selectedWorkshop.price : "N/A"}</span>
            </div>

            <div className="mt-4">
              <div className="text-sm font-medium text-root-secondary mb-1">Full Agenda</div>
              <pre className="whitespace-pre-wrap input-surface p-3 rounded text-sm text-root-primary">{selectedWorkshop.fullAgenda || "No agenda."}</pre>
            </div>

            <div className="mt-4">
              <div className="text-sm font-medium text-root-secondary mb-1">Professors</div>
              {selectedWorkshop.professors?.length > 0 ? (
                <ul className="list-disc ml-6 text-sm text-root-secondary">
                  {selectedWorkshop.professors.map((p, idx) => (
                    <li key={idx} className="mb-1">
                      <span className="text-root-primary font-medium">{p.fullName || "Unnamed"}</span>
                      {p.contribution ? <span className="ml-2 text-root-secondary">— {p.contribution}</span> : null}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-root-secondary">No professors listed.</p>
              )}
            </div>

            <div className="mt-4">
              <div className="text-sm font-medium text-root-secondary mb-1">Extra Required Resources</div>
              {selectedWorkshop.extraRequiredResources?.length > 0 ? (
                <ul className="list-disc ml-6 text-sm text-root-secondary">
                  {selectedWorkshop.extraRequiredResources.map((r, idx) => (
                    <li key={idx}>{r.resourceName || "Unnamed resource"} (x{r.quantity ?? 1})</li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-root-secondary">No extra resources.</p>
              )}
            </div>

            <div className="mt-6 flex justify-end">
              <button onClick={closeDetailsModal} className="px-4 py-2 rounded bg-primary text-root-primary font-medium hover:opacity-90">Close</button>
            </div>
          </div>
        </div>
      )}

      {showParticipantsModal && selectedWorkshop && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50">
          <div className="bg-surface border border-root rounded-2xl p-6 w-full max-w-4xl text-root-primary max-h-[85vh] overflow-y-auto">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h2 className="text-2xl font-semibold text-white">{selectedWorkshop.name}</h2>
                <p className="text-gray-300 text-sm mt-1">Workshop Participants</p>
              </div>
              <button
                onClick={closeParticipantsModal}
                className="text-gray-400 hover:text-white transition"
              >
                ✕
              </button>
            </div>

            {loadingParticipants ? (
              <div className="text-center py-12">
                <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-root-border border-t-root-primary"></div>
                <p className="mt-4 text-white">Loading participants...</p>
              </div>
            ) : (
              <>
                {/* Stats Section */}
                {participantsStats && (
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                    <div className="bg-root-highlight p-4 rounded-lg border border-root-border">
                      <div className="text-2xl font-bold text-white">{participantsStats.totalCapacity}</div>
                      <div className="text-sm text-gray-300">Total Capacity</div>
                    </div>
                    <div className="bg-root-highlight p-4 rounded-lg border border-root-border">
                      <div className="text-2xl font-bold text-green-400">{participantsStats.registered}</div>
                      <div className="text-sm text-gray-300">Registered</div>
                    </div>
                    <div className="bg-root-highlight p-4 rounded-lg border border-root-border">
                      <div className="text-2xl font-bold text-blue-400">{participantsStats.remainingSpots}</div>
                      <div className="text-sm text-gray-300">Remaining Spots</div>
                    </div>
                    <div className="bg-root-highlight p-4 rounded-lg border border-root-border">
                      <div className="text-2xl font-bold text-purple-400">{participantsStats.percentFull}%</div>
                      <div className="text-sm text-gray-300">Full</div>
                    </div>
                  </div>
                )}

                {/* Participants List */}
                {participants.length === 0 ? (
                  <div className="text-center py-12 bg-root-highlight rounded-lg border border-root-border">
                    <FaUsers className="mx-auto text-4xl text-gray-500 mb-3" />
                    <p className="text-white text-lg">No participants registered yet</p>
                    <p className="text-gray-400 text-sm mt-1">Participants will appear here once they register</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-root-surface border-b border-root-border">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">#</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">Name</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">Email</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">Registered</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-root-border">
                        {participants.map((participant, index) => (
                          <tr key={participant._id} className="hover:bg-root-surface transition-colors">
                            <td className="px-4 py-3 text-sm text-gray-300">{index + 1}</td>
                            <td className="px-4 py-3">
                              <div className="text-sm font-medium text-white">{participant.name || 'N/A'}</div>
                            </td>
                            <td className="px-4 py-3">
                              <div className="text-sm text-gray-300">{participant.email || 'N/A'}</div>
                            </td>
                            <td className="px-4 py-3">
                              <div className="text-sm text-gray-300">
                                {participant.registeredAt ? new Date(participant.registeredAt).toLocaleDateString() : 'N/A'}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                <div className="mt-6 flex justify-end">
                  <button
                    onClick={closeParticipantsModal}
                    className="px-4 py-2 rounded bg-primary text-root-primary font-medium hover:opacity-90"
                  >
                    Close
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {confirmOpen && confirmPayload && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-60">
          <div className="confirm-modal bg-surface border border-root rounded-2xl p-6 w-full max-w-md text-root-primary transform transition-all shadow-elevated">
            <h3 className="text-lg font-semibold mb-3">Confirm Delete</h3>
            <p className="text-sm text-root-secondary mb-5">{confirmPayload.message}</p>
            <div className="flex justify-end gap-3">
              <button onClick={() => { setConfirmOpen(false); setConfirmPayload(null); }} className="px-4 py-2 rounded input-surface hover:opacity-80">Cancel</button>
              <button onClick={() => { confirmPayload.onConfirm && confirmPayload.onConfirm(); }} className="px-4 py-2 rounded bg-error text-root-primary hover:opacity-90">Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
