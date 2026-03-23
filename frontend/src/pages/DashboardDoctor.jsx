import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "../components/Navbar";
import { apiUrl, authHeaders, getUser } from "../api/http";
import {
  createAppointment,
  getDoctorAvailability,
  getDoctorSchedule,
} from "../api/appointments";

function DashboardCard({ title, mainText, subText, navPage }) {
  const navigate = useNavigate();

  return (
    <button
      type="button"
      onClick={() => navigate(navPage)}
      className="group rounded-3xl bg-white p-5 text-left shadow-sm transition hover:-translate-y-1 hover:bg-slate-50 hover:shadow-md"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm text-slate-500">{title}</h3>
          <p className="mt-1 text-2xl font-bold text-slate-900">{mainText}</p>
          {subText ? <p className="mt-2 text-sm font-medium text-sky-700">{subText}</p> : null}
        </div>
        <span className="text-xs text-slate-400 transition group-hover:text-slate-600">Open</span>
      </div>
    </button>
  );
}

function startOfToday() {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date;
}

function endOfToday() {
  const date = startOfToday();
  date.setDate(date.getDate() + 1);
  return date;
}

function formatTime(dateLike) {
  return new Date(dateLike).toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });
}

function statusClasses(status) {
  if (status === "scheduled") return "bg-yellow-100 text-yellow-700";
  if (status === "completed") return "bg-green-100 text-green-700";
  if (status === "cancelled") return "bg-red-100 text-red-700";
  return "bg-slate-100 text-slate-700";
}

function statusLabel(status) {
  if (status === "scheduled") return "Upcoming";
  if (status === "completed") return "Completed";
  if (status === "cancelled") return "Cancelled";
  return status || "Unknown";
}

function patientDisplayName(patient) {
  return patient.profile?.displayName || patient.email || "Patient";
}

async function fetchAssignedPatients() {
  const response = await fetch(`${apiUrl}/api/doctors/dashboard-overview`, {
    headers: { ...authHeaders() },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.message || "Failed to load doctor overview");
  }
  return data;
}

