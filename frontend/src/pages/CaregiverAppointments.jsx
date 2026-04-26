
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "../components/Navbar";
import { apiUrl, authHeaders } from "../api/http";
import { caregiverRequestAppointment, getCaregiverPatientAppointments } from "../api/caregiver";
import {
  resolveActiveCaregiverPatientId,
  setActiveCaregiverPatientId,
} from "../utils/caregiverPatientContext";

function patientLabel(record) {
  return record?.patient?.displayName || record?.patient?.email || "Patient";
}

function doctorLabel(appointment) {
  return appointment?.doctor?.displayName || appointment?.doctor?.email || "Doctor";
}

function formatDateTimeParts(dateLike) {
  const date = new Date(dateLike);
  return {
    date: date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
    time: date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }),
  };
}

function statusLabel(status) {
  if (status === "requested") return "Requested";
  if (status === "scheduled") return "Scheduled";
  if (status === "completed") return "Completed";
  if (status === "cancelled") return "Cancelled";
  if (status === "denied") return "Denied";
  return status || "Unknown";
}

function statusClass(status) {
  if (status === "requested") return "bg-amber-100 text-amber-700";
  if (status === "scheduled") return "bg-emerald-100 text-emerald-700";
  if (status === "completed") return "bg-sky-100 text-sky-700";
  if (status === "cancelled") return "bg-slate-200 text-slate-700";
  if (status === "denied") return "bg-rose-100 text-rose-700";
  return "bg-slate-100 text-slate-700";
}

