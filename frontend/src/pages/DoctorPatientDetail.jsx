import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import Navbar from "../components/Navbar";
import { apiUrl, authHeaders } from "../api/http";
import { rememberDoctorPatientTab } from "../utils/doctorPatientTabs";
import { formatListOutput, getPatientClinicalNotes, getPatientTreatmentPlans } from "../utils/doctorPatientRecords";
import { formatDoseTime, getNextMedicationDose, getScheduleTimes, isActiveMedication } from "../utils/medicationSchedule";

function patientDisplayName(record) {
  const p = record?.patient || record;
  const profileName = [record?.patientProfile?.firstName, record?.patientProfile?.lastName]
    .filter(Boolean)
    .join(" ")
    .trim();
  return profileName || [p?.firstName, p?.lastName].filter(Boolean).join(" ").trim() || p?.displayName || p?.email || "Patient";
}
function formatDate(value) {
  if (!value) return "Not recorded";
  return new Date(value).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}
function formatDateTime(value) {
  if (!value) return "Not recorded";
  return new Date(value).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}
function formatField(value) {
  if (!value) return "Not recorded";
  if (Array.isArray(value)) return value.filter(Boolean).join(", ") || "Not recorded";
  if (typeof value === "object") return [value.name, value.relationship, value.phoneNumber].filter(Boolean).join(" • ") || "Not recorded";
  return String(value).trim() || "Not recorded";
}
function parseScheduleInput(value) {
  const list = Array.isArray(value) ? value : String(value || "").split(",");
  const times = list
    .map((item) => String(item).trim())
    .filter(Boolean);
  return { times };
}
function formatScheduleInput(scheduleJson, frequency) {
  return getScheduleTimes({ scheduleJson, frequency });
}
function getMedicationStatus(medication) {
  return isActiveMedication(medication) ? "Active" : "Inactive";
}
async function fetchPatientOverview(patientId) {
  const response = await fetch(`${apiUrl}/api/doctors/patients/${patientId}/overview`, { headers: { ...authHeaders() } });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || "Failed to load patient details.");
  return data;
}
async function fetchPatientTimeline(patientId) {
  const response = await fetch(`${apiUrl}/api/doctors/patients/${patientId}/timeline`, { headers: { ...authHeaders() } });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || "Failed to load patient timeline.");
  return data;
}
async function fetchPatientNotes(patientId) {
  const response = await fetch(`${apiUrl}/api/doctor-notes/patient/${patientId}/notes`, { headers: { ...authHeaders() } });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || "Failed to load doctor notes.");
  return data;
}

