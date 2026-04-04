import { useEffect, useMemo, useState } from "react";
import { getDoctorPatientWorkspace } from "../../api/doctorWorkspace";

function formatDate(value) {
  if (!value) return "Not recorded";
  return new Date(value).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatDateTime(value) {
  if (!value) return "Not recorded";
  return new Date(value).toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatList(value) {
  if (!value) return "Not recorded";
  if (Array.isArray(value)) return value.filter(Boolean).join(", ") || "Not recorded";
  return String(value).trim() || "Not recorded";
}

function formatEmergencyContact(value) {
  if (!value) return "Not recorded";
  if (typeof value === "string") return value.trim() || "Not recorded";
  const parts = [value.name, value.relationship, value.phoneNumber].filter(Boolean);
  return parts.join(" • ") || "Not recorded";
}

function severityTone(value) {
  if (value >= 8) return "bg-rose-100 text-rose-700";
  if (value >= 5) return "bg-amber-100 text-amber-700";
  return "bg-emerald-100 text-emerald-700";
}

function patientDisplayName(patient) {
  return patient?.profile?.displayName || patient?.displayName || patient?.email || "Patient";
}

function matchesFilter(patient, filter) {
  const snapshot = patient?.snapshot || {};
  if (filter === "urgent") return Boolean(patient?.emergencyStatus || snapshot.latestSymptom?.severity >= 8);
  if (filter === "emergency") return Boolean(patient?.emergencyStatus);
  if (filter === "symptoms") return Boolean(snapshot.latestSymptom);
  if (filter === "upcoming") return Boolean(snapshot.nextAppointmentAt);
  if (filter === "medications") return Number(snapshot.activeMedicationCount || 0) > 0;
  return true;
}

export default function DoctorPatientWorkspaceSection({ assignedPatients, onSchedulePatient }) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [selectedPatientId, setSelectedPatientId] = useState("");
  const [workspaceLoading, setWorkspaceLoading] = useState(false);
  const [workspaceError, setWorkspaceError] = useState("");
  const [workspace, setWorkspace] = useState(null);

  const filteredPatients = useMemo(() => {
    const query = search.trim().toLowerCase();
    return assignedPatients.filter((patient) => {
      const name = patientDisplayName(patient).toLowerCase();
      const email = String(patient?.email || "").toLowerCase();
      const matchesQuery = !query || name.includes(query) || email.includes(query);
      return matchesQuery && matchesFilter(patient, filter);
    });
  }, [assignedPatients, filter, search]);

  useEffect(() => {
    if (!filteredPatients.length) {
      setSelectedPatientId("");
      setWorkspace(null);
      setWorkspaceError("");
      return;
    }

    const exists = filteredPatients.some((patient) => patient.id === selectedPatientId);
    if (!exists) {
      setSelectedPatientId(filteredPatients[0].id);
    }
  }, [filteredPatients, selectedPatientId]);

  useEffect(() => {
    let cancelled = false;

    async function loadWorkspace() {
      if (!selectedPatientId) return;
      try {
        setWorkspaceLoading(true);
        setWorkspaceError("");
        const data = await getDoctorPatientWorkspace(selectedPatientId);
        if (!cancelled) {
          setWorkspace(data);
        }
      } catch (error) {
        if (!cancelled) {
          setWorkspace(null);
          setWorkspaceError(error.message || "Failed to load patient workspace.");
        }
      } finally {
        if (!cancelled) setWorkspaceLoading(false);
      }
    }

    loadWorkspace();
    return () => {
      cancelled = true;
    };
  }, [selectedPatientId]);

  return (
    <section className="mt-6 rounded-3xl bg-white p-6 shadow-sm">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-600">Doctor patient workspace</p>
          <h2 className="mt-2 text-2xl font-bold text-slate-900">Review assigned patients without leaving the dashboard</h2>
          <p className="mt-2 max-w-3xl text-sm text-slate-500">
            Search your assigned patients, review the latest clinical context, and take next-step actions from one embedded workspace.
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_200px] lg:w-[30rem]">
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search patient by name or email"
            className="rounded-2xl border border-slate-300 px-4 py-3 text-sm"
          />
          <select
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
            className="rounded-2xl border border-slate-300 px-4 py-3 text-sm"
          >
            <option value="all">All patients</option>
            <option value="urgent">Urgent signals</option>
            <option value="emergency">Emergency active</option>
            <option value="symptoms">Recent symptoms</option>
            <option value="upcoming">Upcoming appointment</option>
            <option value="medications">Active medications</option>
          </select>
        </div>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[0.95fr_1.35fr]">
        <div className="space-y-3">
          {filteredPatients.length > 0 ? filteredPatients.map((patient) => {
            const snapshot = patient.snapshot || {};
            const selected = patient.id === selectedPatientId;
            return (
              <button
                key={patient.id}
                type="button"
                onClick={() => setSelectedPatientId(patient.id)}
                className={`w-full rounded-3xl border p-4 text-left transition ${selected ? "border-sky-300 bg-sky-50 shadow-sm" : "border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm"}`}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-lg font-semibold text-slate-900">{patientDisplayName(patient)}</p>
                    <p className="mt-1 text-sm text-slate-500">{patient.email}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {patient.emergencyStatus ? <span className="rounded-full bg-rose-100 px-3 py-1 text-xs font-semibold text-rose-700">Emergency</span> : null}
                    {snapshot.nextAppointmentAt ? <span className="rounded-full bg-sky-100 px-3 py-1 text-xs font-semibold text-sky-700">Next visit set</span> : null}
                  </div>
                </div>

                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-2xl bg-slate-50 p-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Latest symptom</p>
                    <p className="mt-2 text-sm font-semibold text-slate-900">{snapshot.latestSymptom?.name || "No recent symptom"}</p>
                    <p className="mt-1 text-xs text-slate-500">
                      {snapshot.latestSymptom ? `Severity ${snapshot.latestSymptom.severity} • ${formatDateTime(snapshot.latestSymptom.loggedAt)}` : "No symptom logs yet"}
                    </p>
                  </div>
                  <div className="rounded-2xl bg-slate-50 p-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Next appointment</p>
                    <p className="mt-2 text-sm font-semibold text-slate-900">{snapshot.nextAppointmentAt ? formatDateTime(snapshot.nextAppointmentAt) : "No future appointment"}</p>
                    <p className="mt-1 text-xs text-slate-500">{snapshot.nextAppointmentStatus || ""}</p>
                  </div>
                  <div className="rounded-2xl bg-slate-50 p-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Medications</p>
                    <p className="mt-2 text-sm font-semibold text-slate-900">{snapshot.activeMedicationCount || 0} active</p>
                  </div>
                  <div className="rounded-2xl bg-slate-50 p-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Emergency status</p>
                    <p className="mt-2 text-sm font-semibold text-slate-900">{patient.emergencyStatus ? "Active" : "Normal"}</p>
                    <p className="mt-1 text-xs text-slate-500">{patient.emergencyStatusUpdatedAt ? formatDateTime(patient.emergencyStatusUpdatedAt) : "No active alert"}</p>
                  </div>
                </div>
              </button>
            );
          }) : (
            <div className="rounded-3xl border border-dashed border-slate-200 p-6 text-sm text-slate-500">
              No assigned patients match the current search and filter.
            </div>
          )}
        </div>

        <div className="rounded-3xl border border-slate-200 bg-slate-50/80 p-5">
          {!selectedPatientId ? (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-6 text-sm text-slate-500">
              Select a patient to open the detailed workspace.
            </div>
          ) : workspaceLoading ? (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-6 text-sm text-slate-500">
              Loading patient workspace...
            </div>
          ) : workspaceError ? (
            <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {workspaceError}
            </div>
          ) : workspace ? (
            <div className="space-y-5">
              <div className="rounded-3xl bg-white p-5 shadow-sm">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-600">Patient detail</p>
                    <h3 className="mt-2 text-2xl font-bold text-slate-900">{workspace.patient.displayName}</h3>
                    <p className="mt-1 text-sm text-slate-500">{workspace.patient.email}</p>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <span className={`rounded-full px-3 py-1 text-xs font-semibold ${workspace.summary.emergencyStatus ? "bg-rose-100 text-rose-700" : "bg-emerald-100 text-emerald-700"}`}>
                      {workspace.summary.emergencyStatus ? "Emergency active" : "No emergency alert"}
                    </span>
                    {workspace.summary.latestSymptom ? (
                      <span className={`rounded-full px-3 py-1 text-xs font-semibold ${severityTone(workspace.summary.latestSymptom.severity)}`}>
                        Latest symptom severity {workspace.summary.latestSymptom.severity}
                      </span>
                    ) : null}
                  </div>
                </div>

                <div className="mt-4 grid gap-3 md:grid-cols-4">
                  <div className="rounded-2xl bg-slate-50 p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Medications</p>
                    <p className="mt-2 text-2xl font-bold text-slate-900">{workspace.summary.activeMedicationCount}</p>
                  </div>
                  <div className="rounded-2xl bg-slate-50 p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Diagnoses</p>
                    <p className="mt-2 text-2xl font-bold text-slate-900">{workspace.summary.activeDiagnosisCount}</p>
                  </div>
                  <div className="rounded-2xl bg-slate-50 p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Next appointment</p>
                    <p className="mt-2 text-sm font-semibold text-slate-900">{workspace.summary.nextAppointmentAt ? formatDateTime(workspace.summary.nextAppointmentAt) : "No future visit"}</p>
                  </div>
                  <div className="rounded-2xl bg-slate-50 p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Latest symptom</p>
                    <p className="mt-2 text-sm font-semibold text-slate-900">{workspace.summary.latestSymptom?.name || "No symptom log"}</p>
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={() => onSchedulePatient?.(workspace.patient.id)}
                    className="rounded-2xl bg-sky-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-sky-700"
                  >
                    Schedule follow-up
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedPatientId(workspace.patient.id)}
                    className="rounded-2xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
                  >
                    Refresh detail
                  </button>
                </div>
              </div>

              <div className="grid gap-5 xl:grid-cols-2">
                <div className="rounded-3xl bg-white p-5 shadow-sm">
                  <h4 className="text-lg font-semibold text-slate-900">Profile and emergency</h4>
                  <div className="mt-4 space-y-3 text-sm text-slate-600">
                    <p><span className="font-semibold text-slate-900">Date of birth:</span> {workspace.profile?.dateOfBirth || "Not recorded"}</p>
                    <p><span className="font-semibold text-slate-900">Sex:</span> {workspace.profile?.sex || "Not recorded"}</p>
                    <p><span className="font-semibold text-slate-900">Blood type:</span> {workspace.profile?.bloodType || "Not recorded"}</p>
                    <p><span className="font-semibold text-slate-900">Allergies:</span> {formatList(workspace.profile?.allergies)}</p>
                    <p><span className="font-semibold text-slate-900">Medical conditions:</span> {formatList(workspace.profile?.medicalConditions)}</p>
                    <p><span className="font-semibold text-slate-900">Emergency contact:</span> {formatEmergencyContact(workspace.profile?.emergencyContact)}</p>
                    <p><span className="font-semibold text-slate-900">Emergency updated:</span> {workspace.summary.emergencyStatusUpdatedAt ? formatDateTime(workspace.summary.emergencyStatusUpdatedAt) : "Not active"}</p>
                  </div>
                </div>

                <div className="rounded-3xl bg-white p-5 shadow-sm">
                  <h4 className="text-lg font-semibold text-slate-900">Recent symptoms</h4>
                  <div className="mt-4 space-y-3">
                    {workspace.symptoms.length ? workspace.symptoms.slice(0, 5).map((item) => (
                      <div key={item.id} className="rounded-2xl border border-slate-200 p-3">
                        <div className="flex items-center justify-between gap-3">
                          <p className="font-semibold text-slate-900">{item.name}</p>
                          <span className={`rounded-full px-3 py-1 text-xs font-semibold ${severityTone(item.severity)}`}>Severity {item.severity}</span>
                        </div>
                        <p className="mt-2 text-sm text-slate-500">{item.notes || "No symptom notes."}</p>
                        <p className="mt-2 text-xs text-slate-400">{formatDateTime(item.loggedAt)} • Logged by {item.loggedBy}</p>
                      </div>
                    )) : <p className="text-sm text-slate-500">No symptom activity recorded.</p>}
                  </div>
                </div>

                <div className="rounded-3xl bg-white p-5 shadow-sm">
                  <h4 className="text-lg font-semibold text-slate-900">Appointments</h4>
                  <div className="mt-4 space-y-3">
                    {workspace.appointments.length ? workspace.appointments.slice(0, 6).map((item) => (
                      <div key={item.id} className="rounded-2xl border border-slate-200 p-3">
                        <div className="flex items-center justify-between gap-3">
                          <p className="font-semibold text-slate-900">{formatDateTime(item.startsAt)}</p>
                          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">{item.status}</span>
                        </div>
                        <p className="mt-2 text-sm text-slate-500">{item.location || "Location pending"}</p>
                        <p className="mt-1 text-sm text-slate-500">{item.notes || "No appointment notes."}</p>
                      </div>
                    )) : <p className="text-sm text-slate-500">No appointment history with this patient yet.</p>}
                  </div>
                </div>

                <div className="rounded-3xl bg-white p-5 shadow-sm">
                  <h4 className="text-lg font-semibold text-slate-900">Medications and diagnoses</h4>
                  <div className="mt-4 space-y-4">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Medications</p>
                      <div className="mt-2 space-y-2">
                        {workspace.medications.length ? workspace.medications.slice(0, 5).map((item) => (
                          <div key={item.id} className="rounded-2xl border border-slate-200 p-3">
                            <p className="font-semibold text-slate-900">{item.name}</p>
                            <p className="mt-1 text-sm text-slate-500">{item.dosage || "Dosage not recorded"} • {item.frequency || "Frequency not recorded"}</p>
                          </div>
                        )) : <p className="text-sm text-slate-500">No active medications recorded.</p>}
                      </div>
                    </div>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Diagnoses and treatment summary</p>
                      <div className="mt-2 space-y-2">
                        {workspace.diagnoses.length ? workspace.diagnoses.slice(0, 5).map((item) => (
                          <div key={item.id} className="rounded-2xl border border-slate-200 p-3">
                            <div className="flex items-center justify-between gap-3">
                              <p className="font-semibold text-slate-900">{item.diagnosisText}</p>
                              <span className={`rounded-full px-3 py-1 text-xs font-semibold ${item.status === "active" ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-700"}`}>{item.status}</span>
                            </div>
                            <p className="mt-1 text-xs text-slate-400">{formatDate(item.diagnosedAt)}</p>
                          </div>
                        )) : <p className="text-sm text-slate-500">No diagnoses recorded.</p>}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="rounded-3xl bg-white p-5 shadow-sm">
                  <h4 className="text-lg font-semibold text-slate-900">Caregiver notes</h4>
                  <div className="mt-4 space-y-3">
                    {workspace.caregiverNotes.length ? workspace.caregiverNotes.slice(0, 5).map((item) => (
                      <div key={item.id} className="rounded-2xl border border-slate-200 p-3">
                        <p className="text-sm text-slate-600">{item.note}</p>
                        <p className="mt-2 text-xs text-slate-400">{formatDateTime(item.createdAt)}</p>
                      </div>
                    )) : <p className="text-sm text-slate-500">No caregiver notes are available for this patient yet.</p>}
                  </div>
                </div>

                <div className="rounded-3xl bg-white p-5 shadow-sm">
                  <h4 className="text-lg font-semibold text-slate-900">Doctor notes and recent activity</h4>
                  <div className="mt-4 space-y-4">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Recent doctor notes</p>
                      <div className="mt-2 space-y-2">
                        {workspace.doctorNotes.length ? workspace.doctorNotes.slice(0, 4).map((item) => (
                          <div key={item.id} className="rounded-2xl border border-slate-200 p-3">
                            <p className="text-sm text-slate-600">{item.note}</p>
                            <p className="mt-2 text-xs text-slate-400">{formatDateTime(item.createdAt)}</p>
                          </div>
                        )) : <p className="text-sm text-slate-500">No doctor notes created yet for this patient.</p>}
                      </div>
                    </div>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Activity timeline</p>
                      <div className="mt-2 space-y-2">
                        {workspace.timeline.length ? workspace.timeline.slice(0, 6).map((item) => (
                          <div key={`${item.type}-${item.id}`} className="rounded-2xl border border-slate-200 p-3">
                            <div className="flex items-center justify-between gap-3">
                              <p className="font-semibold text-slate-900">{item.title}</p>
                              <span className="text-xs text-slate-400">{formatDateTime(item.timestamp)}</span>
                            </div>
                            <p className="mt-1 text-sm text-slate-500">{item.detail}</p>
                          </div>
                        )) : <p className="text-sm text-slate-500">No timeline events yet.</p>}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}
