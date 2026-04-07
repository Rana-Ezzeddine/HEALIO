import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "../components/Navbar";
import { apiUrl, authHeaders, getUser } from "../api/http";
import { getMyAppointments } from "../api/appointments";
import { getConversations } from "../api/messaging";
import { getDoctorLinkRequests, getMyCaregivers, getMyDoctors } from "../api/links";
import { getNextMedicationDose, isActiveMedication, formatDoseTime } from "../utils/medicationSchedule";
import { formatListOutput, getPatientClinicalNotes, getPatientTreatmentPlans } from "../utils/doctorPatientRecords";

function SummaryTile({ label, value, hint, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-3xl border border-slate-200 bg-white p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-sky-200 hover:bg-sky-50/40"
    >
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-2 text-3xl font-black text-slate-900">{value}</p>
      <p className="mt-2 text-sm text-slate-600">{hint}</p>
    </button>
  );
}

function StatPill({ label, value, tone = "sky" }) {
  const tones = {
    sky: "bg-sky-100 text-sky-700",
    violet: "bg-violet-100 text-violet-700",
    emerald: "bg-emerald-100 text-emerald-700",
    amber: "bg-amber-100 text-amber-700",
  };
  return (
    <div className={`rounded-full px-3 py-1 text-xs font-semibold ${tones[tone] || tones.sky}`}>
      {label}: {value}
    </div>
  );
}

