import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import Navbar from "../components/Navbar";
import { apiUrl, authHeaders } from "../api/http";
import { rememberDoctorPatientTab } from "../utils/doctorPatientTabs";
import {
  formatListInput,
  formatListOutput,
  getPatientClinicalNotes,
  savePatientClinicalNote,
} from "../utils/doctorPatientRecords";

function patientDisplayName(record) {
  const patient = record?.patient || record;
  return (
    [patient?.firstName, patient?.lastName].filter(Boolean).join(" ").trim() ||
    patient?.displayName ||
    patient?.email ||
    "Patient"
  );
}

export default function DoctorClinicalNotes() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [assignedPatients, setAssignedPatients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saveMessage, setSaveMessage] = useState("");
  const [savedNotes, setSavedNotes] = useState([]);
  const [patientOverview, setPatientOverview] = useState(null);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [form, setForm] = useState({
    encounterType: "Follow-up",
    noteTitle: "",
    chiefComplaint: "",
    historyOfPresentIllness: "",
    reviewOfSystems: "",
    vitalSigns: "",
    physicalExam: "",
    diagnosticSummary: "",
    differentialDiagnosis: "",
    chronicConditions: "",
    acuteConcerns: "",
    medicationsReviewed: "",
    allergiesReviewed: "",
    testsOrdered: "",
    proceduresPerformed: "",
    riskAssessment: "",
    redFlags: "",
    carePlan: "",
    patientInstructions: "",
    followUpPlan: "",
    careCoordination: "",
    patientSafeSummary: "",
  });

  const selectedPatientId = searchParams.get("patientId") || "";

  useEffect(() => {
    let cancelled = false;

    async function loadAssignedPatients() {
      setLoading(true);
      setError("");
      try {
        const response = await fetch(`${apiUrl}/api/doctors/assigned-patients`, {
          headers: { "Content-Type": "application/json", ...authHeaders() },
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(data.message || "Failed to load assigned patients.");
        }
        if (!cancelled) {
          const patients = data.patients || [];
          setAssignedPatients(patients);
          const current = patients.find((record) => (record.patient?.id || record.id) === selectedPatientId);
          if (current) {
            rememberDoctorPatientTab({ id: selectedPatientId, name: patientDisplayName(current) });
          }
        }
      } catch (err) {
        if (!cancelled) {
          setAssignedPatients([]);
          setError(err.message || "Failed to load assigned patients.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadAssignedPatients();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function loadOverview() {
      if (!selectedPatientId) {
        setPatientOverview(null);
        return;
      }
      try {
        const response = await fetch(`${apiUrl}/api/doctors/patients/${selectedPatientId}/overview`, {
          headers: { ...authHeaders() },
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.message || "Failed to load patient overview.");
        if (!cancelled) setPatientOverview(data);
      } catch {
        if (!cancelled) setPatientOverview(null);
      }
    }
    loadOverview();
    return () => {
      cancelled = true;
    };
  }, [selectedPatientId]);

  useEffect(() => {
    setSavedNotes(getPatientClinicalNotes(selectedPatientId));
  }, [selectedPatientId]);

  const selectedPatient = useMemo(() => {
    if (!selectedPatientId) return null;
    return assignedPatients.find((record) => (record.patient?.id || record.id) === selectedPatientId) || null;
  }, [assignedPatients, selectedPatientId]);

  function updateField(key, value) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function fillFromPatient(kind) {
    const profile = patientOverview?.patientProfile;
    if (!profile) return;
    if (kind === "conditions") {
      updateField("chronicConditions", Array.isArray(profile.medicalConditions) ? profile.medicalConditions.join("\n") : "");
    }
    if (kind === "allergies") {
      updateField("allergiesReviewed", Array.isArray(profile.allergies) ? profile.allergies.join("\n") : "");
    }
    if (kind === "medications") {
      updateField(
        "medicationsReviewed",
        Array.isArray(patientOverview?.medications)
          ? patientOverview.medications.map((med) => `${med.name}${med.dosage ? ` - ${med.dosage}` : ""}`).join("\n")
          : ""
      );
    }
  }

  function resetForm() {
    setForm({
      encounterType: "Follow-up",
      noteTitle: "",
      chiefComplaint: "",
      historyOfPresentIllness: "",
      reviewOfSystems: "",
      vitalSigns: "",
      physicalExam: "",
      diagnosticSummary: "",
      differentialDiagnosis: "",
      chronicConditions: "",
      acuteConcerns: "",
      medicationsReviewed: "",
      allergiesReviewed: "",
      testsOrdered: "",
      proceduresPerformed: "",
      riskAssessment: "",
      redFlags: "",
      carePlan: "",
      patientInstructions: "",
      followUpPlan: "",
      careCoordination: "",
      patientSafeSummary: "",
    });
  }

  function handleSaveNote(event) {
    event.preventDefault();
    if (!selectedPatientId) return;
    if (!form.noteTitle.trim() || !form.chiefComplaint.trim()) {
      setSaveMessage("Add at least a note title and chief complaint.");
      return;
    }

    const entry = {
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      encounterType: form.encounterType,
      noteTitle: form.noteTitle.trim(),
      chiefComplaint: form.chiefComplaint.trim(),
      historyOfPresentIllness: form.historyOfPresentIllness.trim(),
      reviewOfSystems: formatListInput(form.reviewOfSystems),
      vitalSigns: formatListInput(form.vitalSigns),
      physicalExam: formatListInput(form.physicalExam),
      diagnosticSummary: form.diagnosticSummary.trim(),
      differentialDiagnosis: formatListInput(form.differentialDiagnosis),
      chronicConditions: formatListInput(form.chronicConditions),
      acuteConcerns: formatListInput(form.acuteConcerns),
      medicationsReviewed: formatListInput(form.medicationsReviewed),
      allergiesReviewed: formatListInput(form.allergiesReviewed),
      testsOrdered: formatListInput(form.testsOrdered),
      proceduresPerformed: formatListInput(form.proceduresPerformed),
      riskAssessment: form.riskAssessment.trim(),
      redFlags: formatListInput(form.redFlags),
      carePlan: formatListInput(form.carePlan),
      patientInstructions: formatListInput(form.patientInstructions),
      followUpPlan: form.followUpPlan.trim(),
      careCoordination: formatListInput(form.careCoordination),
      patientSafeSummary: form.patientSafeSummary.trim(),
    };

    const next = savePatientClinicalNote(selectedPatientId, entry);
    setSavedNotes(next);
    setSaveMessage("Clinical note saved for this patient.");
    resetForm();
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />

      <main className="mx-auto max-w-6xl px-6 pb-10 pt-28">
        <section className="rounded-[2rem] bg-gradient-to-r from-slate-900 via-indigo-800 to-cyan-600 p-8 text-white shadow-xl">
          <p className="text-sm font-semibold uppercase tracking-[0.25em] text-white/75">Doctor Workspace</p>
          <h1 className="mt-3 text-4xl font-black">Clinical Notes</h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-white/85">
            Review and manage patient clinical documentation in one place. This shell is ready for note and treatment plan workflows.
          </p>
        </section>

        <section className="mt-6">
          <div className="space-y-6">
            {!selectedPatientId ? (
              <section className="rounded-3xl border border-dashed border-slate-200 bg-white p-8 text-sm text-slate-500 shadow-sm">
                Open a patient from the patients page first. Clinical notes are scoped through patient context now.
              </section>
            ) : (
              <>
                <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <h2 className="text-xl font-semibold text-slate-900">
                        {selectedPatient ? `${patientDisplayName(selectedPatient)} · Clinical notes` : "Clinical notes"}
                      </h2>
                    </div>
                    <div className="flex flex-wrap gap-3">
                      <button
                        type="button"
                        onClick={() => navigate(`/doctor-patients/${selectedPatientId}`)}
                        className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                      >
                        Back to patient detail
                      </button>
                      <button
                        type="button"
                        onClick={() => navigate(`/doctor-treatment-plans?patientId=${selectedPatientId}`)}
                        className="rounded-xl bg-violet-100 px-4 py-2 text-sm font-semibold text-violet-700 transition hover:bg-violet-200"
                      >
                        Open treatment plans
                      </button>
                    </div>
                  </div>
                </section>

                <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                  <h2 className="text-xl font-semibold text-slate-900">Clinical notes shell</h2>
                  <p className="mt-1 text-sm text-slate-500">
                    Start with a quick clinical note, then expand advanced details only if you need them.
                  </p>

                  <div className="mt-4 flex flex-wrap gap-2">
                    <button type="button" onClick={() => fillFromPatient("allergies")} className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-200">Import allergies</button>
                    <button type="button" onClick={() => fillFromPatient("medications")} className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-200">Import medications</button>
                    <button type="button" onClick={() => setShowAdvanced((current) => !current)} className="rounded-full bg-indigo-100 px-3 py-1.5 text-xs font-semibold text-indigo-700 transition hover:bg-indigo-200">
                      {showAdvanced ? "Hide advanced details" : "Add more detail"}
                    </button>
                  </div>

                  <form onSubmit={handleSaveNote} className="mt-5 space-y-5">
                    <div className="grid gap-4 md:grid-cols-3">
                      <label className="space-y-2">
                        <span className="text-sm font-semibold text-slate-700">Encounter type</span>
                        <select
                          value={form.encounterType}
                          onChange={(event) => updateField("encounterType", event.target.value)}
                          className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                        >
                          <option>Initial consult</option>
                          <option>Follow-up</option>
                          <option>Urgent review</option>
                          <option>Post-procedure</option>
                          <option>Chronic care review</option>
                          <option>Discharge follow-up</option>
                        </select>
                      </label>
                      <label className="space-y-2 md:col-span-2">
                        <span className="text-sm font-semibold text-slate-700">Note title</span>
                        <input
                          value={form.noteTitle}
                          onChange={(event) => updateField("noteTitle", event.target.value)}
                          placeholder="Example: Diabetes follow-up with medication adjustment"
                          className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                        />
                      </label>
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                      <label className="space-y-2">
                        <span className="text-sm font-semibold text-slate-700">Chief complaint</span>
                        <textarea value={form.chiefComplaint} onChange={(event) => updateField("chiefComplaint", event.target.value)} rows={3} className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm" />
                      </label>
                      <label className="space-y-2">
                        <span className="text-sm font-semibold text-slate-700">Diagnostic summary / assessment</span>
                        <textarea value={form.diagnosticSummary} onChange={(event) => updateField("diagnosticSummary", event.target.value)} rows={3} className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm" />
                      </label>
                      <label className="space-y-2">
                        <span className="text-sm font-semibold text-slate-700">Care plan actions</span>
                        <textarea value={form.carePlan} onChange={(event) => updateField("carePlan", event.target.value)} rows={4} placeholder="One action per line" className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm" />
                      </label>
                      <label className="space-y-2">
                        <span className="text-sm font-semibold text-slate-700">Patient instructions</span>
                        <textarea value={form.patientInstructions} onChange={(event) => updateField("patientInstructions", event.target.value)} rows={4} placeholder="One instruction per line" className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm" />
                      </label>
                      <label className="space-y-2">
                        <span className="text-sm font-semibold text-slate-700">Follow-up plan</span>
                        <textarea value={form.followUpPlan} onChange={(event) => updateField("followUpPlan", event.target.value)} rows={3} className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm" />
                      </label>
                      <label className="space-y-2">
                        <span className="text-sm font-semibold text-slate-700">Patient-safe summary</span>
                        <textarea value={form.patientSafeSummary} onChange={(event) => updateField("patientSafeSummary", event.target.value)} rows={3} placeholder="Concise summary that can safely surface in the patient view." className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm" />
                      </label>
                    </div>

                    {showAdvanced ? (
                      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                        <p className="text-sm font-semibold text-slate-900">Advanced details</p>
                        <p className="mt-1 text-xs text-slate-500">Use these only when the note needs deeper clinical structure.</p>
                        <div className="mt-4 grid gap-4 md:grid-cols-2">
                          <label className="space-y-2">
                            <span className="text-sm font-semibold text-slate-700">History of present illness</span>
                            <textarea value={form.historyOfPresentIllness} onChange={(event) => updateField("historyOfPresentIllness", event.target.value)} rows={3} className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm" />
                          </label>
                          <label className="space-y-2">
                            <span className="text-sm font-semibold text-slate-700">Review of systems</span>
                            <textarea value={form.reviewOfSystems} onChange={(event) => updateField("reviewOfSystems", event.target.value)} rows={4} placeholder="One item per line" className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm" />
                          </label>
                          <label className="space-y-2">
                            <span className="text-sm font-semibold text-slate-700">Vital signs</span>
                            <textarea value={form.vitalSigns} onChange={(event) => updateField("vitalSigns", event.target.value)} rows={4} placeholder="BP, HR, Temp, SpO2, weight..." className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm" />
                          </label>
                          <label className="space-y-2">
                            <span className="text-sm font-semibold text-slate-700">Physical exam</span>
                            <textarea value={form.physicalExam} onChange={(event) => updateField("physicalExam", event.target.value)} rows={4} placeholder="General, cardio, respiratory, neuro..." className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm" />
                          </label>
                          <label className="space-y-2">
                            <span className="text-sm font-semibold text-slate-700">Differential diagnosis</span>
                            <textarea value={form.differentialDiagnosis} onChange={(event) => updateField("differentialDiagnosis", event.target.value)} rows={4} placeholder="One item per line" className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm" />
                          </label>
                          <label className="space-y-2">
                            <span className="text-sm font-semibold text-slate-700">Chronic conditions / active problem list</span>
                            <textarea value={form.chronicConditions} onChange={(event) => updateField("chronicConditions", event.target.value)} rows={4} placeholder="One item per line" className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm" />
                          </label>
                          <label className="space-y-2">
                            <span className="text-sm font-semibold text-slate-700">Acute concerns</span>
                            <textarea value={form.acuteConcerns} onChange={(event) => updateField("acuteConcerns", event.target.value)} rows={4} placeholder="One item per line" className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm" />
                          </label>
                          <label className="space-y-2">
                            <span className="text-sm font-semibold text-slate-700">Medications reviewed / changed</span>
                            <textarea value={form.medicationsReviewed} onChange={(event) => updateField("medicationsReviewed", event.target.value)} rows={4} placeholder="One item per line" className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm" />
                          </label>
                          <label className="space-y-2">
                            <span className="text-sm font-semibold text-slate-700">Allergies / intolerances reviewed</span>
                            <textarea value={form.allergiesReviewed} onChange={(event) => updateField("allergiesReviewed", event.target.value)} rows={4} placeholder="One item per line" className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm" />
                          </label>
                          <label className="space-y-2">
                            <span className="text-sm font-semibold text-slate-700">Tests / imaging / labs ordered</span>
                            <textarea value={form.testsOrdered} onChange={(event) => updateField("testsOrdered", event.target.value)} rows={4} placeholder="One item per line" className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm" />
                          </label>
                          <label className="space-y-2">
                            <span className="text-sm font-semibold text-slate-700">Procedures performed</span>
                            <textarea value={form.proceduresPerformed} onChange={(event) => updateField("proceduresPerformed", event.target.value)} rows={4} placeholder="One item per line" className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm" />
                          </label>
                          <label className="space-y-2">
                            <span className="text-sm font-semibold text-slate-700">Risk assessment</span>
                            <textarea value={form.riskAssessment} onChange={(event) => updateField("riskAssessment", event.target.value)} rows={3} placeholder="Stability, fall risk, deterioration risk, medication risk..." className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm" />
                          </label>
                          <label className="space-y-2">
                            <span className="text-sm font-semibold text-slate-700">Red flags / escalation triggers</span>
                            <textarea value={form.redFlags} onChange={(event) => updateField("redFlags", event.target.value)} rows={3} placeholder="One item per line" className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm" />
                          </label>
                          <label className="space-y-2 md:col-span-2">
                            <span className="text-sm font-semibold text-slate-700">Care coordination / referrals</span>
                            <textarea value={form.careCoordination} onChange={(event) => updateField("careCoordination", event.target.value)} rows={4} placeholder="One item per line" className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm" />
                          </label>
                        </div>
                      </div>
                    ) : null}

                    {saveMessage ? <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{saveMessage}</div> : null}

                    <div className="flex flex-wrap gap-3">
                      <button type="submit" className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700">Save clinical note</button>
                      <button
                        type="button"
                        onClick={() => navigate(`/doctor-treatment-plans?patientId=${selectedPatientId}`)}
                        className="rounded-xl bg-sky-100 px-4 py-2 text-sm font-semibold text-sky-700 transition hover:bg-sky-200"
                      >
                        View treatment plans
                      </button>
                    </div>
                  </form>
                </section>

                <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                  <div className="flex items-center justify-between gap-3">
                    <h2 className="text-xl font-semibold text-slate-900">Saved clinical notes</h2>
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">{savedNotes.length}</span>
                  </div>
                  <div className="mt-5 space-y-4">
                    {savedNotes.length ? savedNotes.map((note) => (
                      <div key={note.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <p className="font-semibold text-slate-900">{note.noteTitle}</p>
                            <p className="mt-1 text-sm text-slate-500">{note.encounterType} • {new Date(note.createdAt).toLocaleString()}</p>
                          </div>
                          <span className="rounded-full bg-indigo-100 px-3 py-1 text-xs font-semibold text-indigo-700">Clinical note</span>
                        </div>
                        <div className="mt-4 grid gap-3 md:grid-cols-2">
                          <div>
                            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Chief complaint</p>
                            <p className="mt-1 text-sm text-slate-700">{note.chiefComplaint || "Not recorded"}</p>
                          </div>
                          <div>
                            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Assessment</p>
                            <p className="mt-1 text-sm text-slate-700">{note.diagnosticSummary || "Not recorded"}</p>
                          </div>
                          <div>
                            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Care plan</p>
                            <p className="mt-1 text-sm text-slate-700">{formatListOutput(note.carePlan) || "Not recorded"}</p>
                          </div>
                          <div>
                            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Patient-safe summary</p>
                            <p className="mt-1 text-sm text-slate-700">{note.patientSafeSummary || "Not recorded"}</p>
                          </div>
                        </div>
                      </div>
                    )) : (
                      <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-5 py-6 text-sm text-slate-500">
                        No structured clinical notes saved for this patient yet.
                      </div>
                    )}
                  </div>
                </section>
              </>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
