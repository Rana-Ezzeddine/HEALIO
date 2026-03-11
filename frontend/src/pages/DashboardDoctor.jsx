import { useEffect, useMemo, useState } from "react";
import Navbar from "../components/Navbar";
import { apiUrl, authHeaders, getUser } from "../api/http";
import {
  createAppointment,
  getDoctorAvailability,
  getDoctorSchedule,
} from "../api/appointments";
import { getConversations } from "../api/messaging";

function DashboardCard({ title, mainText, subText }) {
  return (
    <div className="group bg-white shadow-lg p-4 rounded-2xl">
      <div className="flex justify-between items-start">
        <div>
          <h3 className="text-slate-500 text-sm">{title}</h3>
          <p className="text-slate-800 font-bold text-2xl">{mainText}</p>
          {subText && <p className="text-sky-600 font-medium text-sm mt-1">{subText}</p>}
        </div>
      </div>
    </div>
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
  const user = getUser();
  const greetingName = user?.firstName || localStorage.getItem("firstName") || user?.email || "Doctor";
  const [scheduleLoading, setScheduleLoading] = useState(true);
  const [scheduleError, setScheduleError] = useState("");
  const [schedule, setSchedule] = useState([]);
  const [assignedPatients, setAssignedPatients] = useState([]);
  const [conversationCount, setConversationCount] = useState(0);
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

  async function loadDashboard() {
    setScheduleLoading(true);
    setScheduleError("");

    try {
      const [scheduleData, overviewData, conversationsData] = await Promise.all([
        getDoctorSchedule({
          from: startOfToday().toISOString(),
          to: endOfToday().toISOString(),
        }),
        fetchAssignedPatients(),
        getConversations(),
      ]);

      setSchedule(scheduleData.appointments || []);
      setAssignedPatients(overviewData.assignedPatients || []);
      setConversationCount((conversationsData.conversations || []).length);
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

      <main className="pt-28 max-w-6xl mx-auto px-6 py-8">
        <div className="mb-6">
          <h1 className="text-3xl text-slate-800 font-bold">
            Welcome Back, {greetingName}
          </h1>
          <p className="text-slate-500 mt-1">Here is the current view of your schedule and patient activity</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-8">
          <DashboardCard
            title="Today's Appointments"
            mainText={`${todayAppointments.length} appointments`}
            subText={nextAppointmentSubText}
          />
          <DashboardCard
            title="Conversations"
            mainText={`${conversationCount}`}
            subText="Secure patient chats"
          />
          <DashboardCard
            title="Assigned Patients"
            mainText={`${assignedPatients.length}`}
            subText="Active doctor-patient links"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <section className="md:col-span-2 bg-white rounded-3xl shadow p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-slate-800">Today's Schedule</h2>
              <button
                onClick={loadDashboard}
                className="text-sm px-3 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700"
              >
                Refresh
              </button>
            </div>

            {scheduleError && (
              <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {scheduleError}
              </div>
            )}

            <div className="overflow-x-auto">
              <table className="min-h-full text-sm text-left w-full">
                <thead className="text-slate-500 border-b">
                  <tr>
                    <th className="py-3 px-4">Time</th>
                    <th className="py-3 px-4">Patient</th>
                    <th className="py-3 px-4">Location</th>
                    <th className="py-3 px-4">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {scheduleLoading ? (
                    <tr>
                      <td className="py-3 px-4 text-slate-500" colSpan={4}>
                        Loading schedule...
                      </td>
                    </tr>
                  ) : todayAppointments.length > 0 ? (
                    todayAppointments.map((appointment) => (
                      <tr key={appointment.id} className="hover:bg-slate-50">
                        <td className="py-3 px-4">{formatTime(appointment.startsAt)}</td>
                        <td className="py-3 px-4 font-medium">
                          {patientNameById.get(appointment.patientId) || appointment.patient?.email || "Patient"}
                        </td>
                        <td className="py-3 px-4">{appointment.location || "-"}</td>
                        <td className="py-3 px-4">
                          <span className={`px-2 py-1 text-xs rounded-full ${statusClasses(appointment.status)}`}>
                            {statusLabel(appointment.status)}
                          </span>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td className="py-3 px-4 text-slate-500" colSpan={4}>
                        No appointments for today.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <aside className="bg-white rounded-3xl shadow p-6">
            <h2 className="text-lg font-semibold text-slate-800 mb-4">Doctor Tools</h2>

            <div className="flex flex-col gap-3">
              <button
                onClick={() => {
                  setCreateError("");
                  setShowScheduleForm((current) => !current);
                }}
                className="w-full px-4 py-2 rounded-xl bg-emerald-100 text-emerald-700 font-medium hover:bg-emerald-200 transition"
              >
                Schedule Appointment
              </button>
              <button className="w-full px-4 py-2 rounded-xl bg-cyan-100 text-cyan-700 font-medium">
                Assigned Patients: {assignedPatients.length}
              </button>
            </div>

            {showScheduleForm && (
              <form onSubmit={submitSchedule} className="mt-4 space-y-3 border-t pt-4">
                <h3 className="font-semibold text-slate-800 text-sm">Create Appointment</h3>

                <select
                  value={form.patientId}
                  onChange={(event) => setForm((current) => ({ ...current, patientId: event.target.value }))}
                  className="w-full border rounded-lg px-3 py-2 text-sm"
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
                  className="w-full border rounded-lg px-3 py-2 text-sm"
                  required
                />

                <select
                  value={form.duration}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, duration: event.target.value, timeSlot: "" }))
                  }
                  className="w-full border rounded-lg px-3 py-2 text-sm"
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
                  className="w-full border rounded-lg px-3 py-2 text-sm"
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
                  className="w-full border rounded-lg px-3 py-2 text-sm"
                  placeholder="Clinic/location"
                />

                <textarea
                  value={form.notes}
                  onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))}
                  className="w-full border rounded-lg px-3 py-2 text-sm"
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
                  className="w-full px-4 py-2 rounded-xl bg-emerald-600 text-white font-medium hover:bg-emerald-700 transition disabled:opacity-70"
                >
                  {createLoading ? "Creating..." : "Create Appointment"}
                </button>
              </form>
            )}
          </aside>
        </div>
      </main>
    </div>
  );
}
