import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import Navbar from "../components/Navbar";
import { apiUrl, authHeaders } from "../api/http";

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
          setAssignedPatients(data.patients || []);
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

  const selectedPatient = useMemo(() => {
    if (!selectedPatientId) return null;
    return assignedPatients.find((record) => (record.patient?.id || record.id) === selectedPatientId) || null;
  }, [assignedPatients, selectedPatientId]);

  const shellPlans = useMemo(() => {
    return [
      {
        id: "plan-active",
        title: "Hypertension and lifestyle stabilization",
        status: "active",
        cadence: "Review every 2 weeks",
      },
      {
        id: "plan-draft",
        title: "Post-discharge medication adjustment",
        status: "draft",
        cadence: "Awaiting doctor sign-off",
      },
      {
        id: "plan-archive",
        title: "Short-term symptom control",
        status: "archived",
        cadence: "Completed 1 month ago",
      },
    ];
  }, []);

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

        <section className="mt-6 grid gap-6 lg:grid-cols-[0.8fr_1.2fr]">
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-semibold text-slate-900">Patient scope</h2>
                <p className="mt-1 text-sm text-slate-500">Select a patient to focus active treatment plans.</p>
              </div>
              <button
                type="button"
                onClick={() => navigate("/doctor-patients")}
                className="rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-50"
              >
                Manage patients
              </button>
            </div>

            {error ? (
              <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {error}
              </div>
            ) : null}

            <div className="mt-4">
              <select
                value={selectedPatientId}
                onChange={(event) => {
                  const id = event.target.value;
                  navigate(id ? `/doctor-treatment-plans?patientId=${id}` : "/doctor-treatment-plans");
                }}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-sky-300"
                disabled={loading || assignedPatients.length === 0}
              >
                <option value="">{loading ? "Loading patients..." : "Select a patient"}</option>
                {assignedPatients.map((record) => {
                  const id = record.patient?.id || record.id;
                  return (
                    <option key={id} value={id}>
                      {patientDisplayName(record)}
                    </option>
                  );
                })}
              </select>
            </div>

            <div className="mt-4 rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
              {selectedPatient
                ? `Selected patient: ${patientDisplayName(selectedPatient)}`
                : "No patient selected yet. Choose a patient to preview plan modules."}
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl bg-slate-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Active plans</p>
                <p className="mt-2 text-2xl font-black text-slate-900">--</p>
              </div>
              <div className="rounded-2xl bg-slate-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Due this week</p>
                <p className="mt-2 text-2xl font-black text-slate-900">--</p>
              </div>
              <div className="rounded-2xl bg-slate-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Care goals hit</p>
                <p className="mt-2 text-2xl font-black text-slate-900">--</p>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-xl font-semibold text-slate-900">Treatment plans shell</h2>
                  <p className="mt-1 text-sm text-slate-500">
                    Placeholder plan cards below can be replaced with live treatment plan data.
                  </p>
                </div>
                <button
                  type="button"
                  disabled={!selectedPatientId}
                  className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${
                    selectedPatientId
                      ? "bg-violet-100 text-violet-700 hover:bg-violet-200"
                      : "cursor-not-allowed bg-slate-100 text-slate-400"
                  }`}
                >
                  Create plan
                </button>
              </div>

              <div className="mt-5 space-y-4">
                {shellPlans.map((plan) => (
                  <div key={plan.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold text-slate-900">{plan.title}</p>
                        <p className="mt-1 text-sm text-slate-500">{plan.cadence}</p>
                      </div>
                      <span className={`rounded-full px-3 py-1 text-xs font-semibold ${planStatusPill[plan.status] || "bg-slate-100 text-slate-700"}`}>
                        {plan.status}
                      </span>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        type="button"
                        className="rounded-lg bg-sky-100 px-3 py-1.5 text-xs font-semibold text-sky-700 transition hover:bg-sky-200"
                      >
                        Open details
                      </button>
                      <button
                        type="button"
                        className="rounded-lg bg-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-300"
                      >
                        View timeline
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-xl font-semibold text-slate-900">Navigation</h2>
              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                <button
                  type="button"
                  onClick={() => navigate("/dashboardDoctor")}
                  className="rounded-2xl bg-slate-100 px-4 py-3 text-left text-sm font-semibold text-slate-700 transition hover:bg-slate-200"
                >
                  Doctor dashboard
                </button>
                <button
                  type="button"
                  onClick={() => navigate("/doctor-patients")}
                  className="rounded-2xl bg-cyan-100 px-4 py-3 text-left text-sm font-semibold text-cyan-700 transition hover:bg-cyan-200"
                >
                  Doctor patients
                </button>
                <button
                  type="button"
                  onClick={() => navigate("/doctor-clinical-notes")}
                  className="rounded-2xl bg-indigo-100 px-4 py-3 text-left text-sm font-semibold text-indigo-700 transition hover:bg-indigo-200"
                >
                  Clinical notes
                </button>
              </div>
            </section>
          </div>
        </section>
      </main>
    </div>
  );
}
