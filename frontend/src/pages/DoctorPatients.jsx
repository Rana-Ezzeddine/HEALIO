import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import Navbar from "../components/Navbar";
import { apiUrl, authHeaders } from "../api/http";
import { getDoctorLinkRequests, reviewDoctorLinkRequest } from "../api/links";

function statusBadge(status) {
  if (status === "active") return "bg-emerald-100 text-emerald-700";
  if (status === "pending") return "bg-amber-100 text-amber-700";
  return "bg-slate-100 text-slate-600";
}

function patientInitials(record) {
  const p = record?.patient || record;
  const email = p?.email || "";
  const display = patientDisplayName(record);
  const pieces = display.split(" ").filter(Boolean);
  if (pieces.length >= 2) return `${pieces[0][0]}${pieces[1][0]}`.toUpperCase();
  return email ? email[0].toUpperCase() : "?";
}

function patientDisplayName(record) {
  const p = record?.patient || record;
  return [p?.firstName, p?.lastName].filter(Boolean).join(" ").trim() || p?.displayName || p?.email || "Patient";
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
  if (typeof value === "object") {
    return [value.name, value.relationship, value.phoneNumber].filter(Boolean).join(" • ") || "Not recorded";
  }
  return String(value).trim() || "Not recorded";
}

function severityTone(value) {
  if (value >= 8) return "bg-rose-100 text-rose-700";
  if (value >= 5) return "bg-amber-100 text-amber-700";
  return "bg-emerald-100 text-emerald-700";
}

