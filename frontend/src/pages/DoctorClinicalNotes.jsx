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

        <section className="mt-6">
          <div className="space-y-6">
            {!selectedPatientId ? (
              <section className="rounded-3xl border border-dashed border-slate-200 bg-white p-8 text-sm text-slate-500 shadow-sm">
                Open a patient from the patients page first. Clinical notes are scoped through patient context now.
              </section>
            ) : (
              <>
                <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <h2 className="text-xl font-semibold text-slate-900">
                        {selectedPatient ? `${patientDisplayName(selectedPatient)} · Clinical notes` : "Clinical notes"}
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
                        onClick={() => navigate(`/doctor-treatment-plans?patientId=${selectedPatientId}`)}
                        className="rounded-xl bg-violet-100 px-4 py-2 text-sm font-semibold text-violet-700 transition hover:bg-violet-200"
                      >
                        Open treatment plans
                      </button>
                    </div>
                  </div>
                </section>

                <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                  <h2 className="text-xl font-semibold text-slate-900">Clinical notes shell</h2>
                  <p className="mt-1 text-sm text-slate-500">
                    This workspace stays focused on the selected patient without extra patient-selection controls.
                  </p>

                  <div className="mt-5 flex flex-wrap gap-3">
                    <button
                      type="button"
                      className="rounded-xl bg-indigo-100 px-4 py-2 text-sm font-semibold text-indigo-700 transition hover:bg-indigo-200"
                    >
                      Create clinical note
                    </button>
                    <button
                      type="button"
                      onClick={() => navigate(`/doctor-treatment-plans?patientId=${selectedPatientId}`)}
                      className="rounded-xl bg-sky-100 px-4 py-2 text-sm font-semibold text-sky-700 transition hover:bg-sky-200"
                    >
                      View treatment plans
                    </button>
                  </div>

                  <div className="mt-5 rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-5 py-6 text-sm text-slate-500">
                    This patient-specific page is ready for full note creation and history without an extra selector or scope panel.
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