export default function DashboardDoctor() {
  const navigate = useNavigate();
  const user = getUser();
  const greetingName = user?.firstName || user?.email || "Doctor";
  const [scheduleLoading, setScheduleLoading] = useState(true);
  const [scheduleError, setScheduleError] = useState("");
  const [schedule, setSchedule] = useState([]);
  const [assignedPatients, setAssignedPatients] = useState([]);
  const [showScheduleForm, setShowScheduleForm] = useState(false);
  const [createLoading, setCreateLoading] = useState(false);
  const [createError, setCreateError] = useState("");
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [availableSlots, setAvailableSlots] = useState([]);
  const [form, setForm] = useState({
    patientId: "",
    date: "",
    timeSlot: "",
    duration: "30",
    location: "",
    notes: "",
  });

  const patientNameById = useMemo(() => {
    const map = new Map();
    for (const patient of assignedPatients) {
      map.set(patient.id, patientDisplayName(patient));
    }
    return map;
  }, [assignedPatients]);

  const todayAppointments = useMemo(
    () => schedule.filter((appointment) => appointment.status !== "cancelled"),
    [schedule]
  );

  const nextAppointment = useMemo(() => {
    const now = Date.now();
    return todayAppointments.find((appointment) => new Date(appointment.startsAt).getTime() >= now) || null;
  }, [todayAppointments]);

  const nextAppointmentSubText = nextAppointment
    ? `Next: ${formatTime(nextAppointment.startsAt)} - ${
        patientNameById.get(nextAppointment.patientId) || nextAppointment.patient?.email || "Patient"
      }`
    : "No more appointments today";

  const upcomingAppointments = useMemo(
    () =>
      todayAppointments
        .filter((appointment) => new Date(appointment.startsAt).getTime() >= Date.now())
        .sort((left, right) => new Date(left.startsAt) - new Date(right.startsAt)),
    [todayAppointments]
  );

  const completedTodayCount = todayAppointments.filter((appointment) => appointment.status === "completed").length;

  async function loadDashboard() {
    setScheduleLoading(true);
    setScheduleError("");

    try {
      const [scheduleData, overviewData] = await Promise.all([
        getDoctorSchedule({
          from: startOfToday().toISOString(),
          to: endOfToday().toISOString(),
        }),
        fetchAssignedPatients(),
      ]);

      setSchedule(scheduleData.appointments || []);
      setAssignedPatients(overviewData.assignedPatients || []);
    } catch (err) {
      setScheduleError(err.message || "Failed to load dashboard.");
    } finally {
      setScheduleLoading(false);
    }
  }

  useEffect(() => {
    loadDashboard();
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadAvailability() {
      if (!showScheduleForm || !form.date) {
        setAvailableSlots([]);
        return;
      }

      const durationMinutes = Number(form.duration || "30");
      if (!Number.isInteger(durationMinutes) || durationMinutes <= 0) {
        setAvailableSlots([]);
        return;
      }

      try {
        setSlotsLoading(true);
        setCreateError("");

        const dayStart = new Date(`${form.date}T00:00:00`);
        const dayEnd = new Date(dayStart);
        dayEnd.setDate(dayEnd.getDate() + 1);

        const data = await getDoctorAvailability({
          from: dayStart.toISOString(),
          to: dayEnd.toISOString(),
          slotMinutes: durationMinutes,
        });

        if (!cancelled) {
          const now = Date.now();
          const slots = (data.slots || []).filter((slot) => new Date(slot.startsAt).getTime() > now);
          setAvailableSlots(slots);
        }
      } catch (err) {
        if (!cancelled) {
          setCreateError(err.message || "Failed to load available slots.");
          setAvailableSlots([]);
        }
      } finally {
        if (!cancelled) {
          setSlotsLoading(false);
        }
      }
    }

    loadAvailability();
    return () => {
      cancelled = true;
    };
  }, [form.date, form.duration, showScheduleForm]);

  async function submitSchedule(event) {
    event.preventDefault();
    setCreateError("");

    if (!form.patientId || !form.timeSlot) {
      setCreateError("Please select patient and an available time slot.");
      return;
    }

    const startsAt = new Date(form.timeSlot);
    const durationMinutes = Number(form.duration || "30");
    const endsAt = new Date(startsAt.getTime() + durationMinutes * 60 * 1000);

    const isAvailable = availableSlots.some((slot) => {
      return (
        new Date(slot.startsAt).getTime() === startsAt.getTime() &&
        new Date(slot.endsAt).getTime() === endsAt.getTime()
      );
    });

    if (!isAvailable) {
      setCreateError("Selected slot is no longer available.");
      return;
    }

    try {
      setCreateLoading(true);

      await createAppointment({
        patientId: form.patientId,
        startsAt: startsAt.toISOString(),
        endsAt: endsAt.toISOString(),
        location: form.location,
        notes: form.notes,
      });

      setForm({
        patientId: "",
        date: "",
        timeSlot: "",
        duration: "30",
        location: "",
        notes: "",
      });
      setShowScheduleForm(false);
      await loadDashboard();
    } catch (err) {
      setCreateError(err.message || "Failed to create appointment.");
    } finally {
      setCreateLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />

      <main className="mx-auto max-w-6xl px-6 pb-10 pt-28">
        <section className="rounded-[2rem] bg-gradient-to-r from-slate-900 via-sky-800 to-cyan-600 p-8 text-white shadow-xl">
          <p className="text-sm font-semibold uppercase tracking-[0.25em] text-white/75">Doctor Dashboard</p>
          <h1 className="mt-3 text-4xl font-black">Welcome back, Dr. {greetingName}</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-white/85">
            Review your day, manage appointments, and stay connected with your assigned patients from one view.
          </p>
        </section>

        <section className="mt-6 grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
          <DashboardCard
            title="Today's Appointments"
            mainText={`${todayAppointments.length} appointments`}
            subText={nextAppointmentSubText}
            navPage="/doctorAppointments"
          />
          <DashboardCard
            title="Assigned Patients"
            mainText={`${assignedPatients.length}`}
            subText="Active doctor-patient links"
            navPage="/doctor-review"
          />
          <DashboardCard
            title="Completed Today"
            mainText={`${completedTodayCount}`}
            subText="Visits closed"
            navPage="/doctorAppointments"
          />
        </section>

        <section className="mt-6 grid gap-6 lg:grid-cols-[1.3fr_0.7fr]">
          <div className="rounded-3xl bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold text-slate-900">Today's schedule</h2>
                <p className="mt-1 text-sm text-slate-500">Upcoming and active appointments are listed here.</p>
              </div>
              <button
                type="button"
                onClick={loadDashboard}
                className="rounded-2xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition"
              >
                Refresh
              </button>
            </div>

            {scheduleError && (
              <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {scheduleError}
              </div>
            )}

            <div className="mt-5 space-y-3">
              {scheduleLoading ? (
                <div className="rounded-2xl border border-dashed border-slate-200 p-6 text-sm text-slate-500">
                  Loading schedule...
                </div>
              ) : upcomingAppointments.length > 0 ? (
                upcomingAppointments.slice(0, 5).map((appointment) => (
                  <div key={appointment.id} className="rounded-2xl border border-slate-200 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="font-semibold text-slate-900">
                          {patientNameById.get(appointment.patientId) || appointment.patient?.email || "Patient"}
                        </p>
                        <p className="mt-1 text-sm text-slate-500">
                          {formatTime(appointment.startsAt)} - {formatTime(appointment.endsAt)}
                        </p>
                      </div>
                      <span className={`rounded-full px-3 py-1 text-xs font-semibold ${statusClasses(appointment.status)}`}>
                        {statusLabel(appointment.status)}
                      </span>
                    </div>
                    <p className="mt-2 text-sm text-slate-600">
                      {appointment.location || "Location pending"} | {appointment.notes || "No notes"}
                    </p>
                  </div>
                ))
              ) : (
                <div className="rounded-2xl border border-dashed border-slate-200 p-6 text-sm text-slate-500">
                  No upcoming appointments for today.
                </div>
              )}
            </div>
          </div>

          <div className="space-y-6">
            <section className="rounded-3xl bg-white p-6 shadow-sm">
              <h2 className="text-xl font-semibold text-slate-900">Quick actions</h2>

              <div className="mt-4 grid gap-3">
                {[
                  {
                    label: showScheduleForm ? "Hide schedule form" : "Schedule appointment",
                    onClick: () => {
                      setCreateError("");
                      setShowScheduleForm((current) => !current);
                    },
                    style: "bg-emerald-100 text-emerald-700",
                  },
                  { label: "Open appointments", onClick: () => navigate("/doctorAppointments"), style: "bg-sky-100 text-sky-700" },
                  { label: "Doctor profile", onClick: () => navigate("/profileDoctor"), style: "bg-indigo-100 text-indigo-700" },
                ].map((action) => (
                  <button
                    key={action.label}
                    type="button"
                    onClick={action.onClick}
                    className={`rounded-2xl px-4 py-3 text-left text-sm font-semibold transition hover:opacity-85 ${action.style}`}
                  >
                    {action.label}
                  </button>
                ))}
              </div>
            </section>

            <section className="rounded-3xl bg-white p-6 shadow-sm">
              <h2 className="text-xl font-semibold text-slate-900">Doctor summary</h2>
              <div className="mt-4 space-y-3 text-sm text-slate-600">
                <p>Assigned patients: <span className="font-semibold text-slate-900">{assignedPatients.length}</span></p>
                <p>Appointments today: <span className="font-semibold text-slate-900">{todayAppointments.length}</span></p>
                <p>Completed today: <span className="font-semibold text-slate-900">{completedTodayCount}</span></p>
              </div>
            </section>

            {showScheduleForm && (
              <section className="rounded-3xl bg-white p-6 shadow-sm">
                <form onSubmit={submitSchedule} className="space-y-3">
                  <h3 className="text-lg font-semibold text-slate-900">Create appointment</h3>

                <select
                  value={form.patientId}
                  onChange={(event) => setForm((current) => ({ ...current, patientId: event.target.value }))}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  required
                >
                  <option value="">Select patient</option>
                  {assignedPatients.map((patient) => (
                    <option key={patient.id} value={patient.id}>
                      {patientDisplayName(patient)}
                    </option>
                  ))}
                </select>

                <input
                  type="date"
                  value={form.date}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, date: event.target.value, timeSlot: "" }))
                  }
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  required
                />

                <select
                  value={form.duration}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, duration: event.target.value, timeSlot: "" }))
                  }
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  required
                >
                  <option value="15">15 minutes</option>
                  <option value="30">30 minutes</option>
                  <option value="45">45 minutes</option>
                  <option value="60">60 minutes</option>
                </select>

                <select
                  value={form.timeSlot}
                  onChange={(event) => setForm((current) => ({ ...current, timeSlot: event.target.value }))}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  required
                  disabled={!form.date || slotsLoading}
                >
                  <option value="">
                    {!form.date
                      ? "Select date first"
                      : slotsLoading
                      ? "Loading available slots..."
                      : availableSlots.length === 0
                      ? "No available slots"
                      : "Select available time"}
                  </option>
                  {availableSlots.map((slot) => (
                    <option key={slot.startsAt} value={slot.startsAt}>
                      {formatTime(slot.startsAt)} - {formatTime(slot.endsAt)}
                    </option>
                  ))}
                </select>

                <input
                  type="text"
                  value={form.location}
                  onChange={(event) => setForm((current) => ({ ...current, location: event.target.value }))}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  placeholder="Clinic/location"
                />

                <textarea
                  value={form.notes}
                  onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  placeholder="Notes"
                  rows={3}
                />

                {createError && (
                  <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                    {createError}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={createLoading || assignedPatients.length === 0}
                  className="w-full rounded-xl bg-emerald-600 px-4 py-2 text-white font-medium transition hover:bg-emerald-700 disabled:opacity-70"
                >
                  {createLoading ? "Creating..." : "Create Appointment"}
                </button>
                </form>
              </section>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