async function fetchAssignedPatients() {
  const response = await fetch(`${apiUrl}/api/doctors/assigned-patients`, {
    headers: { "Content-Type": "application/json", ...authHeaders() },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || "Failed to load assigned patients.");
  return data;
}

async function fetchPatientOverview(patientId) {
  const response = await fetch(`${apiUrl}/api/doctors/patients/${patientId}/overview`, {
    headers: { ...authHeaders() },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || "Failed to load patient details.");
  return data;
}

async function fetchPatientTimeline(patientId) {
  const response = await fetch(`${apiUrl}/api/doctors/patients/${patientId}/timeline`, {
    headers: { ...authHeaders() },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || "Failed to load patient timeline.");
  return data;
}

async function fetchPatientNotes(patientId) {
  const response = await fetch(`${apiUrl}/api/doctor-notes/patient/${patientId}/notes`, {
    headers: { ...authHeaders() },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || "Failed to load doctor notes.");
  return data;
}

export default function DoctorPatients() {
  const navigate = useNavigate();
  const { patientId: routePatientId } = useParams();
  const [pendingRequests, setPendingRequests] = useState([]);
  const [assignedPatients, setAssignedPatients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reviewStatus, setReviewStatus] = useState({ error: "", success: "" });
  const [workspaceLoading, setWorkspaceLoading] = useState(false);
  const [workspaceError, setWorkspaceError] = useState("");
  const [workspace, setWorkspace] = useState(null);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const [requestsRes, patientsRes] = await Promise.all([
        getDoctorLinkRequests(),
        fetchAssignedPatients(),
      ]);
      setPendingRequests(requestsRes.requests || []);
      setAssignedPatients((patientsRes.patients || []).filter((record) => record.status === "active"));
    } catch (err) {
      setError(err.message || "Failed to load patient data.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);


  useEffect(() => {
    let cancelled = false;
    async function loadWorkspace() {
      if (!routePatientId) {
        setWorkspace(null);
        setWorkspaceError("");
        return;
      }
      try {
        setWorkspaceLoading(true);
        setWorkspaceError("");
        const [overview, timeline, notes] = await Promise.all([
          fetchPatientOverview(routePatientId),
          fetchPatientTimeline(routePatientId),
          fetchPatientNotes(routePatientId),
        ]);
        if (!cancelled) {
          setWorkspace({ overview, timeline: timeline.events || [], notes: notes.notes || [] });
        }
      } catch (err) {
        if (!cancelled) {
          setWorkspace(null);
          setWorkspaceError(err.message || "Failed to load patient workspace.");
        }
      } finally {
        if (!cancelled) setWorkspaceLoading(false);
      }
    }
    loadWorkspace();
    return () => { cancelled = true; };
  }, [routePatientId]);

  async function handleReview(patientId, decision) {
    setReviewStatus({ error: "", success: "" });
    try {
      await reviewDoctorLinkRequest(patientId, decision);
      setReviewStatus({ error: "", success: decision === "active" ? "Request approved." : "Request rejected." });
      await load();
    } catch (err) {
      setReviewStatus({ error: err.message || "Failed to review request.", success: "" });
    }
  }

  const selectedPatientRecord = useMemo(() => {
    if (!routePatientId) return null;
    return assignedPatients.find((record) => (record.patient?.id || record.id) === routePatientId) || null;
  }, [assignedPatients, routePatientId]);

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
          <div className="grid gap-6 xl:grid-cols-[1.25fr_0.75fr] xl:items-start">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.25em] text-white/75">Doctor Workspace</p>
              <h1 className="mt-3 text-4xl font-black">Patients</h1>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-white/85">
                Review incoming link requests, manage your active roster, and open each patient’s clinical context, notes, and treatment summary from one patients page.
              </p>
              <div className="mt-5 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => navigate("/doctorAppointments")}
                  className="rounded-xl bg-white/15 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/25"
                >
                  Open appointments
                </button>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-1">
              <div className="rounded-3xl border border-white/15 bg-white/10 p-5 shadow-sm backdrop-blur-sm">
                <p className="text-xs font-semibold uppercase tracking-wide text-white/70">Pending requests</p>
                <p className="mt-2 text-3xl font-black text-white">{pendingRequests.length}</p>
                <p className="mt-1 text-sm text-white/75">Awaiting your decision</p>
              </div>
              <div className="rounded-3xl border border-white/15 bg-white/10 p-5 shadow-sm backdrop-blur-sm">
                <p className="text-xs font-semibold uppercase tracking-wide text-white/70">Active patients</p>
                <p className="mt-2 text-3xl font-black text-white">{assignedPatients.length}</p>
                <p className="mt-1 text-sm text-white/75">Currently linked</p>
              </div>
            </div>
          </div>
        </section>

        {error ? <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}
        {reviewStatus.error ? <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{reviewStatus.error}</div> : null}
        {reviewStatus.success ? <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{reviewStatus.success}</div> : null}

        <div className="mt-6 grid gap-6 xl:grid-cols-[0.85fr_1.15fr]">
          <div className="space-y-6">
            <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-xl font-semibold text-slate-900">Link requests</h2>
                  <p className="mt-1 text-sm text-slate-500">Patients waiting for approval or rejection.</p>
                </div>
                {pendingRequests.length > 0 ? <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-700">{pendingRequests.length} pending</span> : null}
              </div>
              <div className="mt-5 space-y-4">
                {loading ? (
                  <p className="text-sm text-slate-500">Loading...</p>
                ) : pendingRequests.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-slate-200 px-6 py-8 text-center text-sm text-slate-500">No pending patient requests.</div>
                ) : (
                  pendingRequests.map((request) => {
                    const name = patientDisplayName(request);
                    const email = request.patient?.email || "";
                    const initials = patientInitials(request);
                    return (
                      <div key={request.patientId} className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
                        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                          <div className="flex items-start gap-4">
                            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-sky-100 text-sm font-bold text-sky-700">{initials}</div>
                            <div>
                              <p className="font-semibold text-slate-900">{name}</p>
                              {email && name !== email ? <p className="text-sm text-slate-500">{email}</p> : null}
                            </div>
                          </div>
                          <div className="flex shrink-0 gap-2">
                            <button type="button" onClick={() => handleReview(request.patientId, "active")} className="rounded-xl bg-emerald-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-600">Approve</button>
                            <button type="button" onClick={() => handleReview(request.patientId, "rejected")} className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2 text-sm font-semibold text-rose-600 transition hover:bg-rose-100">Reject</button>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </section>

            <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-xl font-semibold text-slate-900">Assigned patients</h2>
                  <p className="mt-1 text-sm text-slate-500">Open a patient to review notes, treatment, and recent clinical context.</p>
                </div>
                <button type="button" onClick={load} className="rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition">Refresh</button>
              </div>

              <div className="mt-5 space-y-3">
                {loading ? (
                  <p className="text-sm text-slate-500">Loading...</p>
                ) : assignedPatients.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-slate-200 px-6 py-8 text-center text-sm text-slate-500">No patients linked yet.</div>
                ) : (
                  assignedPatients.map((record) => {
                    const patientId = record.patient?.id || record.id;
                    const selected = patientId === routePatientId;
                    const snapshot = record.snapshot || {};
                    return (
                      <button key={patientId} type="button" onClick={() => navigate(`/doctor-patients/${patientId}`)} className={`flex w-full items-start gap-4 rounded-2xl border p-4 text-left transition ${selected ? "border-sky-300 bg-sky-50" : "border-slate-200 hover:border-slate-300 hover:bg-slate-50"}`}>
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-cyan-100 text-sm font-bold text-cyan-700">{patientInitials(record)}</div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="truncate font-semibold text-slate-900">{patientDisplayName(record)}</p>
                              {record.patient?.email && patientDisplayName(record) !== record.patient.email ? <p className="truncate text-sm text-slate-500">{record.patient.email}</p> : null}
                            </div>
                            <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold capitalize ${statusBadge(record.status)}`}>{record.status}</span>
                          </div>
                          <div className="mt-3 grid gap-2 sm:grid-cols-2">
                            <div className="rounded-xl bg-white px-3 py-2">
                              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Latest symptom</p>
                              <p className="mt-1 text-sm font-semibold text-slate-900">{snapshot.latestSymptom?.name || "No recent symptom"}</p>
                            </div>
                            <div className="rounded-xl bg-white px-3 py-2">
                              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Next appointment</p>
                              <p className="mt-1 text-sm font-semibold text-slate-900">{snapshot.nextAppointmentAt ? formatDateTime(snapshot.nextAppointmentAt) : "Not scheduled"}</p>
                            </div>
                            <div className="rounded-xl bg-white px-3 py-2">
                              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Meds count</p>
                              <p className="mt-1 text-sm font-semibold text-slate-900">{snapshot.activeMedicationCount || 0} active</p>
                            </div>
                            <div className="rounded-xl bg-white px-3 py-2">
                              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Emergency status</p>
                              <p className="mt-1 text-sm font-semibold text-slate-900">{record.patient?.emergencyStatus ? "Active" : "Normal"}</p>
                            </div>
                          </div>
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            </section>
          </div>

          <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            {!routePatientId ? (
              <div className="rounded-2xl border border-dashed border-slate-200 px-6 py-8 text-center text-sm text-slate-500">Select a patient from the roster to open their detail view. Clinical notes and treatment plans become available after you open a patient.</div>
            ) : workspaceLoading ? (
              <div className="rounded-2xl border border-dashed border-slate-200 px-6 py-8 text-center text-sm text-slate-500">Loading patient detail...</div>
            ) : workspaceError ? (
              <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{workspaceError}</div>
            ) : overview ? (
              <div className="space-y-6">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-600">Patient detail</p>
                    <h2 className="mt-2 text-2xl font-bold text-slate-900">{patientDisplayName(selectedPatientRecord || overview)}</h2>
                    <p className="mt-1 text-sm text-slate-500">{overview.email}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <span className={`rounded-full px-3 py-1 text-xs font-semibold ${profile?.emergencyStatus ? "bg-rose-100 text-rose-700" : "bg-emerald-100 text-emerald-700"}`}>{profile?.emergencyStatus ? "Emergency active" : "Normal status"}</span>
                    {appointments[0] ? <span className="rounded-full bg-sky-100 px-3 py-1 text-xs font-semibold text-sky-700">Next visit {formatDateTime(appointments[0].startsAt)}</span> : null}
                  </div>
                </div>

                <div className="flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={() => navigate(`/doctor-clinical-notes?patientId=${routePatientId}`)}
                    className="rounded-xl bg-indigo-100 px-4 py-2 text-sm font-semibold text-indigo-700 transition hover:bg-indigo-200"
                  >
                    Open clinical notes
                  </button>
                  <button
                    type="button"
                    onClick={() => navigate(`/doctor-treatment-plans?patientId=${routePatientId}`)}
                    className="rounded-xl bg-violet-100 px-4 py-2 text-sm font-semibold text-violet-700 transition hover:bg-violet-200"
                  >
                    Open treatment plans
                  </button>
                </div>

                <div className="grid gap-4 md:grid-cols-4">
                  <div className="rounded-2xl bg-slate-50 p-4"><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Medications</p><p className="mt-2 text-2xl font-black text-slate-900">{medications.length}</p></div>
                  <div className="rounded-2xl bg-slate-50 p-4"><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Diagnoses</p><p className="mt-2 text-2xl font-black text-slate-900">{diagnoses.length}</p></div>
                  <div className="rounded-2xl bg-slate-50 p-4"><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Doctor notes</p><p className="mt-2 text-2xl font-black text-slate-900">{workspace.notes.length}</p></div>
                  <div className="rounded-2xl bg-slate-50 p-4"><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Timeline events</p><p className="mt-2 text-2xl font-black text-slate-900">{workspace.timeline.length}</p></div>
                </div>

                <div className="grid gap-5 xl:grid-cols-2">
                  <div className="rounded-3xl bg-slate-50 p-5">
                    <h3 className="text-lg font-semibold text-slate-900">Profile and emergency</h3>
                    <div className="mt-4 space-y-2 text-sm text-slate-600">
                      <p><span className="font-semibold text-slate-900">Date of birth:</span> {formatField(profile?.dateOfBirth)}</p>
                      <p><span className="font-semibold text-slate-900">Sex:</span> {formatField(profile?.sex)}</p>
                      <p><span className="font-semibold text-slate-900">Blood type:</span> {formatField(profile?.bloodType)}</p>
                      <p><span className="font-semibold text-slate-900">Allergies:</span> {formatField(profile?.allergies)}</p>
                      <p><span className="font-semibold text-slate-900">Medical conditions:</span> {formatField(profile?.medicalConditions)}</p>
                      <p><span className="font-semibold text-slate-900">Emergency contact:</span> {formatField(profile?.emergencyContact)}</p>
                      <p><span className="font-semibold text-slate-900">Emergency updated:</span> {formatField(profile?.emergencyStatusUpdatedAt ? formatDateTime(profile.emergencyStatusUpdatedAt) : null)}</p>
                    </div>
                  </div>

                  <div className="rounded-3xl bg-slate-50 p-5">
                    <h3 className="text-lg font-semibold text-slate-900">Appointments</h3>
                    <div className="mt-4 space-y-3">
                      {appointments.length ? appointments.slice(0, 5).map((appointment) => (
                        <div key={appointment.id} className="rounded-2xl border border-slate-200 bg-white p-3">
                          <div className="flex items-center justify-between gap-3"><p className="font-semibold text-slate-900">{formatDateTime(appointment.startsAt)}</p><span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">{appointment.status}</span></div>
                          <p className="mt-1 text-sm text-slate-500">{appointment.location || "Location pending"}</p>
                          <p className="mt-1 text-sm text-slate-500">{appointment.notes || "No notes."}</p>
                        </div>
                      )) : <p className="text-sm text-slate-500">No appointment history with this patient yet.</p>}
                    </div>
                  </div>

                  <div className="rounded-3xl bg-slate-50 p-5">
                    <h3 className="text-lg font-semibold text-slate-900">Clinical notes</h3>
                    <p className="mt-1 text-sm text-slate-500">Doctor-facing note history stays inside the patient page.</p>
                    <div className="mt-4 space-y-3">
                      {workspace.notes.length ? workspace.notes.slice(0, 6).map((note) => (
                        <div key={note.id} className="rounded-2xl border border-slate-200 bg-white p-3">
                          <p className="text-sm text-slate-700">{note.content}</p>
                          <p className="mt-2 text-xs text-slate-400">{formatDateTime(note.date)}</p>
                        </div>
                      )) : <p className="text-sm text-slate-500">No clinical notes recorded yet.</p>}
                    </div>
                  </div>

                  <div className="rounded-3xl bg-slate-50 p-5">
                    <h3 className="text-lg font-semibold text-slate-900">Treatment summary</h3>
                    <p className="mt-1 text-sm text-slate-500">Diagnoses and active treatment context stay inside the patient page instead of a separate treatment-plans page.</p>
                    <div className="mt-4 space-y-3">
                      {diagnoses.length ? diagnoses.slice(0, 6).map((diagnosis) => (
                        <div key={diagnosis.id} className="rounded-2xl border border-slate-200 bg-white p-3">
                          <div className="flex items-center justify-between gap-3"><p className="font-semibold text-slate-900">{diagnosis.diagnosisText}</p><span className={`rounded-full px-3 py-1 text-xs font-semibold ${diagnosis.status === "active" ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-700"}`}>{diagnosis.status}</span></div>
                          <p className="mt-2 text-xs text-slate-400">Diagnosed {formatDate(diagnosis.diagnosedAt)}</p>
                        </div>
                      )) : <p className="text-sm text-slate-500">No diagnoses or treatment items recorded yet.</p>}
                    </div>
                  </div>

                  <div className="rounded-3xl bg-slate-50 p-5 xl:col-span-2">
                    <h3 className="text-lg font-semibold text-slate-900">Activity timeline</h3>
                    <div className="mt-4 space-y-3">
                      {workspace.timeline.length ? workspace.timeline.slice(0, 8).map((item) => (
                        <div key={`${item.type}-${item.id}`} className="rounded-2xl border border-slate-200 bg-white p-3">
                          <div className="flex items-center justify-between gap-3"><p className="font-semibold text-slate-900">{item.title}</p><span className="text-xs text-slate-400">{formatDateTime(item.timestamp)}</span></div>
                          <p className="mt-1 text-sm text-slate-500">{item.detail}</p>
                        </div>
                      )) : <p className="text-sm text-slate-500">No recent activity for this patient yet.</p>}
                    </div>
                  </div>
                </div>
              </div>
            ) : null}
          </section>
        </div>
      </main>
    </div>
  );
}
