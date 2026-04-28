import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import Navbar from "../components/Navbar";
import { apiUrl, authHeaders } from "../api/http";
import { rememberDoctorPatientTab } from "../utils/doctorPatientTabs";
import {
  formatListOutput,
  getDoctorEmergencyReview,
  getPatientTreatmentPlans,
  saveDoctorEmergencyReview,
} from "../utils/doctorPatientRecords";
import { formatDoseTime, getNextMedicationDose, getScheduleTimes, isActiveMedication } from "../utils/medicationSchedule";
import { createConversation, getConversationMessages, sendConversationMessage } from "../api/messaging";

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
function formatEmergencyContact(value) {
  if (!value) return "Not recorded";

  let contact = value;
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return "Not recorded";
    if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
      try {
        contact = JSON.parse(trimmed);
      } catch {
        return trimmed;
      }
    } else {
      return trimmed;
    }
  }

  if (Array.isArray(contact)) {
    return contact
      .map((entry) => formatEmergencyContact(entry))
      .filter(Boolean)
      .join("; ") || "Not recorded";
  }

  if (contact && typeof contact === "object") {
    const name = contact.name || contact.fullName || contact.contactName;
    const relationship = contact.relationship || contact.relation;
    const phone = contact.phoneNumber || contact.phone || contact.number;
    const parts = [name, relationship, phone].filter(Boolean);
    if (parts.length) return parts.join(" • ");
  }

  return formatField(contact);
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
function formatMedicationDose(medication) {
  if (medication?.doseAmount != null && medication?.doseUnit) {
    return `${medication.doseAmount} ${medication.doseUnit}`;
  }
  return medication?.dosage || "Not recorded";
}
function InfoPill({ label, value, tone = "sky" }) {
  const tones = {
    sky: "bg-sky-100 text-sky-700",
    violet: "bg-violet-100 text-violet-700",
    emerald: "bg-emerald-100 text-emerald-700",
    amber: "bg-amber-100 text-amber-700",
    rose: "bg-rose-100 text-rose-700",
    slate: "bg-slate-100 text-slate-700",
  };
  return <span className={`rounded-full px-3 py-1 text-xs font-semibold ${tones[tone] || tones.sky}`}>{label}: {value}</span>;
}
function SummaryMetric({ label, value, hint, tone = "sky", active = false, onClick }) {
  const tones = {
    sky: "from-sky-500 to-cyan-400",
    violet: "from-violet-500 to-fuchsia-400",
    emerald: "from-emerald-500 to-teal-400",
    amber: "from-amber-500 to-orange-400",
  };
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full rounded-3xl border p-4 text-left backdrop-blur-sm transition ${
        active ? "border-white/40 bg-white/20" : "border-white/15 bg-white/10 hover:bg-white/15"
      }`}
    >
      <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-white/70">{label}</p>
      <p className="mt-2 text-3xl font-black text-white">{value}</p>
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/15">
        <div className={`h-full rounded-full bg-gradient-to-r ${tones[tone] || tones.sky}`} style={{ width: "100%" }} />
      </div>
      <p className="mt-2 text-xs text-white/70">{hint}</p>
    </button>
  );
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
async function fetchPatientAiSummary(patientId) {
  const response = await fetch(`${apiUrl}/api/doctors/patients/${patientId}/ai-summary`, { headers: { ...authHeaders() } });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || "Failed to load AI summary.");
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
  const [emergencyReview, setEmergencyReview] = useState(null);
  const [emergencyReviewForm, setEmergencyReviewForm] = useState({ disposition: "monitoring", note: "" });
  const [emergencyReviewMessage, setEmergencyReviewMessage] = useState("");
  const [communicationConversationId, setCommunicationConversationId] = useState("");
  const [communicationMessages, setCommunicationMessages] = useState([]);
  const [communicationLoading, setCommunicationLoading] = useState(false);
  const [communicationError, setCommunicationError] = useState("");
  const [communicationDraft, setCommunicationDraft] = useState("");
  const [sendingCommunication, setSendingCommunication] = useState(false);
  const [communicationContextType, setCommunicationContextType] = useState("");
  const [communicationContextRelatedId, setCommunicationContextRelatedId] = useState("");
  const [aiSummary, setAiSummary] = useState(null);
  const [aiSummaryLoading, setAiSummaryLoading] = useState(false);
  const [aiSummaryError, setAiSummaryError] = useState("");
  const [activeWorkspaceSection, setActiveWorkspaceSection] = useState("");
  const sectionRefs = {
    symptoms: useRef(null),
    medications: useRef(null),
    diagnoses: useRef(null),
    activity: useRef(null),
  };
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
    const normalizedNotes = (notes.notes || []).map((note) => {
      let structured = note.structured || null;
      if (!structured && note.content) {
        try {
          structured = JSON.parse(note.content);
        } catch {
          structured = null;
        }
      }
      return structured ? { id: note.id, createdAt: note.date || note.createdAt, ...structured } : null;
    }).filter(Boolean);
    setLocalNotes(normalizedNotes);
    setLocalPlans(getPatientTreatmentPlans(currentPatientId));
    setEmergencyReview(getDoctorEmergencyReview(currentPatientId));
    setCommunicationConversationId("");
    setCommunicationMessages([]);
    setCommunicationError("");
    setCommunicationDraft("");
    setCommunicationContextType("");
    setCommunicationContextRelatedId("");
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

  async function loadAiSummary(currentPatientId) {
    try {
      setAiSummaryLoading(true);
      setAiSummaryError("");
      const data = await fetchPatientAiSummary(currentPatientId);
      setAiSummary(data.summary || null);
    } catch (err) {
      setAiSummary(null);
      setAiSummaryError(err.message || "Failed to load AI summary.");
    } finally {
      setAiSummaryLoading(false);
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
  const symptoms = overview?.symptoms || [];
  const appointments = overview?.appointmentsAsPatient || [];
  const caregivers = overview?.caregivers || [];
  const actionableAppointmentStatuses = new Set(["requested", "scheduled", "reschedule_requested"]);
  const upcomingAppointments = appointments
    .filter((appointment) => {
      const startsAtMs = appointment?.startsAt ? new Date(appointment.startsAt).getTime() : NaN;
      if (!Number.isFinite(startsAtMs) || startsAtMs <= Date.now()) return false;
      return actionableAppointmentStatuses.has(String(appointment.status || "").toLowerCase());
    })
    .sort((left, right) => new Date(left.startsAt).getTime() - new Date(right.startsAt).getTime());
  const currentUserId = reqUserId();
  const activeMedications = medications.filter((item) => isActiveMedication(item));
  const nextMedicationDose = getNextMedicationDose(activeMedications);
  const activeDiagnosisCount = diagnoses.filter((item) => item.status === "active").length;

  function openWorkspaceSection(sectionKey) {
    setActiveWorkspaceSection(sectionKey);
    window.setTimeout(() => {
      sectionRefs[sectionKey]?.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 0);
  }

  const communicationContextOptions = [
    ...appointments.map((appointment) => ({
      key: `appointment-${appointment.id}`,
      type: "appointment",
      relatedId: appointment.id,
      label: `Appointment • ${formatDateTime(appointment.startsAt)}`,
    })),
    ...activeMedications.map((medication) => ({
      key: `medication-${medication.id}`,
      type: "medication",
      relatedId: medication.id,
      label: `Medication • ${medication.name}`,
    })),
    ...diagnoses.map((diagnosis) => ({
      key: `diagnosis-${diagnosis.id}`,
      type: "diagnosis",
      relatedId: diagnosis.id,
      label: `Diagnosis • ${diagnosis.diagnosisText}`,
    })),
    ...localNotes.slice(0, 6).map((note) => ({
      key: `medical_note-${note.id}`,
      type: "medical_note",
      relatedId: note.id,
      label: `Clinical note • ${note.noteTitle || "Untitled note"}`,
    })),
    ...(profile?.emergencyStatus ? [{
      key: `care_concern-${patientId}`,
      type: "care_concern",
      relatedId: patientId,
      label: "Care concern • Active emergency alert",
    }] : []),
  ];

  function reqUserId() {
    try {
      const raw = sessionStorage.getItem("user");
      const parsed = raw ? JSON.parse(raw) : null;
      return parsed?.id || "";
    } catch {
      return "";
    }
  }

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

  function handleSaveEmergencyReview(event) {
    event.preventDefault();
    const note = emergencyReviewForm.note.trim();
    if (!note) {
      setEmergencyReviewMessage("Add a short triage note before saving.");
      return;
    }
    const review = saveDoctorEmergencyReview(patientId, {
      reviewedAt: new Date().toISOString(),
      disposition: emergencyReviewForm.disposition,
      note,
    });
    setEmergencyReview(review);
    setEmergencyReviewMessage("Emergency review saved.");
  }

  async function ensurePatientConversation() {
    const created = await createConversation({ recipientId: patientId });
    return created.conversation?.id || "";
  }

  async function loadPatientConversation() {
    try {
      setCommunicationLoading(true);
      setCommunicationError("");
      const conversationId = await ensurePatientConversation();
      setCommunicationConversationId(conversationId);
      if (!conversationId) {
        setCommunicationMessages([]);
        return;
      }
      const messagesData = await getConversationMessages(conversationId);
      setCommunicationMessages(messagesData.messages || []);
    } catch (err) {
      setCommunicationError(err.message || "Failed to load patient communication.");
    } finally {
      setCommunicationLoading(false);
    }
  }

  async function handleSendContextMessage(event) {
    event.preventDefault();
    const body = communicationDraft.trim();
    if (!body) {
      setCommunicationError("Write a message first.");
      return;
    }
    try {
      setSendingCommunication(true);
      setCommunicationError("");
      const conversationId = communicationConversationId || await ensurePatientConversation();
      setCommunicationConversationId(conversationId);
      const selectedContext = communicationContextOptions.find(
        (option) => option.type === communicationContextType && option.relatedId === communicationContextRelatedId
      );
      const data = await sendConversationMessage(conversationId, body, communicationContextType && communicationContextRelatedId ? {
        contextType: communicationContextType,
        contextRelatedId: communicationContextRelatedId,
        contextMetadata: {
          patientId,
          patientName: overview ? patientDisplayName(overview) : "Patient",
          label: selectedContext?.label || null,
        },
      } : {});
      setCommunicationMessages((current) => [...current, data.data]);
      setCommunicationDraft("");
    } catch (err) {
      setCommunicationError(err.message || "Failed to send message.");
    } finally {
      setSendingCommunication(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />
      <main className="mx-auto max-w-7xl px-6 pb-10 pt-28">
        <section className="rounded-[2rem] bg-gradient-to-r from-slate-900 via-sky-800 to-cyan-600 p-8 text-white shadow-xl">
          <p className="text-sm font-semibold uppercase tracking-[0.25em] text-white/75">Doctor Workspace</p>
          <h1 className="mt-3 text-4xl font-black">{overview ? patientDisplayName(overview) : 'Patient detail'}</h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-white/85">Clinical context, notes, appointments, and treatment summary for this patient.</p>
          <p className="mt-2 text-xs text-white/70">Click a summary card to open its detailed section.</p>
          <div className="mt-5 flex flex-wrap gap-3">
            <button type="button" onClick={() => navigate('/doctor-patients')} className="rounded-xl bg-white/15 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/25">Back to patients</button>
          </div>
          <div className="mt-6 grid gap-4 md:grid-cols-4">
            <SummaryMetric label="Symptoms" value={symptoms.length} hint="Recorded symptom logs" tone="emerald" active={activeWorkspaceSection === "symptoms"} onClick={() => openWorkspaceSection("symptoms")} />
            <SummaryMetric label="Medications" value={activeMedications.length} hint={nextMedicationDose ? `Next at ${formatDoseTime(nextMedicationDose.at)}` : "No dose queued"} tone="sky" active={activeWorkspaceSection === "medications"} onClick={() => openWorkspaceSection("medications")} />
            <SummaryMetric label="Diagnoses" value={activeDiagnosisCount} hint="Active conditions tracked" tone="violet" active={activeWorkspaceSection === "diagnoses"} onClick={() => openWorkspaceSection("diagnoses")} />
            <SummaryMetric label="Activity" value={workspace?.timeline?.length || 0} hint="Recent patient events" tone="amber" active={activeWorkspaceSection === "activity"} onClick={() => openWorkspaceSection("activity")} />
          </div>
        </section>
        {error ? <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}
        {loading ? <div className="mt-6 rounded-2xl border border-dashed border-slate-200 px-6 py-8 text-center text-sm text-slate-500">Loading patient detail...</div> : overview ? (
          <div className="mt-6">
            <div className="grid gap-5 xl:grid-cols-2">
            <div className="rounded-3xl bg-gradient-to-br from-white to-slate-50 p-5 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h3 className="text-lg font-semibold text-slate-900">Profile and emergency</h3>
                  <p className="mt-1 text-sm text-slate-500">Core patient identity, medical context, and emergency contacts.</p>
                </div>
                <InfoPill label="Emergency" value={profile?.emergencyStatus ? "Active" : "Normal"} tone={profile?.emergencyStatus ? "rose" : "emerald"} />
              </div>
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                {[
                  ["Email", formatField(overview.email)],
                  ["Date of birth", formatField(profile?.dateOfBirth)],
                  ["Sex", formatField(profile?.sex)],
                  ["Blood type", formatField(profile?.bloodType)],
                  ["Allergies", formatField(profile?.allergies)],
                  ["Medical conditions", formatField(profile?.medicalConditions)],
                  ["Emergency contact", formatEmergencyContact(profile?.emergencyContact)],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-2xl border border-slate-200 bg-white/80 p-4">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">{label}</p>
                    <p className="mt-2 text-sm text-slate-700">{value}</p>
                  </div>
                ))}
              </div>
            </div>
            <div className="rounded-3xl bg-gradient-to-br from-white to-rose-50 p-5 shadow-sm">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="text-lg font-semibold text-slate-900">Emergency alert review</h3>
                  <p className="mt-1 text-sm text-slate-500">Review the patient's current emergency state and record your triage note.</p>
                </div>
                <InfoPill
                  label="Alert"
                  value={profile?.emergencyStatus ? "Active" : "Normal"}
                  tone={profile?.emergencyStatus ? "rose" : "emerald"}
                />
              </div>
              <div className="mt-4 grid gap-3 md:grid-cols-3">
                <div className="rounded-2xl border border-slate-200 bg-white/90 p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">Emergency updated</p>
                  <p className="mt-2 text-sm font-semibold text-slate-900">{formatDateTime(profile?.emergencyStatusUpdatedAt)}</p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white/90 p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">Emergency contact</p>
                  <p className="mt-2 text-sm font-semibold text-slate-900">{formatEmergencyContact(profile?.emergencyContact)}</p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white/90 p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">Latest symptom event</p>
                  <p className="mt-2 text-sm font-semibold text-slate-900">
                    {workspace?.timeline?.find((item) => item.type === "symptom")?.detail || "No recent symptom event"}
                  </p>
                </div>
              </div>
              {profile?.emergencyStatus ? (
                <form onSubmit={handleSaveEmergencyReview} className="mt-4 rounded-2xl border border-rose-200 bg-white/90 p-4">
                  <div className="grid gap-4 md:grid-cols-[220px_minmax(0,1fr)]">
                    <label className="text-sm font-medium text-slate-700">
                      Disposition
                      <select
                        value={emergencyReviewForm.disposition}
                        onChange={(event) => setEmergencyReviewForm((current) => ({ ...current, disposition: event.target.value }))}
                        className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-rose-400 focus:ring-2 focus:ring-rose-100"
                      >
                        <option value="monitoring">Continue monitoring</option>
                        <option value="same-day follow-up">Same-day follow-up needed</option>
                        <option value="urgent escalation">Urgent escalation</option>
                      </select>
                    </label>
                    <label className="text-sm font-medium text-slate-700">
                      Doctor triage note
                      <textarea
                        value={emergencyReviewForm.note}
                        onChange={(event) => setEmergencyReviewForm((current) => ({ ...current, note: event.target.value }))}
                        rows={3}
                        placeholder="Example: Alert reviewed at 14:10. Patient should be contacted immediately and symptoms rechecked before deciding on ED referral."
                        className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-rose-400 focus:ring-2 focus:ring-rose-100"
                      />
                    </label>
                  </div>
                  <div className="mt-4 flex flex-wrap items-center gap-3">
                    <button type="submit" className="rounded-xl bg-rose-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-rose-700">
                      Save emergency review
                    </button>
                    {emergencyReviewMessage ? <span className="text-sm font-medium text-rose-700">{emergencyReviewMessage}</span> : null}
                  </div>
                </form>
              ) : (
                <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                  No active emergency alert. Review symptoms and recent activity above, and return here if the patient is escalated.
                </div>
              )}
              {emergencyReview ? (
                <div className="mt-4 rounded-2xl border border-slate-200 bg-white/90 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <p className="text-sm font-semibold text-slate-900">Latest doctor emergency review</p>
                    <InfoPill label="Disposition" value={emergencyReview.disposition} tone="rose" />
                  </div>
                  <p className="mt-2 text-sm text-slate-700">{emergencyReview.note}</p>
                  <p className="mt-2 text-xs text-slate-400">{formatDateTime(emergencyReview.reviewedAt)}</p>
                </div>
              ) : null}
            </div>
            <div className="rounded-3xl bg-gradient-to-br from-white to-cyan-50 p-5 shadow-sm xl:col-span-2">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h3 className="text-lg font-semibold text-slate-900">AI clinical snapshot</h3>
                  <p className="mt-1 text-sm text-slate-500">Doctor-facing summary generated from a privacy-minimized clinical snapshot. It supports readability only and does not replace clinical judgment.</p>
                </div>
                <button
                  type="button"
                  onClick={() => loadAiSummary(patientId)}
                  disabled={aiSummaryLoading}
                  className="rounded-xl bg-cyan-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-cyan-700 disabled:bg-cyan-300"
                >
                  {aiSummaryLoading ? "Generating..." : aiSummary ? "Refresh summary" : "Generate summary"}
                </button>
              </div>
              {aiSummaryError ? <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{aiSummaryError}</div> : null}
              {aiSummary ? (
                <div className="mt-4 grid gap-4 lg:grid-cols-[1.25fr_0.75fr]">
                  <div className="rounded-2xl border border-slate-200 bg-white/90 p-4">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-cyan-700">Clinical snapshot</p>
                    <p className="mt-3 text-sm leading-6 text-slate-700">{aiSummary.clinicalSnapshot || "No summary generated. Refresh the summary after more patient data is recorded to get a richer snapshot."}</p>
                    <p className="mt-3 text-xs text-slate-400">Generated {formatDateTime(aiSummary.generatedAt)} • {aiSummary.model}</p>
                  </div>
                  <div className="grid gap-4">
                    <div className="rounded-2xl border border-slate-200 bg-white/90 p-4">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-cyan-700">Care risks</p>
                      <div className="mt-3 space-y-2">
                        {aiSummary.careRisks?.length ? aiSummary.careRisks.map((item, index) => (
                          <div key={`${index}-${item}`} className="rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-900">{item}</div>
                        )) : <p className="text-sm text-slate-500">No flagged risks in summary. Continue routine monitoring and refresh after new clinical events if needed.</p>}
                      </div>
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-white/90 p-4">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-cyan-700">Follow-up focus</p>
                      <div className="mt-3 space-y-2">
                        {aiSummary.followUpFocus?.length ? aiSummary.followUpFocus.map((item, index) => (
                          <div key={`${index}-${item}`} className="rounded-xl bg-sky-50 px-3 py-2 text-sm text-sky-900">{item}</div>
                        )) : <p className="text-sm text-slate-500">No follow-up focus items generated. Add notes, medications, or diagnoses, then refresh if you want a more directed follow-up summary.</p>}
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="mt-4 rounded-2xl border border-dashed border-slate-200 px-4 py-6 text-sm text-slate-500">
                  Generate an AI summary to get a concise clinician-facing snapshot of this patient without sending direct identifiers.
                </div>
              )}
            </div>
            {activeWorkspaceSection === "medications" ? (
            <div ref={sectionRefs.medications} className="rounded-3xl bg-gradient-to-br from-white to-amber-50 p-5 shadow-sm">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="text-lg font-semibold text-slate-900">Medication plan</h3>
                  <p className="mt-1 text-sm text-slate-500">Current and historical medications for this patient.</p>
                </div>
                <button
                  type="button"
                  onClick={() => openMedicationForm()}
                  className="rounded-lg bg-sky-100 px-3 py-1.5 text-xs font-semibold text-sky-700 transition hover:bg-sky-200"
                >
                  Add medication
                </button>
              </div>
              {medicationError ? (
                <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {medicationError}
                </div>
              ) : null}
              {medicationFormOpen ? (
                <form onSubmit={handleMedicationSubmit} className="mt-4 rounded-2xl border border-slate-200 bg-white/90 p-4">
                  <div className="grid gap-3 md:grid-cols-2">
                    <label className="text-sm font-medium text-slate-700">
                      Medication name
                      <input
                        type="text"
                        value={medicationForm.name}
                        onChange={(event) => setMedicationForm((current) => ({ ...current, name: event.target.value }))}
                        className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
                        required
                      />
                    </label>
                    <div className="grid grid-cols-[1fr_120px] gap-2">
                      <label className="text-sm font-medium text-slate-700">
                        Dose amount
                        <input
                          type="number"
                          step="0.01"
                          min="0.01"
                          value={medicationForm.doseAmount}
                          onChange={(event) => setMedicationForm((current) => ({ ...current, doseAmount: event.target.value }))}
                          className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
                          required
                        />
                      </label>
                      <label className="text-sm font-medium text-slate-700">
                        Unit
                        <input
                          type="text"
                          value={medicationForm.doseUnit}
                          onChange={(event) => setMedicationForm((current) => ({ ...current, doseUnit: event.target.value }))}
                          className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
                          required
                        />
                      </label>
                    </div>
                    <label className="text-sm font-medium text-slate-700">
                      Frequency
                      <input
                        type="text"
                        value={medicationForm.frequency}
                        onChange={(event) => setMedicationForm((current) => ({ ...current, frequency: event.target.value }))}
                        className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
                      />
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <label className="text-sm font-medium text-slate-700">
                        Start date
                        <input
                          type="date"
                          value={medicationForm.startDate}
                          onChange={(event) => setMedicationForm((current) => ({ ...current, startDate: event.target.value }))}
                          className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
                        />
                      </label>
                      <label className="text-sm font-medium text-slate-700">
                        End date
                        <input
                          type="date"
                          value={medicationForm.endDate}
                          onChange={(event) => setMedicationForm((current) => ({ ...current, endDate: event.target.value }))}
                          className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
                        />
                      </label>
                    </div>
                    <div className="md:col-span-2">
                      <p className="text-sm font-medium text-slate-700">Schedule times</p>
                      <div className="mt-2 space-y-2">
                        {medicationForm.scheduleTimes.map((time, index) => (
                          <div key={`${index}-${time}`} className="flex items-center gap-2">
                            <input
                              type="time"
                              value={time}
                              onChange={(event) => updateMedicationTime(index, event.target.value)}
                              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
                            />
                            <button type="button" onClick={() => removeMedicationTime(index)} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100">Remove</button>
                          </div>
                        ))}
                      </div>
                      <button type="button" onClick={addMedicationTime} className="mt-2 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100">Add time</button>
                    </div>
                    <label className="md:col-span-2 text-sm font-medium text-slate-700">
                      Notes
                      <textarea
                        rows={3}
                        value={medicationForm.notes}
                        onChange={(event) => setMedicationForm((current) => ({ ...current, notes: event.target.value }))}
                        className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
                      />
                    </label>
                  </div>
                  <div className="mt-4 flex items-center gap-3">
                    <button type="submit" disabled={savingMedication} className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:bg-slate-400">
                      {savingMedication ? "Saving..." : editingMedicationId ? "Update medication" : "Save medication"}
                    </button>
                    <button type="button" onClick={() => setMedicationFormOpen(false)} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100">
                      Cancel
                    </button>
                  </div>
                </form>
              ) : null}
              <div className="mt-4 space-y-3">
                {medications.length ? medications.map((medication) => {
                  const scheduleTimes = formatScheduleInput(medication.scheduleJson, medication.frequency) || [];
                  return (
                    <div key={medication.id} className="rounded-2xl border border-slate-200 bg-white/90 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-semibold text-slate-900">{medication.name || "Unnamed medication"}</p>
                          <p className="mt-1 text-sm text-slate-600">
                            {formatMedicationDose(medication)} • {medication.frequency || "Frequency not recorded"}
                          </p>
                        </div>
                        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${getMedicationStatus(medication) === "Active" ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-700"}`}>
                          {getMedicationStatus(medication)}
                        </span>
                      </div>
                      <p className="mt-2 text-xs text-slate-500">
                        Schedule: {scheduleTimes.length ? scheduleTimes.join(", ") : "No schedule times"}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        Start {formatDate(medication.startDate)} • End {formatDate(medication.endDate)}
                      </p>
                      {medication.notes ? <p className="mt-2 text-sm text-slate-700">{medication.notes}</p> : null}
                      <div className="mt-3 flex items-center gap-2">
                        <button type="button" onClick={() => openMedicationForm(medication)} className="rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-200">
                          Edit
                        </button>
                        <button type="button" onClick={() => handleMedicationDelete(medication.id)} className="rounded-lg bg-rose-100 px-3 py-1.5 text-xs font-semibold text-rose-700 transition hover:bg-rose-200">
                          Delete
                        </button>
                      </div>
                    </div>
                  );
                }) : <p className="text-sm text-slate-500">No medications recorded yet for this patient.</p>}
              </div>
            </div>
            ) : null}
            <div className="rounded-3xl bg-gradient-to-br from-white to-amber-50 p-5 shadow-sm">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="text-lg font-semibold text-slate-900">Appointments</h3>
                  <p className="mt-1 text-sm text-slate-500">Upcoming patient visits with this doctor.</p>
                </div>
                <InfoPill label="Upcoming" value={upcomingAppointments.length} tone="amber" />
              </div>
              <div className="mt-4 space-y-3">
                {upcomingAppointments.length ? upcomingAppointments.slice(0, 5).map((appointment) => (
                  <div key={appointment.id} className="rounded-2xl border border-slate-200 bg-white/90 p-4">
                    <div className="flex items-center justify-between gap-3"><p className="font-semibold text-slate-900">{formatDateTime(appointment.startsAt)}</p><span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">{appointment.status}</span></div>
                    <p className="mt-1 text-sm text-slate-500">{appointment.location || 'Location pending'}</p>
                    <p className="mt-1 text-sm text-slate-500">{appointment.notes || 'No notes.'}</p>
                  </div>
                )) : <p className="text-sm text-slate-500">No upcoming appointment items for this patient right now.</p>}
              </div>
            </div>
            {activeWorkspaceSection === "symptoms" ? (
            <div ref={sectionRefs.symptoms} className="rounded-3xl bg-gradient-to-br from-white to-emerald-50 p-5 shadow-sm">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="text-lg font-semibold text-slate-900">Symptoms</h3>
                  <p className="mt-1 text-sm text-slate-500">Recent and historical symptom entries for this patient.</p>
                </div>
                <InfoPill label="Logged" value={symptoms.length} tone="emerald" />
              </div>
              <div className="mt-4 space-y-3">
                {symptoms.length ? symptoms
                  .slice()
                  .sort((left, right) => new Date(right.loggedAt || right.createdAt || right.updatedAt || 0) - new Date(left.loggedAt || left.createdAt || left.updatedAt || 0))
                  .map((symptom) => (
                    <div key={symptom.id} className="rounded-2xl border border-slate-200 bg-white/90 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-semibold text-slate-900">{symptom.symptomName || symptom.name || "Symptom"}</p>
                          <p className="mt-1 text-sm text-slate-500">
                            Severity: {symptom.severity || "Not recorded"} • Logged {formatDateTime(symptom.loggedAt || symptom.createdAt || symptom.updatedAt)}
                          </p>
                        </div>
                        <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">
                          {symptom.status || "Recorded"}
                        </span>
                      </div>
                      {symptom.notes ? <p className="mt-2 text-sm text-slate-700">{symptom.notes}</p> : null}
                    </div>
                  )) : <p className="text-sm text-slate-500">No symptoms recorded yet for this patient.</p>}
              </div>
            </div>
            ) : null}
            <div className="rounded-3xl bg-gradient-to-br from-white to-sky-50 p-5 shadow-sm xl:col-span-2">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h3 className="text-lg font-semibold text-slate-900">Patient-context communication</h3>
                  <p className="mt-1 text-sm text-slate-500">Send a patient-specific update from this workspace and attach the relevant patient context.</p>
                </div>
                <button
                  type="button"
                  onClick={loadPatientConversation}
                  className="rounded-xl bg-sky-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-sky-700"
                >
                  {communicationConversationId ? "Refresh conversation" : "Open patient conversation"}
                </button>
              </div>
              <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
                <div className="rounded-2xl border border-slate-200 bg-white/90 p-4">
                  {communicationLoading ? (
                    <p className="text-sm text-slate-500">Loading patient conversation...</p>
                  ) : communicationMessages.length ? (
                    <div className="space-y-3">
                      {communicationMessages.slice(-6).map((message) => {
                        const isCurrentUser = message.sender?.id === currentUserId;
                        return (
                          <div
                            key={message.id}
                            className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm ${
                              isCurrentUser
                                ? "ml-auto bg-sky-600 text-white"
                                : "bg-slate-100 text-slate-800"
                            }`}
                          >
                            <p>{message.body}</p>
                            <p className={`mt-2 text-[11px] ${isCurrentUser ? "text-white/75" : "text-slate-400"}`}>
                              {message.sender?.displayName || message.sender?.email || "Participant"} • {formatDateTime(message.sentAt)}
                            </p>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-sm text-slate-500">No patient conversation loaded yet. Click Open patient conversation, then send a contextual update from this panel.</p>
                  )}
                </div>
                <form onSubmit={handleSendContextMessage} className="rounded-2xl border border-slate-200 bg-white/90 p-4">
                  <label className="block text-sm font-medium text-slate-700">
                    Context type
                    <select
                      value={communicationContextType}
                      onChange={(event) => {
                        const nextType = event.target.value;
                        setCommunicationContextType(nextType);
                        setCommunicationContextRelatedId("");
                      }}
                      className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
                    >
                      <option value="">General update</option>
                      <option value="appointment">Appointment</option>
                      <option value="medication">Medication</option>
                      <option value="diagnosis">Diagnosis</option>
                      <option value="medical_note">Clinical note</option>
                      {profile?.emergencyStatus ? <option value="care_concern">Care concern</option> : null}
                    </select>
                  </label>
                  {communicationContextType ? (
                    <label className="mt-3 block text-sm font-medium text-slate-700">
                      Context item
                      <select
                        value={communicationContextRelatedId}
                        onChange={(event) => setCommunicationContextRelatedId(event.target.value)}
                        className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
                      >
                        <option value="">Select context</option>
                        {communicationContextOptions
                          .filter((option) => option.type === communicationContextType)
                          .map((option) => (
                            <option key={option.key} value={option.relatedId}>
                              {option.label}
                            </option>
                          ))}
                      </select>
                    </label>
                  ) : null}
                  <label className="mt-3 block text-sm font-medium text-slate-700">
                    Message
                    <textarea
                      value={communicationDraft}
                      onChange={(event) => setCommunicationDraft(event.target.value)}
                      rows={4}
                      placeholder="Example: I reviewed your latest medication adjustment. Keep the evening dose unchanged until the next visit."
                      className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
                    />
                  </label>
                  {communicationError ? <div className="mt-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{communicationError}</div> : null}
                  <div className="mt-4 flex flex-wrap items-center gap-3">
                    <button
                      type="submit"
                      disabled={sendingCommunication}
                      className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:bg-slate-400"
                    >
                      {sendingCommunication ? "Sending..." : "Send patient update"}
                    </button>
                    {communicationContextType && communicationContextRelatedId ? (
                      <InfoPill
                        label="Attached"
                        value={
                          communicationContextOptions.find(
                            (option) => option.type === communicationContextType && option.relatedId === communicationContextRelatedId
                          )?.label || "Context"
                        }
                        tone="sky"
                      />
                    ) : null}
                  </div>
                </form>
              </div>
            </div>
            <div className="rounded-3xl bg-gradient-to-br from-white to-indigo-50 p-5 shadow-sm xl:col-span-2">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-lg font-semibold text-slate-900">Clinical notes</h3>
                <div className="flex items-center gap-2">
                  <button type="button" onClick={() => navigate(`/doctor-treatment-plans?patientId=${patientId}`)} className="rounded-lg bg-violet-100 px-3 py-1.5 text-xs font-semibold text-violet-700 transition hover:bg-violet-200">Open plans</button>
                  <button type="button" onClick={() => navigate(`/doctor-clinical-notes?patientId=${patientId}`)} className="rounded-lg bg-indigo-100 px-3 py-1.5 text-xs font-semibold text-indigo-700 transition hover:bg-indigo-200">Open notes</button>
                </div>
              </div>
              <div className="mt-4 space-y-3">
                {localNotes.length ? localNotes.slice(0,4).map((note) => (
                  <div key={note.id} className="rounded-2xl border border-slate-200 bg-white/90 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <p className="font-semibold text-slate-900">{note.noteTitle}</p>
                      <span className="text-xs text-slate-400">{formatDateTime(note.createdAt)}</span>
                    </div>
                    <p className="mt-2 text-sm text-slate-700">{note.patientSafeSummary || note.diagnosticSummary || note.chiefComplaint}</p>
                    <p className="mt-2 text-xs text-slate-500">Assessment: {note.diagnosticSummary || "Not recorded"}</p>
                  </div>
                )) : workspace.notes.length ? workspace.notes.slice(0,6).map((note) => (
                  <div key={note.id} className="rounded-2xl border border-slate-200 bg-white/90 p-4">
                    <p className="text-sm text-slate-700">{note.content}</p>
                    <p className="mt-2 text-xs text-slate-400">{formatDateTime(note.date)}</p>
                  </div>
                )) : <p className="text-sm text-slate-500">No clinical notes recorded yet. Use Open notes to add the first structured or freeform clinical note.</p>}
              </div>
            </div>
            {activeWorkspaceSection === "diagnoses" ? (
            <div ref={sectionRefs.diagnoses} className="rounded-3xl bg-gradient-to-br from-white to-violet-50 p-5 shadow-sm xl:col-span-2">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-lg font-semibold text-slate-900">Treatment summary</h3>
                <button type="button" onClick={() => navigate(`/doctor-treatment-plans?patientId=${patientId}`)} className="rounded-lg bg-violet-100 px-3 py-1.5 text-xs font-semibold text-violet-700 transition hover:bg-violet-200">Open plans</button>
              </div>
              <div className="mt-4 space-y-3">
                {localPlans.length ? localPlans.slice(0,4).map((plan) => (
                  <div key={plan.id} className="rounded-2xl border border-slate-200 bg-white/90 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <p className="font-semibold text-slate-900">{plan.title}</p>
                      <span className={`rounded-full px-3 py-1 text-xs font-semibold ${plan.status === 'active' ? 'bg-emerald-100 text-emerald-700' : plan.status === 'draft' ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-700'}`}>{plan.status}</span>
                    </div>
                    <p className="mt-2 text-sm text-slate-700">{plan.patientSafeSummary || formatListOutput(plan.treatmentGoals) || "No patient-safe summary provided."}</p>
                    <p className="mt-2 text-xs text-slate-500">Conditions: {formatListOutput(plan.targetConditions) || "Not recorded"}</p>
                  </div>
                )) : diagnoses.length ? diagnoses.slice(0,6).map((diagnosis) => (
                  <div key={diagnosis.id} className="rounded-2xl border border-slate-200 bg-white/90 p-4">
                    <div className="flex items-center justify-between gap-3"><p className="font-semibold text-slate-900">{diagnosis.diagnosisText}</p><span className={`rounded-full px-3 py-1 text-xs font-semibold ${diagnosis.status === 'active' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-700'}`}>{diagnosis.status}</span></div>
                    <p className="mt-2 text-xs text-slate-400">Diagnosed {formatDate(diagnosis.diagnosedAt)}</p>
                  </div>
                )) : <p className="text-sm text-slate-500">No diagnoses or treatment items recorded yet. Use Open plans to define the patient&apos;s first treatment plan or diagnosis summary.</p>}
              </div>
            </div>
            ) : null}
            {activeWorkspaceSection === "activity" ? (
            <div ref={sectionRefs.activity} className="rounded-3xl bg-gradient-to-br from-white to-slate-100 p-5 shadow-sm xl:col-span-2">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="text-lg font-semibold text-slate-900">Activity timeline</h3>
                  <p className="mt-1 text-sm text-slate-500">Recent patient events arranged as a readable clinical timeline.</p>
                </div>
                <InfoPill label="Events" value={workspace.timeline.length} tone="slate" />
              </div>
              <div className="mt-4 space-y-3">
                {workspace.timeline.length ? workspace.timeline.slice(0,8).map((item) => (
                  <div key={`${item.type}-${item.id}`} className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white/90 p-4">
                    <div className="absolute left-5 top-0 h-full w-px bg-slate-200" />
                    <div className="relative flex gap-4">
                      <div className={`mt-1 h-3 w-3 rounded-full ${item.type === "symptom" ? "bg-amber-500" : item.type === "appointment" ? "bg-sky-500" : item.type === "diagnosis" ? "bg-violet-500" : "bg-emerald-500"}`} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-3"><p className="font-semibold text-slate-900">{item.title}</p><span className="text-xs text-slate-400">{formatDateTime(item.timestamp)}</span></div>
                        <p className="mt-2 text-sm text-slate-500">{item.detail}</p>
                      </div>
                    </div>
                  </div>
                )) : <p className="text-sm text-slate-500">No recent activity for this patient yet. After symptoms, appointments, notes, or medications are added, the timeline will populate here.</p>}
              </div>
            </div>
            ) : null}
            </div>
          </div>
        ) : null}
      </main>
    </div>
  );
}
