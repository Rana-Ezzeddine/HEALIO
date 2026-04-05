import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "../components/Navbar";
import { getMyPatients } from "../api/caregiver";

const PERMISSION_LABELS = {
  canViewMedications: "View Medications",
  canViewSymptoms: "View Symptoms",
  canViewAppointments: "View Appointments",
  canMessageDoctor: "Doctor Contact Info",
  canReceiveReminders: "Receive Reminders",
};

export default function CaregiverMyPatients() {
  const navigate = useNavigate();
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getMyPatients()
      .then((data) => setPatients(data.patients || []))
      .catch(() => setPatients([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-sky-50 via-white to-indigo-50">
      <Navbar />
      <main className="mx-auto max-w-3xl px-6 pt-28 pb-10">
        <h1 className="text-3xl font-bold text-slate-800 mb-1">My Patients</h1>
        {/*caregiver actions depend on patient permissions */}
        <p className="text-slate-500 mb-8">
          Patients who have linked you as their caregiver. Your access to each
          patient's information depends on the permissions they have granted you.
        </p>

        {/* not linked: explain clearly and show next action */}
        {!loading && patients.length === 0 && (
          <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-10 text-center">
            <p className="text-slate-700 font-medium mb-2">
              You are not linked to any patients yet.
            </p>
            <p className="text-slate-400 text-sm mb-6">
              Ask your patient to share an invite link, then enter it below.
            </p>
            {/* paste invite link action */}
            <button
              onClick={() => navigate("/caregiverAcceptInvite")}
              className="rounded-xl bg-sky-500 px-6 py-2 text-sm font-semibold text-white hover:bg-sky-600 transition"
            >
              Enter Patient Invite Link
            </button>
          </div>
        )}

        {patients.map((entry) => (
          <div
            key={entry.patient.id}
            className="rounded-3xl border border-slate-200 bg-white p-6 mb-4 shadow-sm"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="font-semibold text-slate-800">{entry.patient.email}</p>
                {/*plain language permission list */}
                <div className="mt-2 flex flex-wrap gap-1">
                  {Object.entries(entry.permissions)
                    .filter(([, v]) => v)
                    .map(([k]) => (
                      <span
                        key={k}
                        className="rounded-full bg-sky-100 px-2 py-0.5 text-xs font-medium text-sky-700"
                      >
                        {PERMISSION_LABELS[k] ?? k}
                      </span>
                    ))}
                  {Object.values(entry.permissions).every((v) => !v) && (
                    <span className="text-xs text-slate-400">No permissions granted yet</span>
                  )}
                </div>
              </div>
              <button
                onClick={() => navigate(`/caregiverDashboard?patientId=${entry.patient.id}`)}
                className="rounded-xl bg-sky-500 px-4 py-2 text-xs font-semibold text-white hover:bg-sky-600 transition whitespace-nowrap"
              >
                View Dashboard
              </button>
            </div>
          </div>
        ))}

        {!loading && patients.length > 0 && (
          <div className="mt-4 text-center">
            <button
              onClick={() => navigate("/caregiverAcceptInvite")}
              className="text-sm text-sky-600 hover:underline"
            >
              + Connect to another patient
            </button>
          </div>
        )}
      </main>
    </div>
  );
}