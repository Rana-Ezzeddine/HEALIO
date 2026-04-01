import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "../components/Navbar";
import { apiUrl, authHeaders } from "../api/http";
import { getMyAppointments } from "../api/appointments";
import { getConversations } from "../api/messaging";
import { getMyCaregivers, getMyDoctors } from "../api/links";
import { getNextMedicationDose, isActiveMedication, formatDoseTime } from "../utils/medicationSchedule";

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

export default function HealthSummaryPatient() {
  const navigate = useNavigate();
  const [appointments, setAppointments] = useState([]);
  const [medications, setMedications] = useState([]);
  const [symptoms, setSymptoms] = useState([]);
  const [doctorCount, setDoctorCount] = useState(0);
  const [caregiverCount, setCaregiverCount] = useState(0);
  const [conversationCount, setConversationCount] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function loadSummary() {
      const results = await Promise.allSettled([
        getMyAppointments(),
        getConversations(),
        getMyDoctors(),
        getMyCaregivers(),
        fetch(`${apiUrl}/api/medications`, {
          headers: { "Content-Type": "application/json", ...authHeaders() },
        }).then((res) => (res.ok ? res.json() : [])),
        fetch(`${apiUrl}/api/symptoms`, {
          headers: { "Content-Type": "application/json", ...authHeaders() },
        }).then((res) => (res.ok ? res.json() : [])),
      ]);

      if (cancelled) return;

      const [appointmentsResult, conversationsResult, doctorsResult, caregiversResult, medicationsResult, symptomsResult] = results;

      setAppointments(appointmentsResult.status === "fulfilled" ? appointmentsResult.value.appointments || [] : []);
      setConversationCount(
        conversationsResult.status === "fulfilled" ? (conversationsResult.value.conversations || []).length : 0
      );
      setDoctorCount(doctorsResult.status === "fulfilled" ? (doctorsResult.value.doctors || []).length : 0);
      setCaregiverCount(caregiversResult.status === "fulfilled" ? (caregiversResult.value.caregivers || []).length : 0);
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

  const scheduledAppointments = useMemo(
    () => appointments.filter((item) => item.status === "scheduled" || item.status === "requested"),
    [appointments]
  );
  const activeMedications = useMemo(() => medications.filter((item) => isActiveMedication(item)), [medications]);
  const nextDose = useMemo(() => getNextMedicationDose(activeMedications), [activeMedications]);
  const recentSymptoms = useMemo(() => symptoms.slice(0, 5), [symptoms]);

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
            hint={`${doctorCount} doctor${doctorCount === 1 ? "" : "s"}, ${caregiverCount} caregiver${caregiverCount === 1 ? "" : "s"}`}
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

        <section className="mt-6 grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-xl font-semibold text-slate-900">Recent symptom log snapshot</h2>
            <p className="mt-1 text-sm text-slate-500">Your five latest symptom entries are listed below.</p>

            <div className="mt-4 space-y-3">
              {recentSymptoms.length > 0 ? (
                recentSymptoms.map((item) => (
                  <div key={item.id} className="rounded-2xl border border-slate-200 p-4">
                    <p className="font-semibold text-slate-900">{item.symptom || "Symptom entry"}</p>
                    <p className="mt-1 text-sm text-slate-600">Severity: {item.severity || "Not set"}</p>
                    <p className="mt-1 text-xs text-slate-500">{new Date(item.createdAt).toLocaleString()}</p>
                  </div>
                ))
              ) : (
                <div className="rounded-2xl border border-dashed border-slate-200 p-6 text-sm text-slate-500">
                  No symptoms logged yet.
                </div>
              )}
            </div>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-xl font-semibold text-slate-900">Quick navigation</h2>
            <p className="mt-1 text-sm text-slate-500">Jump to the care workflow you want to update.</p>

            <div className="mt-4 grid gap-3">
              {[
                { label: "Open appointments", href: "/patientAppointments", style: "bg-sky-100 text-sky-700" },
                { label: "Open medications", href: "/medication", style: "bg-cyan-100 text-cyan-700" },
                { label: "Open symptoms", href: "/symptoms", style: "bg-amber-100 text-amber-700" },
                { label: "Open care team", href: "/care-team", style: "bg-indigo-100 text-indigo-700" },
                { label: "Open updates & communication", href: "/patientMessages", style: "bg-emerald-100 text-emerald-700" },
              ].map((action) => (
                <button
                  key={action.label}
                  type="button"
                  onClick={() => navigate(action.href)}
                  className={`rounded-2xl px-4 py-3 text-left text-sm font-semibold transition hover:opacity-85 ${action.style}`}
                >
                  {action.label}
                </button>
              ))}
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
