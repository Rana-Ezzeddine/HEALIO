import { useEffect, useState } from "react";
import Navbar from "../components/Navbar";
import { apiUrl, authHeaders } from "../api/http";

export default function CaregiverAppointments() {
  const [patients, setPatients] = useState([]);
  const [appointments, setAppointments] = useState([]);

  useEffect(() => {
    fetch(`${apiUrl}/api/caregiver/patients`, { headers: { ...authHeaders() } })
      .then((r) => r.json())
      .then(async (data) => {
        const pts = data.patients || [];
        setPatients(pts);
        // Load appointments for each patient who has canViewAppointments
        const all = [];
        for (const entry of pts) {
          if (entry.permissions.canViewAppointments) {
            const r = await fetch(
              `${apiUrl}/api/caregiver/patients/${entry.patient.id}/appointments`,
              { headers: { ...authHeaders() } }
            );
            const d = await r.json();
            (d.appointments || []).forEach((a) =>
              all.push({ ...a, patientEmail: entry.patient.email })
            );
          }
        }
        setAppointments(all);
      });
  }, []);

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />
      <main className="pt-28 max-w-3xl mx-auto px-6 py-8">
        <h1 className="text-3xl font-bold text-slate-800 mb-1">Appointments</h1>
        <p className="text-slate-500 mb-8">
          View your patient's upcoming appointments. Visible only when the
          patient has granted appointment access.
        </p>

        {appointments.length === 0 ? (
          <div className="bg-white rounded-3xl shadow p-8 text-center">
            <p className="text-slate-400 text-sm">
              No appointments to show. This depends on patient permissions.
            </p>
          </div>
        ) : (
          appointments.map((appt) => (
            <div key={appt.id} className="bg-white rounded-3xl shadow p-5 mb-4">
              <p className="text-sm font-medium text-slate-700">
                Patient: {appt.patientEmail}
              </p>
              <p className="text-sm text-slate-500 mt-1">
                {new Date(appt.startsAt).toLocaleString()}
              </p>
              <span className={`mt-2 inline-block text-xs px-2 py-0.5 rounded-full font-medium
                ${appt.status === "scheduled" ? "bg-green-100 text-green-700" :
                  appt.status === "requested" ? "bg-yellow-100 text-yellow-700" :
                  "bg-slate-100 text-slate-500"}`}>
                {appt.status}
              </span>
            </div>
          ))
        )}
      </main>
    </div>
  );
}