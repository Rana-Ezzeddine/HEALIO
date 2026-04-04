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

export default function DoctorClinicalNotes() {
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

        <section className="mt-6 grid gap-6 lg:grid-cols-[0.8fr_1.2fr]">
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-semibold text-slate-900">Patient context</h2>
                <p className="mt-1 text-sm text-slate-500">Pick a patient to scope notes and clinical information.</p>
              </div>
              <button
                type="button"
                onClick={() => navigate("/doctor-patients")}
                className="rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition"
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
                  navigate(id ? `/doctor-clinical-notes?patientId=${id}` : "/doctor-clinical-notes");
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
                ? `Current patient: ${patientDisplayName(selectedPatient)}`
                : "No patient selected yet. Choose a patient to open clinical notes workflows."}
            </div>
          </div>

          <div className="space-y-6">
            <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-xl font-semibold text-slate-900">Clinical notes shell</h2>
              <p className="mt-1 text-sm text-slate-500">
                This workspace is set up for note timeline, note creation, and treatment plan visibility.
              </p>

              <div className="mt-5 grid gap-4 sm:grid-cols-3">
                <div className="rounded-2xl bg-slate-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Notes</p>
                  <p className="mt-2 text-2xl font-black text-slate-900">--</p>
                  <p className="mt-1 text-xs text-slate-500">Count appears after patient selection + data binding</p>
                </div>
                <div className="rounded-2xl bg-slate-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Treatment plans</p>
                  <p className="mt-2 text-2xl font-black text-slate-900">--</p>
                  <p className="mt-1 text-xs text-slate-500">Plan summary will render here</p>
                </div>
                <div className="rounded-2xl bg-slate-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Last update</p>
                  <p className="mt-2 text-2xl font-black text-slate-900">--</p>
                  <p className="mt-1 text-xs text-slate-500">Latest note date placeholder</p>
                </div>
              </div>

              <div className="mt-5 flex flex-wrap gap-3">
                <button
                  type="button"
                  disabled={!selectedPatientId}
                  className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${
                    selectedPatientId
                      ? "bg-indigo-100 text-indigo-700 hover:bg-indigo-200"
                      : "cursor-not-allowed bg-slate-100 text-slate-400"
                  }`}
                >
                  Create clinical note
                </button>
                <button
                  type="button"
                  disabled={!selectedPatientId}
                  onClick={() =>
                    navigate(
                      selectedPatientId
                        ? `/doctor-treatment-plans?patientId=${selectedPatientId}`
                        : "/doctor-treatment-plans"
                    )
                  }
                  className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${
                    selectedPatientId
                      ? "bg-sky-100 text-sky-700 hover:bg-sky-200"
                      : "cursor-not-allowed bg-slate-100 text-slate-400"
                  }`}
                >
                  View treatment plans
                </button>
              </div>
            </section>

            <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-xl font-semibold text-slate-900">Navigation</h2>
              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                <button
                  type="button"
                  onClick={() => navigate("/dashboardDoctor")}
                  className="rounded-2xl bg-slate-100 px-4 py-3 text-left text-sm font-semibold text-slate-700 hover:bg-slate-200 transition"
                >
                  Doctor dashboard
                </button>
                <button
                  type="button"
                  onClick={() => navigate("/doctor-patients")}
                  className="rounded-2xl bg-cyan-100 px-4 py-3 text-left text-sm font-semibold text-cyan-700 hover:bg-cyan-200 transition"
                >
                  Doctor patients
                </button>
                <button
                  type="button"
                  onClick={() => navigate("/doctor-treatment-plans")}
                  className="rounded-2xl bg-violet-100 px-4 py-3 text-left text-sm font-semibold text-violet-700 hover:bg-violet-200 transition"
                >
                  Treatment plans
                </button>
              </div>
            </section>
          </div>
        </section>
      </main>
    </div>
  );
}