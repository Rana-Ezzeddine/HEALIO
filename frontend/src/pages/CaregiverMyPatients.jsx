import { useEffect, useState } from "react";
import Navbar from "../components/Navbar";
import { apiUrl, authHeaders } from "../api/http";
import { useNavigate } from "react-router-dom";

export default function CaregiverMyPatients() {
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    // GET /api/caregiver/patients
    fetch(`${apiUrl}/api/caregiver/patients`, {
      headers: { ...authHeaders() },
    })
      .then((r) => r.json())
      .then((data) => {
        setPatients(data.patients || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const PERMISSION_LABELS = {
    canViewMedications: "Medications",
    canViewSymptoms: "Symptoms",
    canViewAppointments: "Appointments",
    canMessageDoctor: "Message Doctor",
    canReceiveReminders: "Reminders",
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />
      <main className="pt-28 max-w-3xl mx-auto px-6 py-8">
        <h1 className="text-3xl font-bold text-slate-800 mb-1">My Patients</h1>
        <p className="text-slate-500 mb-8">
          Patients who have linked you as their caregiver. Your access depends
          on the permissions each patient has granted.
        </p>

        {/* 6.2.b — not linked: clear empty state */}
        {!loading && patients.length === 0 && (
          <div className="bg-white rounded-3xl shadow p-8 text-center">
            <p className="text-slate-400 text-sm mb-4">
              You are not linked to any patients yet.
            </p>
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
            className="bg-white rounded-3xl shadow p-6 mb-4"
          >
            <p className="font-semibold text-slate-800">{entry.patient.email}</p>
            <p className="text-xs text-slate-400 mt-1">
              Permissions:{" "}
              {Object.entries(entry.permissions)
                .filter(([, v]) => v)
                .map(([k]) => PERMISSION_LABELS[k])
                .join(", ") || "None granted yet"}
            </p>
            <button
              onClick={() => navigate(`/caregiverDashboard?patientId=${entry.patient.id}`)}
              className="mt-3 text-xs text-sky-600 hover:underline"
            >
              View Dashboard →
            </button>
          </div>
        ))}
      </main>
    </div>
  );
}