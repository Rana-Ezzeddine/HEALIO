import { useEffect, useMemo, useState } from "react";
import Navbar from "../components/Navbar";
import { apiUrl, authHeaders } from "../api/http";

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
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function endOfToday() {
  const d = startOfToday();
  d.setDate(d.getDate() + 1);
  return d;
}

function fmtTime(dateLike) {
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

export default function DashboardDoctor() {
  const [name, setName] = useState("Doctor");
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
    for (const p of assignedPatients) {
      map.set(p.id, p.profile?.displayName || p.email || "Patient");
    }
    return map;
  }, [assignedPatients]);

  const todayAppointments = useMemo(
    () => schedule.filter((a) => a.status !== "cancelled"),
    [schedule]
  );

  const nextAppointment = useMemo(() => {
    const now = Date.now();
    return todayAppointments.find((a) => new Date(a.startsAt).getTime() >= now) || null;
  }, [todayAppointments]);

  const nextAppointmentSubText = nextAppointment
    ? `Next: ${fmtTime(nextAppointment.startsAt)} - ${
        patientNameById.get(nextAppointment.patientId) || nextAppointment.patient?.email || "Patient"
      }`
    : "No more appointments today";

  const loadSchedule = async () => {
    setScheduleLoading(true);
    setScheduleError("");

    try {
      const params = new URLSearchParams({
        from: startOfToday().toISOString(),
        to: endOfToday().toISOString(),
      });

      const res = await fetch(`${apiUrl}/api/appointments/doctor/schedule?${params}`, {
        headers: { ...authHeaders() },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || "Failed to load schedule");
      setSchedule(data.appointments || []);
    } catch (err) {
      setScheduleError(err.message || "Failed to load schedule");
    } finally {
      setScheduleLoading(false);
    }
  };

  const loadAssignedPatients = async () => {
    try {
      const res = await fetch(`${apiUrl}/api/doctors/dashboard-overview`, {
        headers: { ...authHeaders() },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || "Failed to load patients");
      setAssignedPatients(data.assignedPatients || []);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    try {
      const firstName = localStorage.getItem("firstName") || "Doctor";
      setName(firstName);
    } catch (err) {
      console.error(err);
    }

    loadSchedule();
    loadAssignedPatients();
  }, []);

  useEffect(() => {
    const loadAvailability = async () => {
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
        const dayStart = new Date(`${form.date}T00:00:00`);
        const dayEnd = new Date(dayStart);
        dayEnd.setDate(dayEnd.getDate() + 1);

        const params = new URLSearchParams({
          from: dayStart.toISOString(),
          to: dayEnd.toISOString(),
          slotMinutes: String(durationMinutes),
        });

        const res = await fetch(`${apiUrl}/api/appointments/doctor/availability?${params}`, {
          headers: { ...authHeaders() },
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.message || "Failed to load available slots");

        const now = Date.now();
        const slots = (data.slots || []).filter((slot) => new Date(slot.startsAt).getTime() > now);
        setAvailableSlots(slots);
      } catch (err) {
        setCreateError(err.message || "Failed to load available slots");
        setAvailableSlots([]);
      } finally {
        setSlotsLoading(false);
      }
    };

    loadAvailability();
  }, [form.date, form.duration, showScheduleForm]);

  async function submitSchedule(e) {
    e.preventDefault();
    setCreateError("");

    if (!form.patientId || !form.date || !form.timeSlot) {
      setCreateError("Please select patient, date, and an available time slot.");
      return;
    }

    const startsAt = new Date(form.timeSlot);
    if (Number.isNaN(startsAt.getTime())) {
      setCreateError("Invalid date/time.");
      return;
    }

    const durationMinutes = Number(form.duration || "30");
    if (!Number.isInteger(durationMinutes) || durationMinutes <= 0) {
      setCreateError("Duration must be a positive integer.");
      return;
    }

    const endsAt = new Date(startsAt.getTime() + durationMinutes * 60 * 1000);

    try {
      setCreateLoading(true);

      const dayStart = new Date(startsAt);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(dayStart);
      dayEnd.setDate(dayEnd.getDate() + 1);

      const isAvailable = availableSlots.some((slot) => {
        const slotStart = new Date(slot.startsAt).getTime();
        const slotEnd = new Date(slot.endsAt).getTime();
        return slotStart === startsAt.getTime() && slotEnd === endsAt.getTime();
      });

      if (!isAvailable) {
        setCreateError("Selected slot is not available. Pick another time.");
        return;
      }

      const createRes = await fetch(`${apiUrl}/api/appointments`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({
          patientId: form.patientId,
          startsAt: startsAt.toISOString(),
          endsAt: endsAt.toISOString(),
          location: form.location,
          notes: form.notes,
        }),
      });
      const createData = await createRes.json().catch(() => ({}));
      if (!createRes.ok) {
        throw new Error(createData.message || "Failed to create appointment");
      }

      setForm({
        patientId: "",
        date: "",
        timeSlot: "",
        duration: "30",
        location: "",
        notes: "",
      });
      setShowScheduleForm(false);
      await loadSchedule();
    } catch (err) {
      setCreateError(err.message || "Failed to create appointment");
    } finally {
      setCreateLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />

      <main className="pt-28 max-w-6xl mx-auto px-6 py-8">
        <div className="mb-6">
          <h1 className="text-3xl text-slate-800 font-bold">Welcome Back, Dr. {name} 👋</h1>
          <p className="text-slate-500 mt-1">Here's a quick overview of your health</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-8">
          <DashboardCard
            title="🗓 Today's Appointments"
            mainText={`${todayAppointments.length} appointments`}
            subText={nextAppointmentSubText}
          />
          <DashboardCard title="📩 New Messages" mainText="3 unread" />
          <DashboardCard title="⚠️ Critical Alerts" mainText="2 patients flagged" />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <section className="md:col-span-2 bg-white rounded-3xl shadow p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-slate-800">Today's Schedule</h2>
              <button
                onClick={loadSchedule}
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
              <table className="min-h-full text-sm text-left">
                <thead className="text-slate-500 border-b">
                  <tr>
                    <th className="py-3 px-4">Time</th>
                    <th className="py-3 px-4">Patient</th>
                    <th className="py-3 px-4">Visit Type</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {scheduleLoading && (
                    <tr>
                      <td className="py-3 px-4 text-slate-500" colSpan={5}>
                        Loading schedule...
                      </td>
                    </tr>
                  )}

                  {!scheduleLoading && todayAppointments.length === 0 && (
                    <tr>
                      <td className="py-3 px-4 text-slate-500" colSpan={5}>
                        No appointments for today.
                      </td>
                    </tr>
                  )}

                  {!scheduleLoading &&
                    todayAppointments.map((a) => (
                      <tr key={a.id} className="hover:bg-slate-50">
                        <td className="py-3 px-4">{fmtTime(a.startsAt)}</td>
                        <td className="py-3 px-4 font-medium">
                          {patientNameById.get(a.patientId) || a.patient?.email || "Patient"}
                        </td>
                        <td className="py-3 px-4">Consultation</td>
                        <td className="py-3 px-4">
                          <span className={`px-2 py-1 text-xs rounded-full ${statusClasses(a.status)}`}>
                            {statusLabel(a.status)}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <button className="text-slate-400 cursor-not-allowed" disabled>
                            Open
                          </button>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </section>

          <aside className="bg-white rounded-3xl shadow p-6">
            <h2 className="text-lg font-semibold text-slate-800 mb-4">Doctor Tools</h2>

            <div className="flex flex-col gap-3">
              <button className="w-full px-4 py-2 rounded-xl bg-sky-100 text-sky-700 font-medium hover:bg-sky-200 transition">
                ➕ Add Prescription
              </button>
              <button className="w-full px-4 py-2 rounded-xl bg-indigo-100 text-indigo-700 font-medium hover:bg-indigo-200 transition">
                📝 Create Medical Report
              </button>
              <button
                onClick={() => {
                  setCreateError("");
                  setShowScheduleForm((s) => !s);
                }}
                className="w-full px-4 py-2 rounded-xl bg-emerald-100 text-emerald-700 font-medium hover:bg-emerald-200 transition"
              >
                📅 Schedule Appointment
              </button>
              <button className="w-full px-4 py-2 rounded-xl bg-cyan-100 text-cyan-700 font-medium hover:bg-cyan-200 transition">
                📂 View All Patients
              </button>
            </div>

            {showScheduleForm && (
              <form onSubmit={submitSchedule} className="mt-4 space-y-3 border-t pt-4">
                <h3 className="font-semibold text-slate-800 text-sm">Create Appointment</h3>

                <select
                  value={form.patientId}
                  onChange={(e) => setForm((f) => ({ ...f, patientId: e.target.value }))}
                  className="w-full border rounded-lg px-3 py-2 text-sm"
                  required
                >
                  <option value="">Select patient</option>
                  {assignedPatients.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.profile?.displayName || p.email}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-slate-500">
                  Only your linked/assigned patients appear in this list.
                </p>
                {assignedPatients.length === 0 && (
                  <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-2 py-1">
                    No linked patients found. Link patients to your account first.
                  </p>
                )}

                <div className="grid grid-cols-1 gap-2">
                  <input
                    type="date"
                    value={form.date}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, date: e.target.value, timeSlot: "" }))
                    }
                    className="border rounded-lg px-3 py-2 text-sm"
                    required
                  />
                </div>

                <label className="text-sm text-slate-700 font-medium">Duration</label>
                <select
                  value={form.duration}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, duration: e.target.value, timeSlot: "" }))
                  }
                  className="w-full border rounded-lg px-3 py-2 text-sm"
                  required
                >
                  <option value="15">15 minutes</option>
                  <option value="30">30 minutes</option>
                  <option value="45">45 minutes</option>
                  <option value="60">60 minutes</option>
                </select>

                <label className="text-sm text-slate-700 font-medium">Available Time Slot</label>
                <select
                  value={form.timeSlot}
                  onChange={(e) => setForm((f) => ({ ...f, timeSlot: e.target.value }))}
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
                      {fmtTime(slot.startsAt)} - {fmtTime(slot.endsAt)}
                    </option>
                  ))}
                </select>

                <label className="text-sm text-slate-700 font-medium">
                  Location (optional)
                </label>
                <input
                  type="text"
                  value={form.location}
                  onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))}
                  className="w-full border rounded-lg px-3 py-2 text-sm"
                  placeholder="Clinic/location (optional)"
                />

                <textarea
                  value={form.notes}
                  onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
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
