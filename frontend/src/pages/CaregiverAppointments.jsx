import { useEffect, useState } from "react";
import Navbar from "../components/Navbar";
import { CalendarDays, Plus, X } from "lucide-react";
import {
  getCaregiverPatientAppointments,
  caregiverRequestAppointment,
  getMyPatients,
} from "../api/caregiver";

const STATUS_STYLES = {
  scheduled: "bg-emerald-100 text-emerald-700",
  cancelled: "bg-red-100 text-red-700",
  completed: "bg-slate-100 text-slate-600",
};

export default function CaregiverAppointments() {
  const [patients, setPatients] = useState([]);
  const [patientId, setPatientId] = useState("");
  const [appointments, setAppointments] = useState([]);
  const [permission, setPermission] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [form, setForm] = useState({ startsAt: "", endsAt: "", location: "", notes: "" });
  const [message, setMessage] = useState(null);

  useEffect(() => {
    getMyPatients().then((data) => {
      const pts = data.patients || [];
      setPatients(pts);
      if (pts.length > 0) setPatientId(pts[0].patient.id);
    });
  }, []);

  useEffect(() => {
    if (!patientId) return;
    const entry = patients.find((p) => p.patient.id === patientId);
    setPermission(entry?.permissions?.canViewAppointments ?? false);
    loadAppointments();
  }, [patientId, patients]);

  const loadAppointments = () => {
    if (!patientId) return;
    setLoading(true);
    getCaregiverPatientAppointments(patientId)
      .then((data) => setAppointments(data.appointments || []))
      .catch(() => setAppointments([]))
      .finally(() => setLoading(false));
  };

  const handleRequest = async () => {
    if (!form.startsAt || !form.endsAt) {
      setMessage("Start and end times are required.");
      return;
    }
    try {
      await caregiverRequestAppointment(patientId, form);
      setMessage("Appointment requested successfully.");
      setIsModalOpen(false);
      setForm({ startsAt: "", endsAt: "", location: "", notes: "" });
      loadAppointments();
    } catch (err) {
      setMessage(err.message || "Failed to request appointment.");
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-sky-50 via-white to-indigo-50">
      <Navbar />
      <main className="mx-auto max-w-3xl px-6 pt-28 pb-10">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-3">
            <CalendarDays className="text-sky-500" size={24} />
            <h1 className="text-3xl font-bold text-slate-800">Appointments</h1>
          </div>
          {/*request appointment on behalf of patient */}
          {permission && (
            <button
              onClick={() => setIsModalOpen(true)}
              className="inline-flex items-center gap-2 rounded-2xl bg-sky-500 px-5 py-2 text-sm font-semibold text-white hover:bg-sky-600 transition"
            >
              <Plus size={16} /> Request Appointment
            </button>
          )}
        </div>

        {/* schedule and reminder access */}
        <p className="text-slate-500 mb-6">
          View your patient's appointment schedule and reminders.
          {permission
            ? " You can also request appointments on their behalf."
            : " Appointment access depends on patient permissions."}
        </p>

        {patients.length > 1 && (
          <select
            value={patientId}
            onChange={(e) => setPatientId(e.target.value)}
            className="mb-6 rounded-xl border border-slate-300 px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
          >
            {patients.map((e) => (
              <option key={e.patient.id} value={e.patient.id}>
                {e.patient.email}
              </option>
            ))}
          </select>
        )}

        {message && (
          <div className="mb-4 rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-700">
            {message}
          </div>
        )}

        {!permission && (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700 mb-6">
            You do not have permission to view appointments for this patient.
          </div>
        )}

        {loading && <p className="text-slate-400 text-sm">Loading appointments...</p>}

        {permission && !loading && appointments.length === 0 && (
          <div className="rounded-3xl border border-dashed border-slate-200 p-10 text-center text-slate-400 text-sm">
            No appointments to show.
          </div>
        )}

        <div className="space-y-4">
          {permission && appointments.map((appt) => (
            <div key={appt.id} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold text-slate-800">
                    {new Date(appt.startsAt).toLocaleDateString(undefined, {
                      weekday: "long", month: "long", day: "numeric",
                    })}
                  </p>
                  <p className="text-sm text-slate-500 mt-1">
                    {new Date(appt.startsAt).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}
                    {" — "}
                    {new Date(appt.endsAt).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}
                  </p>
                  {appt.location && <p className="text-sm text-slate-400 mt-1">{appt.location}</p>}
                  {appt.doctor && <p className="text-sm text-slate-400 mt-1">Dr. {appt.doctor.email}</p>}
                  {appt.notes && <p className="text-sm text-slate-400 mt-1">{appt.notes}</p>}
                </div>
                {/* Appointment.status exact values */}
                <span className={`rounded-full px-3 py-1 text-xs font-semibold ${STATUS_STYLES[appt.status] ?? "bg-slate-100 text-slate-500"}`}>
                  {appt.status}
                </span>
              </div>
            </div>
          ))}
        </div>
      </main>

      {/* Request appointment modal  */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-lg">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xl font-semibold text-slate-900">Request Appointment</h2>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X size={24} />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Start Time</label>
                <input
                  type="datetime-local"
                  value={form.startsAt}
                  onChange={(e) => setForm((f) => ({ ...f, startsAt: e.target.value }))}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">End Time</label>
                <input
                  type="datetime-local"
                  value={form.endsAt}
                  onChange={(e) => setForm((f) => ({ ...f, endsAt: e.target.value }))}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Location (optional)</label>
                <input
                  type="text"
                  value={form.location}
                  onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Notes (optional)</label>
                <textarea
                  value={form.notes}
                  onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                  rows={2}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setIsModalOpen(false)}
                className="flex-1 rounded-xl border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                onClick={handleRequest}
                className="flex-1 rounded-xl bg-sky-500 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-600"
              >
                Request
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}