export default function CaregiverAppointments() {
  const navigate = useNavigate();

  const [linkedPatients, setLinkedPatients] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [activePatientId, setActivePatientId] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [form, setForm] = useState({ startsAt: "", endsAt: "", location: "", notes: "" });
  const [requestMessage, setRequestMessage] = useState(null);
  const [requesting, setRequesting] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadPatients() {
      setLoading(true);
      setError("");
      try {
        const res = await fetch(`${apiUrl}/api/caregivers/patients`, {
          headers: { "Content-Type": "application/json", ...authHeaders() },
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.message || "Failed to load linked patients.");

        if (cancelled) return;

        const patients = data.patients || [];
        const resolvedId = resolveActiveCaregiverPatientId(patients);
        setLinkedPatients(patients);
        setActivePatientId(resolvedId);
      } catch (err) {
        if (!cancelled) setError(err.message || "Failed to load patients.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadPatients();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!activePatientId) return;

    const entry = linkedPatients.find((r) => r.patient?.id === activePatientId);
    // Only fetch if canViewAppointments — exact field from CaregiverPatientPermission
    if (!entry?.permissions?.canViewAppointments) {
      setAppointments([]);
      return;
    }

    getCaregiverPatientAppointments(activePatientId)
      .then((data) => setAppointments(data.appointments || []))
      .catch(() => setAppointments([]));
  }, [activePatientId, linkedPatients]);

  const activePatientRecord = useMemo(
    () => linkedPatients.find((r) => r.patient?.id === activePatientId) || null,
    [activePatientId, linkedPatients]
  );

  const canViewAppointments = Boolean(activePatientRecord?.permissions?.canViewAppointments);

  const upcomingAppointments = useMemo(
    () =>
      appointments
        .filter((a) => new Date(a.startsAt).getTime() >= Date.now())
        .sort((a, b) => new Date(a.startsAt) - new Date(b.startsAt)),
    [appointments]
  );

  const pastAppointments = useMemo(
    () =>
      appointments
        .filter((a) => new Date(a.startsAt).getTime() < Date.now())
        .sort((a, b) => new Date(b.startsAt) - new Date(a.startsAt)),
    [appointments]
  );

  const handleRequest = async () => {
    if (!form.startsAt || !form.endsAt) {
      setRequestMessage("Start and end times are required.");
      return;
    }
    if (new Date(form.startsAt) >= new Date(form.endsAt)) {
      setRequestMessage("End time must be after start time.");
      return;
    }
    setRequesting(true);
    setRequestMessage(null);
    try {
      await caregiverRequestAppointment(activePatientId, {
        startsAt: new Date(form.startsAt).toISOString(),
        endsAt: new Date(form.endsAt).toISOString(),
        location: form.location || null,
        notes: form.notes || null,
      });
      setRequestMessage("Appointment requested successfully.");
      setIsModalOpen(false);
      setForm({ startsAt: "", endsAt: "", location: "", notes: "" });
      // Refresh appointments
      getCaregiverPatientAppointments(activePatientId)
        .then((data) => setAppointments(data.appointments || []))
        .catch(() => {});
    } catch (err) {
      setRequestMessage(err.message || "Failed to request appointment.");
    } finally {
      setRequesting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />

      <main className="mx-auto max-w-6xl px-6 pb-10 pt-28">
        {/* Header */}
        <section className="rounded-[2rem] bg-gradient-to-r from-slate-900 via-cyan-800 to-sky-600 p-8 text-white shadow-xl">
          <p className="text-sm font-semibold uppercase tracking-[0.25em] text-white/75">
            Caregiver Appointments
          </p>
          <h1 className="mt-3 text-4xl font-black">Patient Visit Timeline</h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-white/85">
            Track scheduled, requested, and completed appointments for your active patient context.
          </p>

          <div className="mt-5 max-w-sm">
            <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-white/70">
              Active patient context
            </label>
            <select
              value={activePatientId}
              onChange={(e) => {
                const nextId = e.target.value;
                setActivePatientId(nextId);
                setActiveCaregiverPatientId(nextId);
              }}
              className="w-full rounded-xl border border-white/30 bg-white/95 px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-sky-300"
              disabled={linkedPatients.length === 0}
            >
              {linkedPatients.length > 0 ? (
                linkedPatients.map((record) => (
                  <option key={record.patient?.id} value={record.patient?.id || ""}>
                    {patientLabel(record)}
                  </option>
                ))
              ) : (
                <option value="">No linked patients</option>
              )}
            </select>
          </div>
        </section>

        {error && (
          <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {requestMessage && (
          <div className="mt-4 rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-700">
            {requestMessage}
          </div>
        )}

        {loading ? (
          <section className="mt-6 rounded-3xl border border-slate-200 bg-white p-8 text-sm text-slate-500 shadow-sm">
            Loading caregiver appointments...
          </section>
        ) : linkedPatients.length === 0 ? (
          <section className="mt-6 rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
            <h2 className="text-xl font-semibold text-slate-900">No linked patients yet</h2>
            <p className="mt-2 text-sm text-slate-600">
              Accept a patient invitation first to unlock appointment visibility.
            </p>
            <button
              type="button"
              onClick={() => navigate("/caregiverAcceptInvite")}
              className="mt-5 rounded-2xl bg-cyan-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-cyan-600"
            >
              Enter patient invite link
            </button>
          </section>
        ) : (
          <>
            {/* Permission notice + Request button */}
            <section className="mt-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <div>
                  <h2 className="text-xl font-semibold text-slate-900">Upcoming appointments</h2>
                  <p className="mt-1 text-sm text-slate-500">
                    What is scheduled next for this patient.
                  </p>
                  {/* Permission state explanation */}
                  {!canViewAppointments && (
                    <p className="mt-2 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
                      This patient has not granted appointment visibility. Ask them
                      to enable it from their Care Team settings.
                    </p>
                  )}
                </div>

                {/*request appointment button
                    Shown when canViewAppointments is true */}
                {canViewAppointments && (
                  <button
                    type="button"
                    onClick={() => {
                      setRequestMessage(null);
                      setIsModalOpen(true);
                    }}
                    className="rounded-2xl bg-sky-500 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-sky-600"
                  >
                    + Request Appointment
                  </button>
                )}
              </div>

              {canViewAppointments && (
                <div className="mt-5 space-y-3">
                  {upcomingAppointments.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-slate-200 px-6 py-8 text-center text-sm text-slate-500">
                      No upcoming appointments in this patient context.
                    </div>
                  ) : (
                    upcomingAppointments.map((appointment) => {
                      const dt = formatDateTimeParts(appointment.startsAt);
                      return (
                        <article
                          key={appointment.id}
                          className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
                        >
                          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                            <div>
                              <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">
                                {dt.date}
                              </p>
                              <p className="mt-1 text-lg font-semibold text-slate-900">{dt.time}</p>
                              <p className="mt-1 text-sm text-slate-600">
                                With {doctorLabel(appointment)}
                              </p>
                              {appointment.location && (
                                <p className="mt-1 text-sm text-slate-500">
                                  Location: {appointment.location}
                                </p>
                              )}
                            </div>
                            <span
                              className={`h-fit rounded-full px-3 py-1 text-xs font-semibold ${statusClass(appointment.status)}`}
                            >
                              {statusLabel(appointment.status)}
                            </span>
                          </div>
                          {appointment.notes && (
                            <p className="mt-3 rounded-xl bg-white px-3 py-2 text-sm text-slate-600">
                              {appointment.notes}
                            </p>
                          )}
                        </article>
                      );
                    })
                  )}
                </div>
              )}
            </section>

            {/* Past appointments */}
            {canViewAppointments && (
              <section className="mt-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                <h2 className="text-xl font-semibold text-slate-900">Recent history</h2>
                <p className="mt-1 text-sm text-slate-500">
                  Completed or past appointment records for reference.
                </p>
                <div className="mt-5 space-y-3">
                  {pastAppointments.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-slate-200 px-6 py-8 text-center text-sm text-slate-500">
                      No past appointments found.
                    </div>
                  ) : (
                    pastAppointments.slice(0, 8).map((appointment) => {
                      const dt = formatDateTimeParts(appointment.startsAt);
                      return (
                        <article
                          key={appointment.id}
                          className="rounded-2xl border border-slate-200 p-4"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <div>
                              <p className="font-medium text-slate-900">
                                {dt.date} at {dt.time}
                              </p>
                              <p className="text-sm text-slate-500">
                                With {doctorLabel(appointment)}
                              </p>
                            </div>
                            <span
                              className={`rounded-full px-3 py-1 text-xs font-semibold ${statusClass(appointment.status)}`}
                            >
                              {statusLabel(appointment.status)}
                            </span>
                          </div>
                        </article>
                      );
                    })
                  )}
                </div>
              </section>
            )}
          </>
        )}
      </main>

      {/* Request Appointment Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-xl">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-xl font-semibold text-slate-900">Request Appointment</h2>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 transition"
              >
                ✕
              </button>
            </div>

            <p className="text-sm text-slate-500 mb-5">
              Requesting on behalf of <strong>{patientLabel(activePatientRecord)}</strong>.
              The doctor will review and confirm.
            </p>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Start Time
                </label>
                <input
                  type="datetime-local"
                  value={form.startsAt}
                  onChange={(e) => setForm((f) => ({ ...f, startsAt: e.target.value }))}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  End Time
                </label>
                <input
                  type="datetime-local"
                  value={form.endsAt}
                  onChange={(e) => setForm((f) => ({ ...f, endsAt: e.target.value }))}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Location (optional)
                </label>
                <input
                  type="text"
                  value={form.location}
                  onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))}
                  placeholder="Clinic name or address"
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Notes (optional)
                </label>
                <textarea
                  value={form.notes}
                  onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                  rows={2}
                  placeholder="Reason for visit or any context for the doctor..."
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 resize-none"
                />
              </div>
            </div>

            {requestMessage && (
              <p className="mt-3 text-sm text-red-600">{requestMessage}</p>
            )}

            <div className="flex gap-3 mt-6">
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="flex-1 rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleRequest}
                disabled={requesting}
                className="flex-1 rounded-xl bg-sky-500 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-600 transition disabled:opacity-40"
              >
                {requesting ? "Requesting..." : "Request Appointment"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}