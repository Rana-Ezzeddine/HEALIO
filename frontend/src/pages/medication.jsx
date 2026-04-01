import { useCallback, useEffect, useMemo, useState } from "react";
import Navbar from "../components/Navbar";
import { Clock, Pill, Plus, Search, X } from "lucide-react";
import { apiUrl, authHeaders } from "../api/http";
import { getMedicationFilterOptions, searchAndFilterMedications } from "../api/search";
import { formatDoseTime, getNextMedicationDose, getScheduleTimes, isActiveMedication } from "../utils/medicationSchedule";

function parseScheduleInput(value) {
  const times = String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

  return { times };
}

function formatScheduleInput(scheduleJson, frequency) {
  const times = getScheduleTimes({ scheduleJson, frequency });
  return times.join(", ");
}

function getMedicationWarnings(medication) {
  const warnings = [];
  if (!medication.endDate) return warnings;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const endDate = new Date(`${medication.endDate}T00:00:00`);
  const diffDays = Math.ceil((endDate - today) / (1000 * 60 * 60 * 24));

  if (diffDays < 0) warnings.push("Medication end date already passed.");
  else if (diffDays <= 3) warnings.push(`Ends in ${diffDays} day${diffDays === 1 ? "" : "s"}.`);
  else if (diffDays <= 7) warnings.push(`Refill or review soon: ends in ${diffDays} days.`);

  return warnings;
}

function getLatestAdherenceStatus(medication) {
  const entry = Array.isArray(medication.adherenceHistory) ? medication.adherenceHistory[0] : null;
  return entry?.status || null;
}

function formatAdherenceLabel(status) {
  if (status === "taken") return "Taken";
  if (status === "missed") return "Missed";
  if (status === "skipped") return "Skipped";
  if (status === "delayed") return "Delayed";
  return status || "Unknown";
}

function getAdherenceTone(status) {
  if (status === "taken") return "bg-emerald-100 text-emerald-700";
  if (status === "missed") return "bg-rose-100 text-rose-700";
  if (status === "skipped") return "bg-amber-100 text-amber-700";
  if (status === "delayed") return "bg-indigo-100 text-indigo-700";
  return "bg-slate-100 text-slate-700";
}

function summarizeAdherence(medications) {
  const counts = { taken: 0, missed: 0, skipped: 0, delayed: 0 };
  for (const medication of medications) {
    const history = Array.isArray(medication.adherenceHistory) ? medication.adherenceHistory : [];
    for (const entry of history) {
      if (counts[entry.status] != null) {
        counts[entry.status] += 1;
      }
    }
  }
  return counts;
}

function getRecentAdherenceEntries(medications) {
  return medications
    .flatMap((medication) =>
      (Array.isArray(medication.adherenceHistory) ? medication.adherenceHistory : []).map((entry, index) => ({
        key: `${medication.id}-${entry.recordedAt || index}-${entry.status}`,
        medicationName: medication.name,
        ...entry,
      }))
    )
    .sort((left, right) => new Date(right.recordedAt || right.scheduledFor) - new Date(left.recordedAt || left.scheduledFor))
    .slice(0, 8);
}

function getNextDoseForMedication(medication) {
  return getNextMedicationDose([medication]);
}

