import { useEffect, useState } from "react";
import Navbar from "../components/Navbar";
import { getCaregiverPatientAppointments, getMyPatients } from "../api/caregiver";
import {
  resolveActiveCaregiverPatientId,
  setActiveCaregiverPatientId,
} from "../utils/caregiverPatientContext";

export default function CaregiverCareConcern() {
  const [patients, setPatients] = useState([]);
  const [patientId, setPatientId] = useState("");
  const [appointments, setAppointments] = useState([]);
  const [message, setMessage] = useState("");

  useEffect(() => {
    getMyPatients()
      .then((data) => {
        const pts = data.patients || [];
        setPatients(pts);

        const resolvedId = resolveActiveCaregiverPatientId(pts);
        setPatientId(resolvedId);
        setActiveCaregiverPatientId(resolvedId);
      })
      .catch((err) => setMessage(err.message || "Failed to load linked patients."));
  }, []);

  useEffect(() => {
    if (!patientId) {
      setAppointments([]);
      return;
    }

    let cancelled = false;
    getCaregiverPatientAppointments(patientId)
      .then((data) => {
        if (!cancelled) {
          const list = data.appointments || data || [];
          setAppointments(Array.isArray(list) ? list : []);
          setMessage("");
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setAppointments([]);
          setMessage(err.message || "Failed to load doctor contact details.");
        }
      });

    return () => {
      cancelled = true;
    };
  }, [patientId]);

  const selectedPatient = patients.find((entry) => entry.patient.id === patientId)?.patient || null;
  const doctorContacts = Array.from(
    new Map(
      appointments
        .map((appointment) => appointment?.doctor)
        .filter(Boolean)
        .map((doctor) => [doctor.id || doctor.email || doctor.displayName, doctor])
    ).values()
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-sky-50 via-white to-indigo-50">
      <Navbar />
      <main className="mx-auto max-w-2xl px-6 pt-28 pb-10">
        <h1 className="text-3xl font-bold text-slate-800 mb-1">Care Contacts</h1>
        <p className="text-slate-500 mb-8">
          Contact details only for care coordination. Doctor-caregiver messaging is not available in this app.
        </p>

        {patients.length > 1 && (
          <select
            value={patientId}
            onChange={(e) => {
              const nextId = e.target.value;
              setPatientId(nextId);
              setActiveCaregiverPatientId(nextId);
            }}
            className="mb-6 rounded-xl border border-slate-300 px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
          >
            {patients.map((e) => (
              <option key={e.patient.id} value={e.patient.id}>
                {e.patient.displayName || e.patient.email}
              </option>
            ))}
          </select>
        )}

        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700 mb-6">
          <strong>Reminder:</strong> Use these contacts for external coordination only. Do not diagnose, prescribe, or recommend treatment changes.
        </div>

        {message && (
          <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {message}
          </div>
        )}

        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Patient contact</h2>
          {selectedPatient ? (
            <div className="mt-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-sm font-semibold text-slate-900">{selectedPatient.displayName || "Patient"}</p>
              <p className="mt-1 text-sm text-slate-600">{selectedPatient.email || "No patient email shared"}</p>
              <p className="mt-1 text-sm text-slate-600">{selectedPatient.phoneNumber || "No patient phone shared"}</p>
            </div>
          ) : (
            <p className="mt-3 text-sm text-slate-500">No linked patient selected.</p>
          )}

          <h2 className="mt-6 text-lg font-semibold text-slate-900">Doctor contact</h2>
          <div className="mt-3 space-y-3">
            {doctorContacts.length ? doctorContacts.map((doctor) => (
              <div key={doctor.id || doctor.email || doctor.displayName} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-sm font-semibold text-slate-900">{doctor.displayName || "Doctor"}</p>
                <p className="mt-1 text-sm text-slate-600">{doctor.email || "No doctor email shared"}</p>
                <p className="mt-1 text-sm text-slate-600">{doctor.phoneNumber || "No doctor phone shared"}</p>
              </div>
            )) : (
              <p className="text-sm text-slate-500">No doctor contact has been shared for this patient yet.</p>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}