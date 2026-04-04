import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import Navbar from "../components/Navbar";
import { apiUrl, authHeaders } from "../api/http";
import { rememberDoctorPatientTab } from "../utils/doctorPatientTabs";

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

  useEffect(() => {
    let cancelled = false;
    async function loadWorkspace() {
      try {
        setLoading(true);
        setError("");
        const [overview, timeline, notes] = await Promise.all([
          fetchPatientOverview(patientId),
          fetchPatientTimeline(patientId),
          fetchPatientNotes(patientId),
        ]);
        if (!cancelled) {
          setWorkspace({ overview, timeline: timeline.events || [], notes: notes.notes || [] });
          rememberDoctorPatientTab({ id: patientId, name: patientDisplayName(overview) });
        }
      } catch (err) {
        if (!cancelled) {
          setWorkspace(null);
          setError(err.message || "Failed to load patient detail.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    loadWorkspace();
    return () => { cancelled = true; };
  }, [patientId]);

  const overview = workspace?.overview;
  const profile = overview?.patientProfile || null;
  const medications = overview?.medications || [];
  const diagnoses = overview?.diagnoses || [];
  const appointments = overview?.appointmentsAsPatient || [];

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
              <h3 className="text-lg font-semibold text-slate-900">Clinical notes</h3>
              <div className="mt-4 space-y-3">
                {workspace.notes.length ? workspace.notes.slice(0,6).map((note) => (
                  <div key={note.id} className="rounded-2xl border border-slate-200 p-3">
                    <p className="text-sm text-slate-700">{note.content}</p>
                    <p className="mt-2 text-xs text-slate-400">{formatDateTime(note.date)}</p>
                  </div>
                )) : <p className="text-sm text-slate-500">No clinical notes recorded yet.</p>}
              </div>
            </div>
            <div className="rounded-3xl bg-white p-5 shadow-sm">
              <h3 className="text-lg font-semibold text-slate-900">Treatment summary</h3>
              <div className="mt-4 space-y-3">
                {diagnoses.length ? diagnoses.slice(0,6).map((diagnosis) => (
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