export default function MedicationManager() {
  const [medications, setMedications] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingMed, setEditingMed] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [doctorFilter, setDoctorFilter] = useState("");
  const [frequencyFilter, setFrequencyFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [sortBy, setSortBy] = useState("createdAt");
  const [sortOrder, setSortOrder] = useState("DESC");
  const [filterOptions, setFilterOptions] = useState({ doctors: [], frequencies: [] });
  const [error, setError] = useState("");
  const [formData, setFormData] = useState({
    name: "",
    dosage: "",
    frequency: "",
    prescribedBy: "",
    startDate: "",
    endDate: "",
    notes: "",
    scheduleTimes: "08:00",
    reminderEnabled: true,
    reminderLeadMinutes: 30,
  });

  const fetchMedicationFilterOptions = useCallback(async () => {
    try {
      const data = await getMedicationFilterOptions();
      setFilterOptions({
        doctors: data.doctors || [],
        frequencies: data.frequencies || [],
      });
    } catch (loadError) {
      console.error(loadError);
    }
  }, []);

  const fetchMedications = useCallback(async () => {
    try {
      const data = await searchAndFilterMedications({
        q: searchTerm,
        prescribedBy: doctorFilter,
        frequency: frequencyFilter,
        status: statusFilter,
        sortBy,
        sortOrder,
      });
      setMedications(data.medications || []);
      setError("");
    } catch (loadError) {
      console.error(loadError);
      setMedications([]);
      setError(loadError.message || "Failed to load medications.");
    }
  }, [doctorFilter, frequencyFilter, searchTerm, sortBy, sortOrder, statusFilter]);

  useEffect(() => {
    fetchMedicationFilterOptions();
  }, [fetchMedicationFilterOptions]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      fetchMedications();
    }, 250);

    return () => window.clearTimeout(timeoutId);
  }, [fetchMedications]);

  function openModal(medication = null) {
    if (medication) {
      setEditingMed(medication);
      setFormData({
        ...medication,
        scheduleTimes: formatScheduleInput(medication.scheduleJson, medication.frequency),
        reminderEnabled: medication.reminderEnabled !== false,
        reminderLeadMinutes: medication.reminderLeadMinutes ?? 30,
      });
    } else {
      setEditingMed(null);
      setFormData({
        name: "",
        dosage: "",
        frequency: "",
        prescribedBy: "",
        startDate: "",
        endDate: "",
        notes: "",
        scheduleTimes: "08:00",
        reminderEnabled: true,
        reminderLeadMinutes: 30,
      });
    }
    setIsModalOpen(true);
  }

  function closeModal() {
    setIsModalOpen(false);
    setEditingMed(null);
  }

  async function handleSubmit(event) {
    event.preventDefault();
    const payload = {
      name: formData.name,
      dosage: formData.dosage,
      frequency: formData.frequency,
      prescribedBy: formData.prescribedBy,
      startDate: formData.startDate,
      endDate: formData.endDate,
      notes: formData.notes,
      scheduleJson: parseScheduleInput(formData.scheduleTimes),
      reminderEnabled: Boolean(formData.reminderEnabled),
      reminderLeadMinutes: Number(formData.reminderLeadMinutes || 0),
      adherenceHistory: editingMed?.adherenceHistory || [],
    };

    try {
      const response = await fetch(
        `${apiUrl}/api/medications${editingMed ? `/${editingMed.id}` : ""}`,
        {
          method: editingMed ? "PUT" : "POST",
          headers: { "Content-Type": "application/json", ...authHeaders() },
          body: JSON.stringify(payload),
        }
      );

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data?.error || data?.message || "Failed to save medication.");
      }

      closeModal();
      await fetchMedicationFilterOptions();
      await fetchMedications();
    } catch (saveError) {
      alert(saveError.message || "Failed to save medication.");
    }
  }

  async function deleteMedication(id) {
    if (!window.confirm("Are you sure you want to delete this medication?")) return;

    try {
      const response = await fetch(`${apiUrl}/api/medications/${id}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json", ...authHeaders() },
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data?.error || data?.message || "Failed to delete medication.");
      }

      await fetchMedicationFilterOptions();
      await fetchMedications();
    } catch (deleteError) {
      alert(deleteError.message || "Failed to delete medication.");
    }
  }

  async function logAdherence(medication, status) {
    const scheduledFor = getNextDoseForMedication(medication)?.at?.toISOString() || new Date().toISOString();
    const delayMinutes =
      status === "delayed" ? Number(window.prompt("Delay by how many minutes?", "30") || "0") : undefined;
    const notesPrompt =
      status === "missed"
        ? "Why was this dose missed? (optional)"
        : status === "skipped"
        ? "Why was this dose skipped? (optional)"
        : status === "delayed"
        ? "Add a note for this delayed dose. (optional)"
        : "Add a note for this dose. (optional)";
    const notes = window.prompt(notesPrompt, "") || "";

    try {
      const response = await fetch(`${apiUrl}/api/medications/${medication.id}/adherence`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({
          status,
          scheduledFor,
          delayMinutes,
          notes,
        }),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data?.error || data?.message || "Failed to save adherence status.");
      }

      await fetchMedications();
    } catch (adherenceError) {
      alert(adherenceError.message || "Failed to save adherence status.");
    }
  }

  const nextDose = useMemo(() => getNextMedicationDose(medications), [medications]);
  const nextDoseText = nextDose
    ? `${nextDose.medication?.name || "Medication"} at ${formatDoseTime(nextDose.at)}`
    : "No upcoming doses";

  const dueSoon = useMemo(() => {
    const now = new Date();
    return medications
      .filter((medication) => isActiveMedication(medication, now))
      .map((medication) => ({ medication, dose: getNextDoseForMedication(medication) }))
      .filter((item) => item.dose && item.dose.at.getTime() - now.getTime() <= (item.medication.reminderLeadMinutes ?? 30) * 60 * 1000)
      .slice(0, 3);
  }, [medications]);

  const warnings = useMemo(
    () =>
      medications
        .flatMap((medication) => getMedicationWarnings(medication).map((warning) => ({ medication, warning })))
        .slice(0, 5),
    [medications]
  );
  const adherenceSummary = useMemo(() => summarizeAdherence(medications), [medications]);
  const recentAdherenceEntries = useMemo(() => getRecentAdherenceEntries(medications), [medications]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-sky-50 via-white to-indigo-50 p-6">
      <Navbar />

      <div className="mx-auto max-w-6xl pt-20">
        <section className="rounded-[2rem] bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="flex items-center gap-3">
                <Pill className="text-sky-500" size={24} />
                <h1 className="text-3xl font-bold text-slate-900">Medication Management</h1>
              </div>
              <p className="mt-2 text-sm text-slate-600">
                Track medications, log taken or missed doses, and keep reminders and end-date warnings visible.
              </p>
            </div>
            <button
              onClick={() => openModal()}
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-sky-500 px-4 py-3 font-medium text-white shadow-md transition hover:bg-sky-600"
            >
              <Plus size={20} />
              Add Medication
            </button>
          </div>

          <div className="mt-5 grid gap-4 lg:grid-cols-3">
            <div className="rounded-3xl bg-sky-50 p-5">
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-indigo-100">
                  <Clock className="text-indigo-600" />
                </div>
                <div>
                  <p className="text-sm text-slate-600">Next Dose</p>
                  <p className="text-lg font-semibold text-slate-900">{nextDoseText}</p>
                </div>
              </div>
            </div>
            <div className="rounded-3xl bg-amber-50 p-5">
              <p className="text-sm text-slate-600">Reminders due soon</p>
              <p className="mt-1 text-2xl font-bold text-slate-900">{dueSoon.length}</p>
              <p className="mt-2 text-sm text-slate-600">Visible from each medication schedule.</p>
            </div>
            <div className="rounded-3xl bg-rose-50 p-5">
              <p className="text-sm text-slate-600">Warnings</p>
              <p className="mt-1 text-2xl font-bold text-slate-900">{warnings.length}</p>
              <p className="mt-2 text-sm text-slate-600">Refill and end-date issues needing attention.</p>
            </div>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-4">
            {[
              { key: "taken", label: "Taken", value: adherenceSummary.taken, tone: "bg-emerald-50 text-emerald-700" },
              { key: "missed", label: "Missed", value: adherenceSummary.missed, tone: "bg-rose-50 text-rose-700" },
              { key: "skipped", label: "Skipped", value: adherenceSummary.skipped, tone: "bg-amber-50 text-amber-700" },
              { key: "delayed", label: "Delayed", value: adherenceSummary.delayed, tone: "bg-indigo-50 text-indigo-700" },
            ].map((item) => (
              <div key={item.key} className={`rounded-3xl p-5 ${item.tone}`}>
                <p className="text-sm">{item.label} doses</p>
                <p className="mt-1 text-2xl font-bold">{item.value}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-6 grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="rounded-3xl bg-white p-6 shadow-sm">
            <h2 className="text-xl font-semibold text-slate-900">Visible reminders</h2>
            <div className="mt-4 space-y-3">
              {dueSoon.length > 0 ? (
                dueSoon.map(({ medication, dose }) => (
                  <div key={medication.id} className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold text-slate-900">{medication.name}</p>
                        <p className="mt-1 text-sm text-slate-600">
                          Reminder {medication.reminderLeadMinutes ?? 30} min before {formatDoseTime(dose.at)}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => logAdherence(medication, "taken")}
                        className="rounded-xl bg-emerald-500 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-600 transition"
                      >
                        Mark taken
                      </button>
                    </div>
                  </div>
                ))
              ) : (
                <p className="rounded-2xl border border-dashed border-slate-200 p-4 text-sm text-slate-500">
                  No reminders due soon. Add schedule times and reminder lead minutes to make them actionable.
                </p>
              )}
            </div>
          </div>

          <div className="rounded-3xl bg-white p-6 shadow-sm">
            <h2 className="text-xl font-semibold text-slate-900">End-date and refill warnings</h2>
            <div className="mt-4 space-y-3">
              {warnings.length > 0 ? (
                warnings.map(({ medication, warning }) => (
                  <div key={`${medication.id}-${warning}`} className="rounded-2xl border border-rose-200 bg-rose-50 p-4">
                    <p className="font-semibold text-slate-900">{medication.name}</p>
                    <p className="mt-1 text-sm text-slate-600">{warning}</p>
                    <button
                      type="button"
                      onClick={() => openModal(medication)}
                      className="mt-3 rounded-xl border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-white transition"
                    >
                      Review medication
                    </button>
                  </div>
                ))
              ) : (
                <p className="rounded-2xl border border-dashed border-slate-200 p-4 text-sm text-slate-500">
                  No refill or end-date warnings right now.
                </p>
              )}
            </div>
          </div>
        </section>

        <section className="mt-6 rounded-3xl bg-white p-6 shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-xl font-semibold text-slate-900">Adherence history</h2>
              <p className="mt-1 text-sm text-slate-500">
                Every medication action is tracked as taken, missed, skipped, or delayed.
              </p>
            </div>
          </div>

          <div className="mt-4 space-y-3">
            {recentAdherenceEntries.length > 0 ? (
              recentAdherenceEntries.map((entry) => (
                <div key={entry.key} className="rounded-2xl border border-slate-200 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-slate-900">{entry.medicationName}</p>
                      <p className="mt-1 text-sm text-slate-500">
                        Scheduled for {new Date(entry.scheduledFor).toLocaleString()}
                      </p>
                    </div>
                    <span className={`rounded-full px-3 py-1 text-xs font-semibold ${getAdherenceTone(entry.status)}`}>
                      {formatAdherenceLabel(entry.status)}
                    </span>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-4 text-sm text-slate-600">
                    <span>Recorded: {new Date(entry.recordedAt || entry.scheduledFor).toLocaleString()}</span>
                    {entry.delayMinutes != null ? <span>Delay: {entry.delayMinutes} min</span> : null}
                  </div>
                  {entry.notes ? (
                    <p className="mt-3 rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-600">{entry.notes}</p>
                  ) : null}
                </div>
              ))
            ) : (
              <p className="rounded-2xl border border-dashed border-slate-200 p-4 text-sm text-slate-500">
                No adherence updates logged yet.
              </p>
            )}
          </div>
        </section>

        <section className="mt-6 rounded-3xl bg-white p-6 shadow-sm">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-5">
            <div className="relative md:col-span-2">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                <Search className="text-slate-400" size={20} />
              </div>
              <input
                type="text"
                placeholder="Search medications by name or doctor..."
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                className="w-full rounded-2xl border border-slate-300 py-2.5 pl-10 pr-4 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-sky-500"
              />
            </div>
            <select value={doctorFilter} onChange={(event) => setDoctorFilter(event.target.value)} className="rounded-2xl border border-slate-300 px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-sky-500">
              <option value="">All Doctors</option>
              {filterOptions.doctors.map((doctor) => (
                <option key={doctor} value={doctor}>
                  {doctor}
                </option>
              ))}
            </select>
            <select value={frequencyFilter} onChange={(event) => setFrequencyFilter(event.target.value)} className="rounded-2xl border border-slate-300 px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-sky-500">
              <option value="">All Frequencies</option>
              {filterOptions.frequencies.map((frequency) => (
                <option key={frequency} value={frequency}>
                  {frequency}
                </option>
              ))}
            </select>
            <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="rounded-2xl border border-slate-300 px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-sky-500">
              <option value="">All Statuses</option>
              <option value="active">Active</option>
              <option value="past">Past</option>
            </select>
          </div>

          <div className="mt-3 flex flex-wrap gap-3">
            <select value={sortBy} onChange={(event) => setSortBy(event.target.value)} className="rounded-2xl border border-slate-300 px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-sky-500">
              <option value="createdAt">Sort by Added Date</option>
              <option value="name">Sort by Name</option>
              <option value="startDate">Sort by Start Date</option>
              <option value="endDate">Sort by End Date</option>
            </select>
            <select value={sortOrder} onChange={(event) => setSortOrder(event.target.value)} className="rounded-2xl border border-slate-300 px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-sky-500">
              <option value="DESC">Newest First</option>
              <option value="ASC">Oldest First</option>
            </select>
            <button
              type="button"
              onClick={() => {
                setSearchTerm("");
                setDoctorFilter("");
                setFrequencyFilter("");
                setStatusFilter("");
                setSortBy("createdAt");
                setSortOrder("DESC");
              }}
              className="rounded-2xl border border-slate-300 px-4 py-2.5 text-slate-700 transition hover:bg-slate-50"
            >
              Reset Filters
            </button>
          </div>

          {error ? <p className="mt-4 text-sm text-red-600">{error}</p> : null}

          <div className="mt-6 grid gap-4">
            {medications.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-slate-200 p-10 text-center text-slate-500">
                No medications found.
              </div>
            ) : (
              medications.map((medication) => {
                const latestStatus = getLatestAdherenceStatus(medication);
                const nextMedicationDose = getNextDoseForMedication(medication);
                const medicationWarnings = getMedicationWarnings(medication);

                return (
                  <div key={medication.id} className="rounded-3xl border border-slate-200 p-5">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-xl font-semibold text-slate-900">{medication.name}</h3>
                          <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-600">
                            {medication.dosage}
                          </span>
                          {latestStatus ? (
                            <span className={`rounded-full px-2 py-1 text-xs font-semibold ${getAdherenceTone(latestStatus)}`}>
                              Last dose: {formatAdherenceLabel(latestStatus)}
                            </span>
                          ) : null}
                        </div>
                        <p className="mt-2 text-sm text-slate-600">
                          {medication.frequency} {medication.prescribedBy ? `| Prescribed by ${medication.prescribedBy}` : ""}
                        </p>
                        <p className="mt-1 text-sm text-slate-500">
                          Schedule: {formatScheduleInput(medication.scheduleJson, medication.frequency)}
                        </p>
                        <p className="mt-1 text-sm text-slate-500">
                          Reminder: {medication.reminderEnabled === false ? "Off" : `${medication.reminderLeadMinutes ?? 30} minutes before dose`}
                        </p>
                        {nextMedicationDose ? (
                          <p className="mt-1 text-sm font-medium text-sky-700">
                            Next dose at {formatDoseTime(nextMedicationDose.at)}
                          </p>
                        ) : null}
                        {medication.notes ? <p className="mt-3 text-sm text-slate-600">{medication.notes}</p> : null}
                        {medicationWarnings.length > 0 ? (
                          <div className="mt-3 flex flex-wrap gap-2">
                            {medicationWarnings.map((warning) => (
                              <span key={warning} className="rounded-full bg-rose-100 px-3 py-1 text-xs font-semibold text-rose-700">
                                {warning}
                              </span>
                            ))}
                          </div>
                        ) : null}
                      </div>

                      <div className="flex flex-wrap gap-2">
                        {["taken", "missed", "skipped", "delayed"].map((statusValue) => (
                          <button
                            key={statusValue}
                            type="button"
                            onClick={() => logAdherence(medication, statusValue)}
                            className={`rounded-xl px-3 py-2 text-xs font-semibold transition ${getAdherenceTone(statusValue)}`}
                          >
                            Mark {formatAdherenceLabel(statusValue)}
                          </button>
                        ))}
                        <button
                          type="button"
                          onClick={() => openModal(medication)}
                          className="rounded-xl bg-sky-500 px-3 py-2 text-xs font-semibold text-white hover:bg-sky-600 transition"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => deleteMedication(medication.id)}
                          className="rounded-xl bg-red-50 px-3 py-2 text-xs font-semibold text-red-700 hover:bg-red-100 transition"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </section>

        {isModalOpen ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
            <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-3xl bg-white shadow-lg">
              <div className="sticky top-0 flex items-center justify-between border-b border-slate-200 bg-white p-6">
                <h2 className="text-xl font-semibold text-slate-900">{editingMed ? "Edit Medication" : "Add New Medication"}</h2>
                <button onClick={closeModal} className="text-slate-400 transition hover:text-slate-600">
                  <X size={24} />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="p-6">
                <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                  <div className="md:col-span-2">
                    <label className="mb-1.5 block text-sm font-medium text-slate-700">Medication Name</label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(event) => setFormData((current) => ({ ...current, name: event.target.value }))}
                      required
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-sky-500"
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-slate-700">Dosage</label>
                    <input
                      type="text"
                      value={formData.dosage}
                      onChange={(event) => setFormData((current) => ({ ...current, dosage: event.target.value }))}
                      required
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-sky-500"
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-slate-700">Frequency</label>
                    <input
                      type="text"
                      value={formData.frequency}
                      onChange={(event) => setFormData((current) => ({ ...current, frequency: event.target.value }))}
                      required
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-sky-500"
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-slate-700">Prescribed By</label>
                    <input
                      type="text"
                      value={formData.prescribedBy}
                      onChange={(event) => setFormData((current) => ({ ...current, prescribedBy: event.target.value }))}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-sky-500"
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-slate-700">Schedule times</label>
                    <input
                      type="text"
                      value={formData.scheduleTimes}
                      onChange={(event) => setFormData((current) => ({ ...current, scheduleTimes: event.target.value }))}
                      placeholder="08:00, 20:00"
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-sky-500"
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-slate-700">Start Date</label>
                    <input
                      type="date"
                      value={formData.startDate || ""}
                      onChange={(event) => setFormData((current) => ({ ...current, startDate: event.target.value }))}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-sky-500"
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-slate-700">End Date</label>
                    <input
                      type="date"
                      value={formData.endDate || ""}
                      onChange={(event) => setFormData((current) => ({ ...current, endDate: event.target.value }))}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-sky-500"
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-slate-700">Reminder lead minutes</label>
                    <input
                      type="number"
                      min="0"
                      value={formData.reminderLeadMinutes}
                      onChange={(event) => setFormData((current) => ({ ...current, reminderLeadMinutes: event.target.value }))}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-sky-500"
                    />
                  </div>
                  <label className="flex items-center gap-2 rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-700">
                    <input
                      type="checkbox"
                      checked={Boolean(formData.reminderEnabled)}
                      onChange={(event) => setFormData((current) => ({ ...current, reminderEnabled: event.target.checked }))}
                    />
                    Enable medication reminders
                  </label>
                  <div className="md:col-span-2">
                    <label className="mb-1.5 block text-sm font-medium text-slate-700">Notes</label>
                    <textarea
                      value={formData.notes}
                      onChange={(event) => setFormData((current) => ({ ...current, notes: event.target.value }))}
                      rows={3}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-sky-500"
                      placeholder="Additional instructions or reminders"
                    />
                  </div>
                </div>

                <div className="mt-6 flex gap-3 border-t border-slate-200 pt-6">
                  <button type="button" onClick={closeModal} className="flex-1 rounded-lg border border-slate-300 px-4 py-2.5 font-medium text-slate-700 transition hover:bg-slate-50">
                    Cancel
                  </button>
                  <button type="submit" className="flex-1 rounded-lg bg-sky-600 px-4 py-2.5 font-medium text-white transition hover:bg-sky-700">
                    {editingMed ? "Update Medication" : "Add Medication"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
