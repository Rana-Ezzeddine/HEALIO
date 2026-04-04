import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import Navbar from "../components/Navbar";
import { apiUrl, authHeaders } from "../api/http";
import { rememberDoctorPatientTab } from "../utils/doctorPatientTabs";
import {
  formatListInput,
  formatListOutput,
  getPatientTreatmentPlans,
  savePatientTreatmentPlan,
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

const planStatusPill = {
  active: "bg-emerald-100 text-emerald-700",
  draft: "bg-amber-100 text-amber-700",
  archived: "bg-slate-200 text-slate-700",
};

export default function DoctorTreatmentPlans() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [assignedPatients, setAssignedPatients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saveMessage, setSaveMessage] = useState("");
  const [savedPlans, setSavedPlans] = useState([]);
  const [patientOverview, setPatientOverview] = useState(null);
  const [form, setForm] = useState({
    planTitle: "",
    targetConditions: "",
    diagnosisSummary: "",
    severityStage: "",
    planStatus: "active",
    treatmentGoals: "",
    medications: "",
    lifestyleActions: "",
    monitoringPlan: "",
    testsAndFollowUp: "",
    referrals: "",
    contraindications: "",
    escalationCriteria: "",
    caregiverGuidance: "",
    patientInstructions: "",
    reviewCadence: "",
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
    setSavedPlans(getPatientTreatmentPlans(selectedPatientId));
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
    if (kind === "medications") {
      updateField(
        "medications",
        Array.isArray(patientOverview?.medications)
          ? patientOverview.medications.map((med) => `${med.name}${med.dosage ? ` - ${med.dosage}` : ""}`).join("\n")
          : ""
      );
    }
  }

  function resetForm() {
    setForm({
      planTitle: "",
      targetConditions: "",
      diagnosisSummary: "",
      severityStage: "",
      planStatus: "active",
      treatmentGoals: "",
      medications: "",
      lifestyleActions: "",
      monitoringPlan: "",
      testsAndFollowUp: "",
      referrals: "",
      contraindications: "",
      escalationCriteria: "",
      caregiverGuidance: "",
      patientInstructions: "",
      reviewCadence: "",
      patientSafeSummary: "",
    });
  }

  function handleSavePlan(event) {
    event.preventDefault();
    if (!selectedPatientId) return;
    if (!form.planTitle.trim() || !form.targetConditions.trim()) {
      setSaveMessage("Add at least a plan title and target condition.");
      return;
    }

    const entry = {
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      title: form.planTitle.trim(),
      targetConditions: formatListInput(form.targetConditions),
      diagnosisSummary: form.diagnosisSummary.trim(),
      severityStage: form.severityStage.trim(),
      status: form.planStatus,
      treatmentGoals: formatListInput(form.treatmentGoals),
      medications: formatListInput(form.medications),
      lifestyleActions: formatListInput(form.lifestyleActions),
      monitoringPlan: formatListInput(form.monitoringPlan),
      testsAndFollowUp: formatListInput(form.testsAndFollowUp),
      referrals: formatListInput(form.referrals),
      contraindications: formatListInput(form.contraindications),
      escalationCriteria: formatListInput(form.escalationCriteria),
      caregiverGuidance: formatListInput(form.caregiverGuidance),
      patientInstructions: formatListInput(form.patientInstructions),
      reviewCadence: form.reviewCadence.trim(),
      patientSafeSummary: form.patientSafeSummary.trim(),
    };

    const next = savePatientTreatmentPlan(selectedPatientId, entry);
    setSavedPlans(next);
    setSaveMessage("Treatment plan saved for this patient.");
    resetForm();
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />

      <main className="mx-auto max-w-6xl px-6 pb-10 pt-28">
        <section className="rounded-[2rem] bg-gradient-to-r from-slate-900 via-violet-800 to-cyan-600 p-8 text-white shadow-xl">
          <p className="text-sm font-semibold uppercase tracking-[0.25em] text-white/75">Doctor Workspace</p>
          <h1 className="mt-3 text-4xl font-black">Treatment Plans</h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-white/85">
            Build, track, and refine patient treatment plans. This page is a UI shell ready for plan CRUD and version history workflows.
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => navigate("/doctor-clinical-notes")}
              className="rounded-xl bg-white/20 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/30"
            >
              Open clinical notes
            </button>
            <button
              type="button"
              onClick={() => navigate("/doctorAppointments")}
              className="rounded-xl bg-white/15 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/25"
            >
              Open appointments
            </button>
          </div>
        </section>

        <section className="mt-6">
          <div className="space-y-6">
            {!selectedPatientId ? (
              <section className="rounded-3xl border border-dashed border-slate-200 bg-white p-8 text-sm text-slate-500 shadow-sm">
                Open a patient from the patients page first. Treatment plans are scoped through patient context now.
              </section>
            ) : (
              <>
                <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <h2 className="text-xl font-semibold text-slate-900">
                        {selectedPatient ? `${patientDisplayName(selectedPatient)} · Treatment plans` : "Treatment plans"}
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
                        onClick={() => navigate(`/doctor-clinical-notes?patientId=${selectedPatientId}`)}
                        className="rounded-xl bg-indigo-100 px-4 py-2 text-sm font-semibold text-indigo-700 transition hover:bg-indigo-200"
                      >
                        Open clinical notes
                      </button>
                    </div>
                  </div>
                </section>

                <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <h2 className="text-xl font-semibold text-slate-900">Treatment plans shell</h2>
                      <p className="mt-1 text-sm text-slate-500">
                        Create comprehensive treatment plans with goals, medications, monitoring, escalation criteria, and a patient-safe summary.
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    <button type="button" onClick={() => fillFromPatient("medications")} className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-200">Import medications</button>
                  </div>

                  <form onSubmit={handleSavePlan} className="mt-5 space-y-5">
                    <div className="grid gap-4 md:grid-cols-3">
                      <label className="space-y-2 md:col-span-2">
                        <span className="text-sm font-semibold text-slate-700">Plan title</span>
                        <input value={form.planTitle} onChange={(event) => updateField("planTitle", event.target.value)} placeholder="Example: Type 2 diabetes glycemic control plan" className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm" />
                      </label>
                      <label className="space-y-2">
                        <span className="text-sm font-semibold text-slate-700">Plan status</span>
                        <select value={form.planStatus} onChange={(event) => updateField("planStatus", event.target.value)} className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm">
                          <option value="active">active</option>
                          <option value="draft">draft</option>
                          <option value="archived">archived</option>
                        </select>
                      </label>
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                      <label className="space-y-2">
                        <span className="text-sm font-semibold text-slate-700">Target conditions / diagnoses</span>
                        <textarea value={form.targetConditions} onChange={(event) => updateField("targetConditions", event.target.value)} rows={4} placeholder="One condition per line" className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm" />
                      </label>
                      <label className="space-y-2">
                        <span className="text-sm font-semibold text-slate-700">Diagnosis summary / context</span>
                        <textarea value={form.diagnosisSummary} onChange={(event) => updateField("diagnosisSummary", event.target.value)} rows={4} className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm" />
                      </label>
                      <label className="space-y-2">
                        <span className="text-sm font-semibold text-slate-700">Severity / stage / clinical status</span>
                        <input value={form.severityStage} onChange={(event) => updateField("severityStage", event.target.value)} placeholder="Stage, severity, stability..." className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm" />
                      </label>
                      <label className="space-y-2">
                        <span className="text-sm font-semibold text-slate-700">Review cadence</span>
                        <input value={form.reviewCadence} onChange={(event) => updateField("reviewCadence", event.target.value)} placeholder="Every 2 weeks, monthly, after labs..." className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm" />
                      </label>
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                      <label className="space-y-2">
                        <span className="text-sm font-semibold text-slate-700">Treatment goals</span>
                        <textarea value={form.treatmentGoals} onChange={(event) => updateField("treatmentGoals", event.target.value)} rows={4} placeholder="One goal per line" className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm" />
                      </label>
                      <label className="space-y-2">
                        <span className="text-sm font-semibold text-slate-700">Medication strategy</span>
                        <textarea value={form.medications} onChange={(event) => updateField("medications", event.target.value)} rows={4} placeholder="One medication or change per line" className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm" />
                      </label>
                      <label className="space-y-2">
                        <span className="text-sm font-semibold text-slate-700">Lifestyle / rehabilitation actions</span>
                        <textarea value={form.lifestyleActions} onChange={(event) => updateField("lifestyleActions", event.target.value)} rows={4} placeholder="Diet, exercise, sleep, wound care, PT..." className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm" />
                      </label>
                      <label className="space-y-2">
                        <span className="text-sm font-semibold text-slate-700">Monitoring plan</span>
                        <textarea value={form.monitoringPlan} onChange={(event) => updateField("monitoringPlan", event.target.value)} rows={4} placeholder="BP logs, glucose checks, symptom monitoring..." className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm" />
                      </label>
                    </div>

                    <div className="grid gap-4 md:grid-cols-3">
                      <label className="space-y-2">
                        <span className="text-sm font-semibold text-slate-700">Tests and follow-up tasks</span>
                        <textarea value={form.testsAndFollowUp} onChange={(event) => updateField("testsAndFollowUp", event.target.value)} rows={4} placeholder="One item per line" className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm" />
                      </label>
                      <label className="space-y-2">
                        <span className="text-sm font-semibold text-slate-700">Referrals / consultations</span>
                        <textarea value={form.referrals} onChange={(event) => updateField("referrals", event.target.value)} rows={4} placeholder="One item per line" className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm" />
                      </label>
                      <label className="space-y-2">
                        <span className="text-sm font-semibold text-slate-700">Contraindications / precautions</span>
                        <textarea value={form.contraindications} onChange={(event) => updateField("contraindications", event.target.value)} rows={4} placeholder="One item per line" className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm" />
                      </label>
                    </div>

                    <div className="grid gap-4 md:grid-cols-3">
                      <label className="space-y-2">
                        <span className="text-sm font-semibold text-slate-700">Escalation criteria / red flags</span>
                        <textarea value={form.escalationCriteria} onChange={(event) => updateField("escalationCriteria", event.target.value)} rows={4} placeholder="One trigger per line" className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm" />
                      </label>
                      <label className="space-y-2">
                        <span className="text-sm font-semibold text-slate-700">Caregiver guidance</span>
                        <textarea value={form.caregiverGuidance} onChange={(event) => updateField("caregiverGuidance", event.target.value)} rows={4} placeholder="One item per line" className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm" />
                      </label>
                      <label className="space-y-2">
                        <span className="text-sm font-semibold text-slate-700">Patient instructions</span>
                        <textarea value={form.patientInstructions} onChange={(event) => updateField("patientInstructions", event.target.value)} rows={4} placeholder="One instruction per line" className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm" />
                      </label>
                    </div>

                    <label className="space-y-2">
                      <span className="text-sm font-semibold text-slate-700">Patient-safe summary</span>
                      <textarea value={form.patientSafeSummary} onChange={(event) => updateField("patientSafeSummary", event.target.value)} rows={3} placeholder="Concise readable plan summary safe to show in the patient view." className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm" />
                    </label>

                    {saveMessage ? <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{saveMessage}</div> : null}

                    <div className="flex flex-wrap gap-3">
                      <button type="submit" className="rounded-xl bg-violet-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-violet-700">Save treatment plan</button>
                      <button
                        type="button"
                        onClick={() => navigate(`/doctor-clinical-notes?patientId=${selectedPatientId}`)}
                        className="rounded-xl bg-indigo-100 px-4 py-2 text-sm font-semibold text-indigo-700 transition hover:bg-indigo-200"
                      >
                        Open clinical notes
                      </button>
                    </div>
                  </form>
                </section>

                <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                  <div className="flex items-center justify-between gap-3">
                    <h2 className="text-xl font-semibold text-slate-900">Saved treatment plans</h2>
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">{savedPlans.length}</span>
                  </div>
                  <div className="mt-5 space-y-4">
                    {savedPlans.length ? savedPlans.map((plan) => (
                      <div key={plan.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <p className="font-semibold text-slate-900">{plan.title}</p>
                            <p className="mt-1 text-sm text-slate-500">{plan.reviewCadence || "No review cadence set"}</p>
                          </div>
                          <span className={`rounded-full px-3 py-1 text-xs font-semibold ${planStatusPill[plan.status] || "bg-slate-100 text-slate-700"}`}>
                            {plan.status}
                          </span>
                        </div>
                        <div className="mt-4 grid gap-3 md:grid-cols-2">
                          <div>
                            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Target conditions</p>
                            <p className="mt-1 text-sm text-slate-700">{formatListOutput(plan.targetConditions) || "Not recorded"}</p>
                          </div>
                          <div>
                            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Treatment goals</p>
                            <p className="mt-1 text-sm text-slate-700">{formatListOutput(plan.treatmentGoals) || "Not recorded"}</p>
                          </div>
                          <div>
                            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Monitoring</p>
                            <p className="mt-1 text-sm text-slate-700">{formatListOutput(plan.monitoringPlan) || "Not recorded"}</p>
                          </div>
                          <div>
                            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Patient-safe summary</p>
                            <p className="mt-1 text-sm text-slate-700">{plan.patientSafeSummary || "Not recorded"}</p>
                          </div>
                        </div>
                      </div>
                    )) : (
                      <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-5 py-6 text-sm text-slate-500">
                        No structured treatment plans saved for this patient yet.
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
