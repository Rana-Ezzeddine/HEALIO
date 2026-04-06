import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "../components/Navbar";
import { apiUrl, authHeaders, getUser } from "../api/http";
import { getDoctorSchedule } from "../api/appointments";

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
  const [overviewSummary, setOverviewSummary] = useState({ totalAppointmentsCreated: 0 });

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

  const upcomingAppointments = useMemo(
    () =>
      todayAppointments
        .filter((appointment) => new Date(appointment.startsAt).getTime() >= Date.now())
        .sort((left, right) => new Date(left.startsAt) - new Date(right.startsAt)),
    [todayAppointments]
  );

  const completedTodayCount = todayAppointments.filter((appointment) => appointment.status === "completed").length;
  const doctorChecklist = useMemo(() => {
    const tasks = [
      {
        key: "profile",
        label: "Complete doctor profile",
        description: "Add your professional details so patients can identify your practice.",
        href: "/profileDoctor",
        done: Boolean(user?.firstName && user?.lastName),
      },
      {
        key: "patients",
        label: "Review patient invitations",
        description: "Approve your first patient so appointment workflows can begin.",
        href: "/doctor-patients",
        done: assignedPatients.length > 0,
      },
      {
        key: "appointments",
        label: "Create first appointment",
        description: "Schedule a first visit to activate your daily schedule workflow.",
        href: "/doctorAppointments",
        done: (overviewSummary?.totalAppointmentsCreated || 0) > 0,
      },
    ];

    const doneCount = tasks.filter((task) => task.done).length;
    return {
      tasks,
      doneCount,
      totalCount: tasks.length,
      incomplete: doneCount < tasks.length,
      nextTask: tasks.find((task) => !task.done) || null,
    };
  }, [assignedPatients.length, overviewSummary?.totalAppointmentsCreated, user?.firstName, user?.lastName]);

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
      setOverviewSummary(overviewData.summary || { totalAppointmentsCreated: 0 });
    } catch (err) {
      setScheduleError(err.message || "Failed to load dashboard.");
    } finally {
      setScheduleLoading(false);
    }
  }

  useEffect(() => {
    loadDashboard();
  }, []);

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />

      <main className="mx-auto max-w-6xl px-6 pb-10 pt-28">
        <section className="rounded-[2rem] bg-gradient-to-r from-slate-900 via-sky-800 to-cyan-600 p-8 text-white shadow-xl">
          <div>
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.25em] text-white/75">Doctor Dashboard</p>
              <h1 className="mt-3 text-4xl font-black">Welcome back, Dr. {greetingName}</h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-white/85">
                Review your day, manage appointments, and stay connected with your assigned patients from one view.
              </p>
            </div>
          </div>
        </section>

        {doctorChecklist.incomplete ? (
          <section className="mt-6 overflow-hidden rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <p className="text-sm font-semibold uppercase tracking-wide text-sky-700">Doctor setup checklist</p>
                <h2 className="mt-2 text-2xl font-semibold text-slate-900">
                  {doctorChecklist.doneCount} of {doctorChecklist.totalCount} setup steps complete
                </h2>
                <p className="mt-2 text-sm text-slate-600">
                  Finish these essentials to unlock smoother patient intake and scheduling.
                </p>
                <div className="mt-4 h-2.5 w-full max-w-md overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full rounded-full bg-sky-500"
                    style={{ width: `${(doctorChecklist.doneCount / doctorChecklist.totalCount) * 100}%` }}
                  />
                </div>
              </div>
              <button
                type="button"
                onClick={() => navigate(doctorChecklist.nextTask?.href || "/doctorAppointments")}
                className="rounded-2xl bg-sky-500 px-4 py-3 text-sm font-semibold text-white hover:bg-sky-600 transition"
              >
                Continue setup
              </button>
            </div>

            <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {doctorChecklist.tasks.map((task) => (
                <button
                  key={task.key}
                  type="button"
                  onClick={() => navigate(task.href)}
                  className={`rounded-2xl border p-4 text-left transition ${
                    task.done
                      ? "border-emerald-200 bg-emerald-50"
                      : "border-slate-200 bg-white/90 hover:border-sky-200 hover:bg-sky-50"
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-semibold text-slate-900">{task.label}</p>
                    <span className={`rounded-full px-2 py-1 text-xs font-semibold ${task.done ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
                      {task.done ? "Done" : "Next"}
                    </span>
                  </div>
                  <p className="mt-2 text-sm text-slate-600">{task.description}</p>
                </button>
              ))}
            </div>
          </section>
        ) : null}

        <section className="mt-6 grid gap-4 sm:grid-cols-3">
          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">Assigned patients</p>
            <p className="mt-2 text-3xl font-black text-slate-900">{assignedPatients.length}</p>
            <p className="mt-1 text-sm text-slate-500">Active doctor-patient links</p>
          </div>
          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">Appointments today</p>
            <p className="mt-2 text-3xl font-black text-slate-900">{todayAppointments.length}</p>
            <p className="mt-1 text-sm text-slate-500">Scheduled and completed visits</p>
          </div>
          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">Pending requests</p>
            <p className="mt-2 text-3xl font-black text-slate-900">{overviewSummary?.pendingPatientRequestsCount || 0}</p>
            <p className="mt-1 text-sm text-slate-500">Patients waiting for approval</p>
          </div>
        </section>

        <section className="mt-6 grid gap-6 lg:grid-cols-2">
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold text-slate-900">Upcoming appointments</h2>
                <p className="mt-1 text-sm text-slate-500">A quick view of what is next. Open appointments for full details.</p>
              </div>
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                  {upcomingAppointments.length} left today
                </span>
                <button
                  type="button"
                  onClick={loadDashboard}
                  className="rounded-2xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition"
                >
                  Refresh
                </button>
              </div>
            </div>

            {scheduleError && (
              <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {scheduleError}
              </div>
            )}

            <div className="mt-5 space-y-2">
              {scheduleLoading ? (
                <div className="rounded-2xl border border-dashed border-slate-200 p-4 text-sm text-slate-500">
                  Loading schedule...
                </div>
              ) : upcomingAppointments.length > 0 ? (
                <>
                  {upcomingAppointments.slice(0, 3).map((appointment) => (
                    <div key={appointment.id} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="font-semibold text-slate-900">
                            {patientNameById.get(appointment.patientId) || appointment.patient?.email || "Patient"}
                          </p>
                          <p className="mt-1 text-sm text-slate-500">
                            {formatTime(appointment.startsAt)} - {formatTime(appointment.endsAt)}
                            {appointment.location ? ` | ${appointment.location}` : " | Location pending"}
                          </p>
                        </div>
                        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${statusClasses(appointment.status)}`}>
                          {statusLabel(appointment.status)}
                        </span>
                      </div>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() => navigate("/doctorAppointments")}
                    className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition"
                  >
                    View full appointment list
                  </button>
                </>
              ) : (
                <div className="rounded-2xl border border-dashed border-slate-200 p-4 text-sm text-slate-500">
                  No upcoming appointments for today.
                  <div className="mt-4 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => navigate("/doctorAppointments#schedule-patient")}
                      className="rounded-xl bg-emerald-100 px-3 py-2 text-xs font-semibold text-emerald-700 hover:bg-emerald-200 transition"
                    >
                      Create appointment
                    </button>
                    <button
                      type="button"
                      onClick={() => navigate("/doctor-patients")}
                      className="rounded-xl bg-sky-100 px-3 py-2 text-xs font-semibold text-sky-700 hover:bg-sky-200 transition"
                    >
                      Review patients
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="space-y-6">
            <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-xl font-semibold text-slate-900">Quick actions</h2>

              <div className="mt-4 grid gap-3">
                {[
                  {
                    label: "Schedule appointment",
                    onClick: () => navigate("/doctorAppointments#schedule-patient"),
                    style: "bg-emerald-100 text-emerald-700",
                  },
                  { label: "Open appointments", onClick: () => navigate("/doctorAppointments"), style: "bg-sky-100 text-sky-700" },
                  { label: "Open calendar", onClick: () => navigate("/doctor-calendar"), style: "bg-violet-100 text-violet-700" },
                  { label: "Doctor patients", onClick: () => navigate("/doctor-patients"), style: "bg-cyan-100 text-cyan-700" },
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

          </div>
        </section>
      </main>
    </div>
  );
}
