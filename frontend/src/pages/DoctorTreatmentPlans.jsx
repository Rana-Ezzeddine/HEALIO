import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import Navbar from "../components/Navbar";
import { apiUrl, authHeaders } from "../api/http";
import { rememberDoctorPatientTab } from "../utils/doctorPatientTabs";

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
                        This workspace stays focused on the selected patient without extra patient-selection controls.
                      </p>
                    </div>
                    <button
                      type="button"
                      className="rounded-xl bg-violet-100 px-4 py-2 text-sm font-semibold text-violet-700 transition hover:bg-violet-200"
                    >
                      Create plan
                    </button>
                  </div>

                  <div className="mt-5 rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-5 py-6 text-sm text-slate-500">
                    This patient-specific page is ready for full treatment-plan authoring without an extra selector or scope panel.
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
              </>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