export default function DoctorPatientDetail() {
  const navigate = useNavigate();
  const { patientId } = useParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [workspace, setWorkspace] = useState(null);
  const [localNotes, setLocalNotes] = useState([]);
  const [localPlans, setLocalPlans] = useState([]);
  const [medicationFormOpen, setMedicationFormOpen] = useState(false);
  const [savingMedication, setSavingMedication] = useState(false);
  const [editingMedicationId, setEditingMedicationId] = useState(null);
  const [medicationError, setMedicationError] = useState("");
  const [medicationForm, setMedicationForm] = useState({
    name: "",
    doseAmount: "",
    doseUnit: "mg",
    frequency: "Once daily",
    scheduleTimes: ["08:00"],
    startDate: "",
    endDate: "",
    notes: "",
  });

  async function loadWorkspace(currentPatientId, { preserveMedicationForm = false } = {}) {
    const [overview, timeline, notes] = await Promise.all([
      fetchPatientOverview(currentPatientId),
      fetchPatientTimeline(currentPatientId),
      fetchPatientNotes(currentPatientId),
    ]);
    setWorkspace({ overview, timeline: timeline.events || [], notes: notes.notes || [] });
    rememberDoctorPatientTab({ id: currentPatientId, name: patientDisplayName(overview) });
    setLocalNotes(getPatientClinicalNotes(currentPatientId));
    setLocalPlans(getPatientTreatmentPlans(currentPatientId));
    if (!preserveMedicationForm) {
      setMedicationFormOpen(false);
      setEditingMedicationId(null);
      setMedicationError("");
      setMedicationForm({
        name: "",
        doseAmount: "",
        doseUnit: "mg",
        frequency: "Once daily",
        scheduleTimes: ["08:00"],
        startDate: "",
        endDate: "",
        notes: "",
      });
    }
  }

  useEffect(() => {
    let cancelled = false;
    async function loadPatientWorkspace() {
      try {
        setLoading(true);
        setError("");
        await loadWorkspace(patientId);
      } catch (err) {
        if (!cancelled) {
          setWorkspace(null);
          setError(err.message || "Failed to load patient detail.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    loadPatientWorkspace();
    return () => { cancelled = true; };
  }, [patientId]);

  const overview = workspace?.overview;
  const profile = overview?.patientProfile || null;
  const medications = overview?.medications || [];
  const diagnoses = overview?.diagnoses || [];
  const appointments = overview?.appointmentsAsPatient || [];
  const activeMedications = medications.filter((item) => isActiveMedication(item));
  const nextMedicationDose = getNextMedicationDose(activeMedications);

  function openMedicationForm(medication = null) {
    if (medication) {
      setEditingMedicationId(medication.id);
      setMedicationForm({
        name: medication.name || "",
        doseAmount: medication.doseAmount != null ? String(medication.doseAmount) : "",
        doseUnit: medication.doseUnit || "mg",
        frequency: medication.frequency || "Once daily",
        scheduleTimes: formatScheduleInput(medication.scheduleJson, medication.frequency) || ["08:00"],
        startDate: medication.startDate || "",
        endDate: medication.endDate || "",
        notes: medication.notes || "",
      });
    } else {
      setEditingMedicationId(null);
      setMedicationForm({
        name: "",
        doseAmount: "",
        doseUnit: "mg",
        frequency: "Once daily",
        scheduleTimes: ["08:00"],
        startDate: "",
        endDate: "",
        notes: "",
      });
    }
    setMedicationError("");
    setMedicationFormOpen(true);
  }

  async function handleMedicationSubmit(event) {
    event.preventDefault();
    try {
      setSavingMedication(true);
      setMedicationError("");
      const trimmedAmount = String(medicationForm.doseAmount || "").trim();
      if (!trimmedAmount || Number.isNaN(Number(trimmedAmount)) || Number(trimmedAmount) <= 0) {
        throw new Error("Dosage amount must be a positive number.");
      }
      const validTimes = (medicationForm.scheduleTimes || [])
        .map((time) => String(time || "").trim())
        .filter(Boolean);
      if (!validTimes.length) {
        throw new Error("Add at least one dosing time.");
      }
      const dosage = `${trimmedAmount} ${medicationForm.doseUnit}`.trim();
      const response = await fetch(
        `${apiUrl}/api/medications${editingMedicationId ? `/${editingMedicationId}` : ""}`,
        {
          method: editingMedicationId ? "PUT" : "POST",
          headers: { "Content-Type": "application/json", ...authHeaders() },
          body: JSON.stringify({
            patientId,
            name: medicationForm.name,
            dosage,
            doseAmount: Number(trimmedAmount),
            doseUnit: medicationForm.doseUnit,
            frequency: medicationForm.frequency,
            scheduleJson: parseScheduleInput(validTimes),
            startDate: medicationForm.startDate || null,
            endDate: medicationForm.endDate || null,
            notes: medicationForm.notes || null,
            adherenceHistory: [],
          }),
        }
      );
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data?.error || data?.message || "Failed to save medication.");
      }
      await loadWorkspace(patientId);
    } catch (err) {
      setMedicationError(err.message || "Failed to save medication.");
    } finally {
      setSavingMedication(false);
    }
  }

  async function handleMedicationDelete(medicationId) {
    if (!window.confirm("Remove this medication from the patient's treatment list?")) return;
    try {
      setMedicationError("");
      const response = await fetch(`${apiUrl}/api/medications/${medicationId}?patientId=${encodeURIComponent(patientId)}`, {
        method: "DELETE",
        headers: { ...authHeaders() },
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data?.error || data?.message || "Failed to delete medication.");
      }
      await loadWorkspace(patientId, { preserveMedicationForm: true });
    } catch (err) {
      setMedicationError(err.message || "Failed to delete medication.");
    }
  }

  function updateMedicationTime(index, value) {
    setMedicationForm((current) => ({
      ...current,
      scheduleTimes: current.scheduleTimes.map((time, timeIndex) => (timeIndex === index ? value : time)),
    }));
  }

  function addMedicationTime() {
    setMedicationForm((current) => ({
      ...current,
      scheduleTimes: [...current.scheduleTimes, "12:00"],
    }));
  }

  function removeMedicationTime(index) {
    setMedicationForm((current) => {
      if (current.scheduleTimes.length <= 1) return current;
      return {
        ...current,
        scheduleTimes: current.scheduleTimes.filter((_, timeIndex) => timeIndex !== index),
      };
    });
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />
      <main className="mx-auto max-w-7xl px-6 pb-10 pt-28">
        <section className="rounded-[2rem] bg-gradient-to-r from-slate-900 via-sky-800 to-cyan-600 p-8 text-white shadow-xl">
          <p className="text-sm font-semibold uppercase tracking-[0.25em] text-white/75">Doctor Workspace</p>
          <h1 className="mt-3 text-4xl font-black">{overview ? patientDisplayName(overview) : 'Patient detail'}</h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-white/85">Clinical context, notes, appointments, and treatment summary for this patient.</p>
          <div className="mt-5 flex flex-wrap gap-3">
            <button type="button" onClick={() => navigate('/doctor-patients')} className="rounded-xl bg-white/15 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/25">Back to patients</button>
            <button type="button" onClick={() => navigate(`/doctor-clinical-notes?patientId=${patientId}`)} className="rounded-xl bg-white/15 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/25">Open clinical notes</button>
            <button type="button" onClick={() => navigate(`/doctor-treatment-plans?patientId=${patientId}`)} className="rounded-xl bg-white/15 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/25">Open treatment plans</button>
          </div>
        </section>
        {error ? <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}
        {loading ? <div className="mt-6 rounded-2xl border border-dashed border-slate-200 px-6 py-8 text-center text-sm text-slate-500">Loading patient detail...</div> : overview ? (
          <div className="mt-6">
            <div className="grid gap-5 xl:grid-cols-2">
            <div className="rounded-3xl bg-white p-5 shadow-sm">
              <h3 className="text-lg font-semibold text-slate-900">Profile and emergency</h3>
              <div className="mt-4 space-y-2 text-sm text-slate-600">
                <p><span className="font-semibold text-slate-900">Email:</span> {formatField(overview.email)}</p>
                <p><span className="font-semibold text-slate-900">Date of birth:</span> {formatField(profile?.dateOfBirth)}</p>
                <p><span className="font-semibold text-slate-900">Sex:</span> {formatField(profile?.sex)}</p>
                <p><span className="font-semibold text-slate-900">Blood type:</span> {formatField(profile?.bloodType)}</p>
                <p><span className="font-semibold text-slate-900">Allergies:</span> {formatField(profile?.allergies)}</p>
                <p><span className="font-semibold text-slate-900">Medical conditions:</span> {formatField(profile?.medicalConditions)}</p>
                <p><span className="font-semibold text-slate-900">Emergency contact:</span> {formatField(profile?.emergencyContact)}</p>
                <p><span className="font-semibold text-slate-900">Emergency status:</span> {profile?.emergencyStatus ? 'Active' : 'Normal'}</p>
              </div>
            </div>
            <div className="rounded-3xl bg-white p-5 shadow-sm">
              <h3 className="text-lg font-semibold text-slate-900">Appointments</h3>
              <div className="mt-4 space-y-3">
                {appointments.length ? appointments.slice(0,5).map((appointment) => (
                  <div key={appointment.id} className="rounded-2xl border border-slate-200 p-3">
                    <div className="flex items-center justify-between gap-3"><p className="font-semibold text-slate-900">{formatDateTime(appointment.startsAt)}</p><span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">{appointment.status}</span></div>
                    <p className="mt-1 text-sm text-slate-500">{appointment.location || 'Location pending'}</p>
                    <p className="mt-1 text-sm text-slate-500">{appointment.notes || 'No notes.'}</p>
                  </div>
                )) : <p className="text-sm text-slate-500">No appointment history with this patient yet.</p>}
              </div>
            </div>
            <div className="rounded-3xl bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-lg font-semibold text-slate-900">Medication plan</h3>
                  <p className="mt-1 text-sm text-slate-500">Set dosage, frequency, timeline, and dosing times here. Changes feed the patient medication views automatically.</p>
                </div>
                <button
                  type="button"
                  onClick={() => openMedicationForm()}
                  className="rounded-xl bg-sky-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-sky-700"
                >
                  Add medication
                </button>
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                <div className="rounded-2xl bg-slate-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Active medications</p>
                  <p className="mt-2 text-3xl font-black text-slate-900">{activeMedications.length}</p>
                </div>
                <div className="rounded-2xl bg-slate-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Next dose</p>
                  <p className="mt-2 text-sm font-semibold text-slate-900">{nextMedicationDose ? `${nextMedicationDose.medication?.name || "Medication"} at ${formatDoseTime(nextMedicationDose.at)}` : "No upcoming dose"}</p>
                </div>
                <div className="rounded-2xl bg-slate-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Timeline</p>
                  <p className="mt-2 text-sm font-semibold text-slate-900">{medications.length ? `${medications.filter((item) => item.startDate).length} with start date` : "Not set yet"}</p>
                </div>
              </div>
              {medicationError ? <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{medicationError}</div> : null}
              {medicationFormOpen ? (
                <form onSubmit={handleMedicationSubmit} className="mt-4 rounded-3xl border border-slate-200 bg-slate-50 p-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    <label className="text-sm font-medium text-slate-700">
                      Medication name
                      <input value={medicationForm.name} onChange={(event) => setMedicationForm((current) => ({ ...current, name: event.target.value }))} required className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-sky-400 focus:ring-2 focus:ring-sky-100" placeholder="Metformin" />
                    </label>
                    <label className="text-sm font-medium text-slate-700">
                      Dosage
                      <div className="mt-1 grid grid-cols-[minmax(0,1fr)_120px] gap-2">
                        <input type="number" min="0" step="0.1" value={medicationForm.doseAmount} onChange={(event) => setMedicationForm((current) => ({ ...current, doseAmount: event.target.value }))} required className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-sky-400 focus:ring-2 focus:ring-sky-100" placeholder="500" />
                        <select value={medicationForm.doseUnit} onChange={(event) => setMedicationForm((current) => ({ ...current, doseUnit: event.target.value }))} className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-sky-400 focus:ring-2 focus:ring-sky-100">
                          <option value="mg">mg</option>
                          <option value="mcg">mcg</option>
                          <option value="g">g</option>
                          <option value="mL">mL</option>
                          <option value="tablet(s)">tablet(s)</option>
                          <option value="capsule(s)">capsule(s)</option>
                          <option value="drop(s)">drop(s)</option>
                          <option value="unit(s)">unit(s)</option>
                          <option value="puff(s)">puff(s)</option>
                        </select>
                      </div>
                    </label>
                    <label className="text-sm font-medium text-slate-700">
                      Frequency
                      <select value={medicationForm.frequency} onChange={(event) => {
                        const frequency = event.target.value;
                        const suggestedTimes = frequency === "Twice daily" ? ["08:00", "20:00"] : frequency === "Three times daily" ? ["08:00", "14:00", "20:00"] : frequency === "Every 8 hours" ? ["06:00", "14:00", "22:00"] : ["08:00"];
                        setMedicationForm((current) => ({ ...current, frequency, scheduleTimes: current.scheduleTimes.every((time) => ["08:00", "20:00", "14:00", "06:00", "22:00"].includes(time)) ? suggestedTimes : current.scheduleTimes }));
                      }} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-sky-400 focus:ring-2 focus:ring-sky-100">
                        <option>Once daily</option>
                        <option>Twice daily</option>
                        <option>Three times daily</option>
                        <option>Every 8 hours</option>
                        <option>Weekly</option>
                        <option>As needed</option>
                        <option>Custom</option>
                      </select>
                    </label>
                    <label className="text-sm font-medium text-slate-700">
                      Dosing times
                      <div className="mt-1 space-y-2">
                        {medicationForm.scheduleTimes.map((time, index) => (
                          <div key={`${index}-${time}`} className="flex items-center gap-2">
                            <input type="time" value={time} onChange={(event) => updateMedicationTime(index, event.target.value)} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-sky-400 focus:ring-2 focus:ring-sky-100" />
                            {medicationForm.scheduleTimes.length > 1 ? (
                              <button type="button" onClick={() => removeMedicationTime(index)} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50">
                                Remove
                              </button>
                            ) : null}
                          </div>
                        ))}
                        <button type="button" onClick={addMedicationTime} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50">
                          Add time
                        </button>
                      </div>
                    </label>
                    <label className="text-sm font-medium text-slate-700">
                      Start date
                      <input type="date" value={medicationForm.startDate} onChange={(event) => setMedicationForm((current) => ({ ...current, startDate: event.target.value }))} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-sky-400 focus:ring-2 focus:ring-sky-100" />
                    </label>
                    <label className="text-sm font-medium text-slate-700">
                      End date
                      <input type="date" value={medicationForm.endDate} onChange={(event) => setMedicationForm((current) => ({ ...current, endDate: event.target.value }))} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-sky-400 focus:ring-2 focus:ring-sky-100" />
                    </label>
                  </div>
                  <label className="mt-4 block text-sm font-medium text-slate-700">
                    Notes / instructions
                    <textarea value={medicationForm.notes} onChange={(event) => setMedicationForm((current) => ({ ...current, notes: event.target.value }))} rows={3} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-sky-400 focus:ring-2 focus:ring-sky-100" placeholder="Take after food, monitor dizziness, stop if rash develops." />
                  </label>
                  <div className="mt-4 flex flex-wrap gap-3">
                    <button type="submit" disabled={savingMedication} className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400">
                      {savingMedication ? "Saving..." : editingMedicationId ? "Update medication" : "Save medication"}
                    </button>
                    <button type="button" onClick={() => { setMedicationFormOpen(false); setEditingMedicationId(null); setMedicationError(""); }} className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50">
                      Cancel
                    </button>
                  </div>
                </form>
              ) : null}
              <div className="mt-4 space-y-3">
                {medications.length ? medications.map((medication) => (
                  <div key={medication.id} className="rounded-2xl border border-slate-200 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-base font-semibold text-slate-900">{medication.name}</p>
                        <p className="mt-1 text-sm text-slate-600">{medication.dosage} • {medication.frequency}</p>
                        <p className="mt-1 text-sm text-slate-500">
                          {getScheduleTimes(medication).join(", ")}
                          {medication.startDate ? ` • Starts ${formatDate(medication.startDate)}` : ""}
                          {medication.endDate ? ` • Ends ${formatDate(medication.endDate)}` : ""}
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${getMedicationStatus(medication) === "Active" ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-700"}`}>{getMedicationStatus(medication)}</span>
                        <button type="button" onClick={() => openMedicationForm(medication)} className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50">Edit</button>
                        <button type="button" onClick={() => handleMedicationDelete(medication.id)} className="rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-rose-700">Delete</button>
                      </div>
                    </div>
                    {medication.notes ? <p className="mt-2 text-sm text-slate-500">{medication.notes}</p> : null}
                  </div>
                )) : <p className="text-sm text-slate-500">No medications assigned yet.</p>}
              </div>
            </div>
            <div className="rounded-3xl bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-lg font-semibold text-slate-900">Clinical notes</h3>
                <button type="button" onClick={() => navigate(`/doctor-clinical-notes?patientId=${patientId}`)} className="rounded-lg bg-indigo-100 px-3 py-1.5 text-xs font-semibold text-indigo-700 transition hover:bg-indigo-200">Open notes</button>
              </div>
              <div className="mt-4 space-y-3">
                {localNotes.length ? localNotes.slice(0,4).map((note) => (
                  <div key={note.id} className="rounded-2xl border border-slate-200 p-3">
                    <div className="flex items-start justify-between gap-3">
                      <p className="font-semibold text-slate-900">{note.noteTitle}</p>
                      <span className="text-xs text-slate-400">{formatDateTime(note.createdAt)}</span>
                    </div>
                    <p className="mt-2 text-sm text-slate-700">{note.patientSafeSummary || note.diagnosticSummary || note.chiefComplaint}</p>
                    <p className="mt-2 text-xs text-slate-500">Assessment: {note.diagnosticSummary || "Not recorded"}</p>
                  </div>
                )) : workspace.notes.length ? workspace.notes.slice(0,6).map((note) => (
                  <div key={note.id} className="rounded-2xl border border-slate-200 p-3">
                    <p className="text-sm text-slate-700">{note.content}</p>
                    <p className="mt-2 text-xs text-slate-400">{formatDateTime(note.date)}</p>
                  </div>
                )) : <p className="text-sm text-slate-500">No clinical notes recorded yet.</p>}
              </div>
            </div>
            <div className="rounded-3xl bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-lg font-semibold text-slate-900">Treatment summary</h3>
                <button type="button" onClick={() => navigate(`/doctor-treatment-plans?patientId=${patientId}`)} className="rounded-lg bg-violet-100 px-3 py-1.5 text-xs font-semibold text-violet-700 transition hover:bg-violet-200">Open plans</button>
              </div>
              <div className="mt-4 space-y-3">
                {localPlans.length ? localPlans.slice(0,4).map((plan) => (
                  <div key={plan.id} className="rounded-2xl border border-slate-200 p-3">
                    <div className="flex items-center justify-between gap-3">
                      <p className="font-semibold text-slate-900">{plan.title}</p>
                      <span className={`rounded-full px-3 py-1 text-xs font-semibold ${plan.status === 'active' ? 'bg-emerald-100 text-emerald-700' : plan.status === 'draft' ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-700'}`}>{plan.status}</span>
                    </div>
                    <p className="mt-2 text-sm text-slate-700">{plan.patientSafeSummary || formatListOutput(plan.treatmentGoals) || "No patient-safe summary provided."}</p>
                    <p className="mt-2 text-xs text-slate-500">Conditions: {formatListOutput(plan.targetConditions) || "Not recorded"}</p>
                  </div>
                )) : diagnoses.length ? diagnoses.slice(0,6).map((diagnosis) => (
                  <div key={diagnosis.id} className="rounded-2xl border border-slate-200 p-3">
                    <div className="flex items-center justify-between gap-3"><p className="font-semibold text-slate-900">{diagnosis.diagnosisText}</p><span className={`rounded-full px-3 py-1 text-xs font-semibold ${diagnosis.status === 'active' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-700'}`}>{diagnosis.status}</span></div>
                    <p className="mt-2 text-xs text-slate-400">Diagnosed {formatDate(diagnosis.diagnosedAt)}</p>
                  </div>
                )) : <p className="text-sm text-slate-500">No diagnoses or treatment items recorded yet.</p>}
              </div>
            </div>
            <div className="rounded-3xl bg-white p-5 shadow-sm xl:col-span-2">
              <h3 className="text-lg font-semibold text-slate-900">Activity timeline</h3>
              <div className="mt-4 space-y-3">
                {workspace.timeline.length ? workspace.timeline.slice(0,8).map((item) => (
                  <div key={`${item.type}-${item.id}`} className="rounded-2xl border border-slate-200 p-3">
                    <div className="flex items-center justify-between gap-3"><p className="font-semibold text-slate-900">{item.title}</p><span className="text-xs text-slate-400">{formatDateTime(item.timestamp)}</span></div>
                    <p className="mt-1 text-sm text-slate-500">{item.detail}</p>
                  </div>
                )) : <p className="text-sm text-slate-500">No recent activity for this patient yet.</p>}
              </div>
            </div>
            </div>
          </div>
        ) : null}
      </main>
    </div>
  );
}
