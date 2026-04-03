import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "../components/Navbar";
import { apiUrl, authHeaders } from "../api/http";
import { getMyAppointments } from "../api/appointments";
import {
  resolveActiveCaregiverPatientId,
  setActiveCaregiverPatientId,
} from "../utils/caregiverPatientContext";

function getOwnerId(record) {
  return (
    record?.patientId ||
    record?.patient?.id ||
    record?.ownerId ||
    record?.userId ||
    ""
  );
}

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

  useEffect(() => {
    let cancelled = false;

    async function loadPageData() {
      setLoading(true);
      setError("");

      try {
        const [patientsRes, appointmentsData] = await Promise.all([
          fetch(`${apiUrl}/api/caregivers/patients`, {
            headers: { "Content-Type": "application/json", ...authHeaders() },
          }).then(async (res) => {
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(data.message || "Failed to load linked patients.");
            return data;
          }),
          getMyAppointments(),
        ]);

        if (cancelled) return;

        const patients = patientsRes.patients || [];
        const resolvedId = resolveActiveCaregiverPatientId(patients);

        setLinkedPatients(patients);
        setActivePatientId(resolvedId);
        setAppointments(appointmentsData.appointments || []);
      } catch (err) {
        if (!cancelled) {
          setError(err.message || "Failed to load caregiver appointments.");
          setLinkedPatients([]);
          setActivePatientId("");
          setAppointments([]);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadPageData();
    return () => {
      cancelled = true;
    };
  }, []);

  const activePatientRecord = useMemo(
    () => linkedPatients.find((record) => record.patient?.id === activePatientId) || null,
    [activePatientId, linkedPatients]
  );

  const canViewAppointments = Boolean(activePatientRecord?.permissions?.canViewAppointments);

  const scopedAppointments = useMemo(() => {
    if (!activePatientId) return [];
    return appointments
      .filter((appointment) => {
        const ownerId = getOwnerId(appointment);
        return ownerId ? ownerId === activePatientId : true;
      })
      .sort((left, right) => new Date(left.startsAt) - new Date(right.startsAt));
  }, [activePatientId, appointments]);

  const upcomingAppointments = useMemo(
    () => scopedAppointments.filter((item) => new Date(item.startsAt).getTime() >= Date.now()),
    [scopedAppointments]
  );

  const pastAppointments = useMemo(
    () => scopedAppointments.filter((item) => new Date(item.startsAt).getTime() < Date.now()).reverse(),
    [scopedAppointments]
  );

  const requestedCount = useMemo(
    () => scopedAppointments.filter((item) => item.status === "requested").length,
    [scopedAppointments]
  );

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />

      <main className="mx-auto max-w-6xl px-6 pb-10 pt-28">
        <section className="rounded-[2rem] bg-gradient-to-r from-slate-900 via-cyan-800 to-sky-600 p-8 text-white shadow-xl">
          <p className="text-sm font-semibold uppercase tracking-[0.25em] text-white/75">Caregiver Appointments</p>
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
              onChange={(event) => {
                const nextId = event.target.value;
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

        {error ? (
          <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        ) : null}

        {loading ? (
          <section className="mt-6 rounded-3xl border border-slate-200 bg-white p-8 text-sm text-slate-500 shadow-sm">
            Loading caregiver appointments...
          </section>
        ) : linkedPatients.length === 0 ? (
          <section className="mt-6 rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
            <h2 className="text-xl font-semibold text-slate-900">No linked patients yet</h2>
            <p className="mt-2 text-sm text-slate-600">
              Accept a patient invitation first to unlock appointment visibility in caregiver mode.
            </p>
            <button
              type="button"
              onClick={() => navigate("/caregiver-patients")}
              className="mt-5 rounded-2xl bg-cyan-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-cyan-600"
            >
              Open patient invitations
            </button>
          </section>
        ) : !canViewAppointments ? (
          <section className="mt-6 rounded-3xl border border-amber-200 bg-amber-50 p-8 shadow-sm">
            <h2 className="text-xl font-semibold text-amber-900">Appointments are not enabled</h2>
            <p className="mt-2 text-sm text-amber-800">
              This patient has not granted appointment visibility for your caregiver role in the current context.
            </p>
            <button
              type="button"
              onClick={() => navigate("/caregiver-patients")}
              className="mt-5 rounded-2xl border border-amber-300 bg-white px-4 py-2 text-sm font-semibold text-amber-800 transition hover:bg-amber-100"
            >
              Review patient permissions
            </button>
          </section>
        ) : (
          <>
            <section className="mt-6 grid gap-4 sm:grid-cols-3">
              <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Total in scope</p>
                <p className="mt-2 text-3xl font-black text-slate-900">{scopedAppointments.length}</p>
                <p className="mt-1 text-sm text-slate-500">Across all statuses</p>
              </div>
              <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Upcoming</p>
                <p className="mt-2 text-3xl font-black text-slate-900">{upcomingAppointments.length}</p>
                <p className="mt-1 text-sm text-slate-500">Future visits and requests</p>
              </div>
              <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Requested</p>
                <p className="mt-2 text-3xl font-black text-slate-900">{requestedCount}</p>
                <p className="mt-1 text-sm text-slate-500">Pending scheduling decisions</p>
              </div>
            </section>

            <section className="mt-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-xl font-semibold text-slate-900">Upcoming appointments</h2>
                  <p className="mt-1 text-sm text-slate-500">What is scheduled next for this patient.</p>
                </div>
              </div>

              <div className="mt-5 space-y-3">
                {upcomingAppointments.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-slate-200 px-6 py-8 text-center text-sm text-slate-500">
                    No upcoming appointments in this patient context.
                  </div>
                ) : (
                  upcomingAppointments.map((appointment) => {
                    const dateTime = formatDateTimeParts(appointment.startsAt);
                    return (
                      <article key={appointment.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                          <div>
                            <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">{dateTime.date}</p>
                            <p className="mt-1 text-lg font-semibold text-slate-900">{dateTime.time}</p>
                            <p className="mt-1 text-sm text-slate-600">With {doctorLabel(appointment)}</p>
                            {appointment.location ? (
                              <p className="mt-1 text-sm text-slate-500">Location: {appointment.location}</p>
                            ) : null}
                          </div>
                          <span className={`h-fit rounded-full px-3 py-1 text-xs font-semibold ${statusClass(appointment.status)}`}>
                            {statusLabel(appointment.status)}
                          </span>
                        </div>
                        {appointment.notes ? (
                          <p className="mt-3 rounded-xl bg-white px-3 py-2 text-sm text-slate-600">
                            {appointment.notes}
                          </p>
                        ) : null}
                      </article>
                    );
                  })
                )}
              </div>
            </section>

            <section className="mt-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-xl font-semibold text-slate-900">Recent history</h2>
              <p className="mt-1 text-sm text-slate-500">Completed or past appointment records for reference.</p>

              <div className="mt-5 space-y-3">
                {pastAppointments.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-slate-200 px-6 py-8 text-center text-sm text-slate-500">
                    No past appointments found.
                  </div>
                ) : (
                  pastAppointments.slice(0, 8).map((appointment) => {
                    const dateTime = formatDateTimeParts(appointment.startsAt);
                    return (
                      <article key={appointment.id} className="rounded-2xl border border-slate-200 p-4">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div>
                            <p className="font-medium text-slate-900">{dateTime.date} at {dateTime.time}</p>
                            <p className="text-sm text-slate-500">With {doctorLabel(appointment)}</p>
                          </div>
                          <span className={`rounded-full px-3 py-1 text-xs font-semibold ${statusClass(appointment.status)}`}>
                            {statusLabel(appointment.status)}
                          </span>
                        </div>
                      </article>
                    );
                  })
                )}
              </div>
            </section>
          </>
        )}
      </main>
    </div>
  );
}
