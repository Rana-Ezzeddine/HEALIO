import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "../components/Navbar";
import { apiUrl, authHeaders } from "../api/http";
import { rememberDoctorPatientTab } from "../utils/doctorPatientTabs";

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

function formatDateTime(value) {
  if (!value) return "Not scheduled";
  return new Date(value).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

async function fetchAssignedPatients() {
  const response = await fetch(`${apiUrl}/api/doctors/assigned-patients`, {
    headers: { "Content-Type": "application/json", ...authHeaders() },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || "Failed to load assigned patients.");
  return data;
}

async function fetchLinkRequestsCount() {
  const response = await fetch(`${apiUrl}/api/doctors/assignments/requests`, {
    headers: { "Content-Type": "application/json", ...authHeaders() },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || "Failed to load link requests.");
  return (data.requests || []).length;
}

export default function DoctorPatients() {
  const navigate = useNavigate();
  const [assignedPatients, setAssignedPatients] = useState([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError("");
      try {
        const [patientsRes, requestsCount] = await Promise.all([
          fetchAssignedPatients(),
          fetchLinkRequestsCount(),
        ]);
        if (!cancelled) {
          setAssignedPatients((patientsRes.patients || []).filter((record) => record.status === "active"));
          setPendingCount(requestsCount);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err.message || "Failed to load patients.");
          setAssignedPatients([]);
          setPendingCount(0);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

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
                See your active patient roster here. Open any patient to enter their dedicated detail page, where clinical notes and treatment plans are available in context.
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

            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
              <button
                type="button"
                onClick={() => navigate('/doctor-patients/requests')}
                className="rounded-2xl border border-white/15 bg-white/10 px-4 py-3 text-left shadow-sm backdrop-blur-sm transition hover:bg-white/15"
              >
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/70">Link requests</p>
                <p className="mt-1 text-xl font-black text-white">{pendingCount}</p>
                <p className="mt-0.5 text-[11px] text-white/75">Open approval queue</p>
              </button>
              <div className="rounded-2xl border border-white/15 bg-white/10 px-4 py-3 shadow-sm backdrop-blur-sm">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/70">Active patients</p>
                <p className="mt-1 text-xl font-black text-white">{assignedPatients.length}</p>
                <p className="mt-0.5 text-[11px] text-white/75">Currently linked</p>
              </div>
            </div>
          </div>
        </section>

        {error ? <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}

        <section className="mt-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-semibold text-slate-900">Assigned patients</h2>
              <p className="mt-1 text-sm text-slate-500">Click a patient to enter their dedicated page.</p>
            </div>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-50"
            >
              Refresh
            </button>
          </div>

          <div className="mt-5 space-y-3">
            {loading ? (
              <p className="text-sm text-slate-500">Loading...</p>
            ) : assignedPatients.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-200 px-6 py-8 text-center text-sm text-slate-500">
                No patients linked yet.
              </div>
            ) : (
              assignedPatients.map((record) => {
                const patientId = record.patient?.id || record.id;
                const snapshot = record.snapshot || {};
                const displayName = patientDisplayName(record);
                return (
                  <button
                    key={patientId}
                    type="button"
                    onClick={() => {
                      rememberDoctorPatientTab({ id: patientId, name: displayName });
                      navigate(`/doctor-patients/${patientId}`);
                    }}
                    className="flex w-full items-start gap-4 rounded-2xl border border-slate-200 p-4 text-left transition hover:border-slate-300 hover:bg-slate-50"
                  >
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-cyan-100 text-sm font-bold text-cyan-700">{patientInitials(record)}</div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="truncate font-semibold text-slate-900">{displayName}</p>
                          {record.patient?.email && displayName !== record.patient.email ? <p className="truncate text-sm text-slate-500">{record.patient.email}</p> : null}
                        </div>
                      </div>
                      <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                        <div className="rounded-xl bg-slate-50 px-3 py-2">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Latest symptom</p>
                          <p className="mt-1 text-sm font-semibold text-slate-900">{snapshot.latestSymptom?.name || "No recent symptom"}</p>
                        </div>
                        <div className="rounded-xl bg-slate-50 px-3 py-2">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Next appointment</p>
                          <p className="mt-1 text-sm font-semibold text-slate-900">{snapshot.nextAppointmentAt ? formatDateTime(snapshot.nextAppointmentAt) : "Not scheduled"}</p>
                        </div>
                        <div className="rounded-xl bg-slate-50 px-3 py-2">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Meds count</p>
                          <p className="mt-1 text-sm font-semibold text-slate-900">{snapshot.activeMedicationCount || 0} active</p>
                        </div>
                        <div className="rounded-xl bg-slate-50 px-3 py-2">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Open patient page</p>
                          <p className="mt-1 text-sm font-semibold text-sky-700">View detail</p>
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