export default function HealthSummaryPatient() {
  const navigate = useNavigate();
  const user = getUser();
  const [appointments, setAppointments] = useState([]);
  const [medications, setMedications] = useState([]);
  const [symptoms, setSymptoms] = useState([]);
  const [doctorCount, setDoctorCount] = useState(0);
  const [caregiverCount, setCaregiverCount] = useState(0);
  const [pendingDoctorRequestCount, setPendingDoctorRequestCount] = useState(0);
  const [conversationCount, setConversationCount] = useState(0);
  const [doctorClinicalNotes, setDoctorClinicalNotes] = useState([]);
  const [doctorTreatmentPlans, setDoctorTreatmentPlans] = useState([]);

  useEffect(() => {
    let cancelled = false;

    async function loadSummary() {
      const results = await Promise.allSettled([
        getMyAppointments(),
        getConversations(),
        getMyDoctors(),
        getMyCaregivers(),
        getDoctorLinkRequests(),
        fetch(`${apiUrl}/api/medications`, {
          headers: { "Content-Type": "application/json", ...authHeaders() },
        }).then((res) => (res.ok ? res.json() : [])),
        fetch(`${apiUrl}/api/symptoms`, {
          headers: { "Content-Type": "application/json", ...authHeaders() },
        }).then((res) => (res.ok ? res.json() : [])),
      ]);

      if (cancelled) return;

      const [appointmentsResult, conversationsResult, doctorsResult, caregiversResult, doctorRequestsResult, medicationsResult, symptomsResult] = results;

      setAppointments(appointmentsResult.status === "fulfilled" ? appointmentsResult.value.appointments || [] : []);
      setConversationCount(
        conversationsResult.status === "fulfilled" ? (conversationsResult.value.conversations || []).length : 0
      );
      setDoctorCount(doctorsResult.status === "fulfilled" ? (doctorsResult.value.doctors || []).length : 0);
      setCaregiverCount(caregiversResult.status === "fulfilled" ? (caregiversResult.value.caregivers || []).length : 0);
      setPendingDoctorRequestCount(
        doctorRequestsResult.status === "fulfilled" ? (doctorRequestsResult.value.requests || []).length : 0
      );
      setMedications(
        medicationsResult.status === "fulfilled" && Array.isArray(medicationsResult.value)
          ? medicationsResult.value
          : []
      );
      setSymptoms(
        symptomsResult.status === "fulfilled" && Array.isArray(symptomsResult.value)
          ? symptomsResult.value
          : []
      );
    }

    loadSummary();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const patientId = user?.id || "";
    setDoctorClinicalNotes(getPatientClinicalNotes(patientId));
    setDoctorTreatmentPlans(getPatientTreatmentPlans(patientId));
  }, [user?.id]);

  const scheduledAppointments = useMemo(
    () => appointments.filter((item) => item.status === "scheduled" || item.status === "requested"),
    [appointments]
  );
  const activeMedications = useMemo(() => medications.filter((item) => isActiveMedication(item)), [medications]);
  const nextDose = useMemo(() => getNextMedicationDose(activeMedications), [activeMedications]);
  const recentSymptoms = useMemo(() => symptoms.slice(0, 5), [symptoms]);
  const symptomSeverityAverage = useMemo(() => {
    const numeric = recentSymptoms.map((item) => Number(item.severity)).filter((value) => Number.isFinite(value));
    if (!numeric.length) return null;
    return (numeric.reduce((sum, value) => sum + value, 0) / numeric.length).toFixed(1);
  }, [recentSymptoms]);

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />

      <main className="mx-auto max-w-6xl px-6 pb-10 pt-28">
        <section className="rounded-[2rem] bg-gradient-to-r from-cyan-900 via-sky-800 to-blue-700 p-8 text-white shadow-xl">
          <p className="text-sm font-semibold uppercase tracking-[0.25em] text-white/75">Patient Insights</p>
          <h1 className="mt-3 text-4xl font-black">Dedicated Health Summary</h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-white/85">
            Review your care activity at a glance, including medications, appointments, symptom tracking, and care team communication.
          </p>
        </section>

        <section className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <SummaryTile
            label="Care Team"
            value={`${doctorCount + caregiverCount}`}
            hint={`${doctorCount} doctor${doctorCount === 1 ? "" : "s"}, ${caregiverCount} caregiver${caregiverCount === 1 ? "" : "s"}${pendingDoctorRequestCount > 0 ? `, ${pendingDoctorRequestCount} doctor request${pendingDoctorRequestCount === 1 ? "" : "s"} pending` : ""}`}
            onClick={() => navigate("/care-team")}
          />
          <SummaryTile
            label="Appointments"
            value={`${scheduledAppointments.length}`}
            hint="Scheduled and pending requests"
            onClick={() => navigate("/patientAppointments")}
          />
          <SummaryTile
            label="Active Medications"
            value={`${activeMedications.length}`}
            hint={nextDose ? `Next dose at ${formatDoseTime(nextDose.at)}` : "No next dose scheduled"}
            onClick={() => navigate("/medication")}
          />
          <SummaryTile
            label="Updates & Communication"
            value={`${conversationCount}`}
            hint="Secure conversations with caregivers"
            onClick={() => navigate("/patientMessages")}
          />
        </section>

        {pendingDoctorRequestCount > 0 ? (
          <section className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4">
            <p className="text-sm font-semibold text-amber-800">Doctor-link request status</p>
            <p className="mt-1 text-sm text-amber-700">
              {pendingDoctorRequestCount} request{pendingDoctorRequestCount === 1 ? "" : "s"} pending doctor approval.
            </p>
          </section>
        ) : null}

        <section className="mt-6">
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold text-slate-900">Recent symptom log snapshot</h2>
                <p className="mt-1 text-sm text-slate-500">Your latest entries are laid out as a readable timeline.</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <StatPill label="Recent logs" value={recentSymptoms.length} tone="amber" />
                <StatPill label="Avg severity" value={symptomSeverityAverage || "n/a"} tone="violet" />
              </div>
            </div>

            <div className="mt-4 space-y-3">
              {recentSymptoms.length > 0 ? (
                recentSymptoms.map((item, index) => {
                  const severity = Number(item.severity) || 0;
                  return (
                    <div key={item.id} className="relative overflow-hidden rounded-2xl border border-slate-200 p-4">
                      <div className="absolute left-5 top-0 h-full w-px bg-slate-200" />
                      <div className="relative flex gap-4">
                        <div className={`mt-1 h-3 w-3 rounded-full ${severity >= 7 ? "bg-rose-500" : severity >= 4 ? "bg-amber-500" : "bg-emerald-500"}`} />
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <p className="font-semibold text-slate-900">{item.symptom || "Symptom entry"}</p>
                            <p className="text-xs text-slate-400">{new Date(item.createdAt).toLocaleString()}</p>
                          </div>
                          <div className="mt-2 flex flex-wrap gap-2">
                            <StatPill label="Severity" value={item.severity || "Not set"} tone={severity >= 7 ? "amber" : severity >= 4 ? "violet" : "emerald"} />
                            <StatPill label="Entry" value={`#${index + 1}`} tone="sky" />
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="rounded-2xl border border-dashed border-slate-200 p-6 text-sm text-slate-500">
                  No symptoms logged yet.
                </div>
              )}
            </div>
          </div>
        </section>

        <section className="mt-6 grid gap-6 lg:grid-cols-2">
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold text-slate-900">Doctor updates you can review</h2>
                <p className="mt-1 text-sm text-slate-500">Only patient-safe summaries and next-step instructions appear here.</p>
              </div>
              <StatPill label="Updates" value={doctorClinicalNotes.length} tone="sky" />
            </div>
            <div className="mt-4 space-y-3">
              {doctorClinicalNotes.length ? doctorClinicalNotes.slice(0, 4).map((note) => (
                <div key={note.id} className="rounded-3xl border border-slate-200 bg-gradient-to-br from-white to-sky-50 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <p className="font-semibold text-slate-900">{note.noteTitle || "Clinical note"}</p>
                    <StatPill label="Follow-up" value={note.followUpPlan ? "Set" : "None"} tone="sky" />
                  </div>
                  <p className="mt-3 text-sm leading-6 text-slate-700">{note.patientSafeSummary || "No patient-safe summary provided."}</p>
                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    <div className="rounded-2xl bg-white/80 p-3">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">Instructions</p>
                      <p className="mt-2 text-sm text-slate-700">{formatListOutput(note.patientInstructions) || "No instructions."}</p>
                    </div>
                    <div className="rounded-2xl bg-white/80 p-3">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">Follow-up</p>
                      <p className="mt-2 text-sm text-slate-700">{note.followUpPlan || "No follow-up recorded."}</p>
                    </div>
                  </div>
                </div>
              )) : (
                <div className="rounded-2xl border border-dashed border-slate-200 p-6 text-sm text-slate-500">
                  No doctor note summaries available yet.
                </div>
              )}
            </div>
          </div>
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold text-slate-900">Treatment plans explained simply</h2>
                <p className="mt-1 text-sm text-slate-500">Readable plan summaries with goals and instructions only.</p>
              </div>
              <StatPill label="Plans" value={doctorTreatmentPlans.length} tone="violet" />
            </div>
            <div className="mt-4 space-y-3">
              {doctorTreatmentPlans.length ? doctorTreatmentPlans.slice(0, 4).map((plan) => (
                <div key={plan.id} className="rounded-3xl border border-slate-200 bg-gradient-to-br from-white to-violet-50 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-semibold text-slate-900">{plan.title}</p>
                    <span className="rounded-full bg-violet-100 px-3 py-1 text-xs font-semibold text-violet-700">{plan.status}</span>
                  </div>
                  <p className="mt-3 text-sm leading-6 text-slate-700">{plan.patientSafeSummary || "No patient-safe summary provided."}</p>
                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    <div className="rounded-2xl bg-white/80 p-3">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">Goals</p>
                      <p className="mt-2 text-sm text-slate-700">{formatListOutput(plan.treatmentGoals) || "Not recorded"}</p>
                    </div>
                    <div className="rounded-2xl bg-white/80 p-3">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">Instructions</p>
                      <p className="mt-2 text-sm text-slate-700">{formatListOutput(plan.patientInstructions) || "Not recorded"}</p>
                    </div>
                  </div>
                </div>
              )) : (
                <div className="rounded-2xl border border-dashed border-slate-200 p-6 text-sm text-slate-500">
                  No treatment plan summaries available yet.
                </div>
              )}
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
