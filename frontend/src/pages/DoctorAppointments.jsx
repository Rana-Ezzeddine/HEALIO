import { useEffect, useMemo, useState } from "react";
import Navbar from "../components/Navbar";
import {
  createAppointment,
  getDoctorAvailability,
  getMyAppointments,
  reviewAppointmentRequest,
  updateAppointmentStatus,
} from "../api/appointments";
import { apiUrl, authHeaders } from "../api/http";

const weekDays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function toDateKey(dateLike) {
  const date = new Date(dateLike);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatTime(dateLike) {
  return new Date(dateLike).toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatDateLabel(dateKey) {
  return new Date(`${dateKey}T00:00:00`).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function statusClass(status) {
  if (status === "requested") return "bg-amber-100 text-amber-700";
  if (status === "scheduled") return "bg-emerald-100 text-emerald-700";
  if (status === "completed") return "bg-sky-100 text-sky-700";
  if (status === "cancelled") return "bg-slate-200 text-slate-700";
  if (status === "denied") return "bg-rose-100 text-rose-700";
  return "bg-slate-100 text-slate-700";
}

function statusLabel(status) {
  if (status === "requested") return "Requested";
  if (status === "scheduled") return "Scheduled";
  if (status === "completed") return "Completed";
  if (status === "cancelled") return "Cancelled";
  if (status === "denied") return "Denied";
  return status || "Unknown";
}

function patientLabel(patientRecord) {
  return patientRecord.profile?.displayName || patientRecord.patient?.email || patientRecord.email || "Patient";
}

async function fetchAssignedPatients() {
  const response = await fetch(`${apiUrl}/api/doctors/assigned-patients`, {
    headers: { ...authHeaders() },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.message || "Failed to load assigned patients");
  }
  return data;
}

export default function DoctorAppointments() {
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [assignedPatients, setAssignedPatients] = useState([]);
  const [selectedDateKey, setSelectedDateKey] = useState(toDateKey(new Date()));
  const [visibleMonth, setVisibleMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [createLoading, setCreateLoading] = useState(false);
  const [createError, setCreateError] = useState("");
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [availableSlots, setAvailableSlots] = useState([]);
  const [statusLoadingId, setStatusLoadingId] = useState("");
  const [decisionNotes, setDecisionNotes] = useState({});
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
    for (const record of assignedPatients) {
      const patient = record.patient || record;
      map.set(patient.id, patientLabel(record));
    }
    return map;
  }, [assignedPatients]);

  async function loadPageData() {
    setLoading(true);
    setError("");

    try {
      const [appointmentsData, patientsData] = await Promise.all([
        getMyAppointments(),
        fetchAssignedPatients(),
      ]);

      setAppointments(appointmentsData.appointments || []);
      setAssignedPatients(patientsData.patients || []);
    } catch (err) {
      setError(err.message || "Failed to load appointments.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadPageData();
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadAvailability() {
      if (!form.date) {
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
          setAvailableSlots([]);
          setCreateError(err.message || "Failed to load availability.");
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
  }, [form.date, form.duration]);

  const requestedAppointments = useMemo(() => {
    return appointments
      .filter((appointment) => appointment.status === "requested")
      .sort((left, right) => new Date(left.startsAt) - new Date(right.startsAt));
  }, [appointments]);

  const scheduledCount = useMemo(
    () => appointments.filter((appointment) => appointment.status === "scheduled").length,
    [appointments]
  );

  const completedCount = useMemo(
    () => appointments.filter((appointment) => appointment.status === "completed").length,
    [appointments]
  );

  const cancelledCount = useMemo(
    () => appointments.filter((appointment) => appointment.status === "cancelled").length,
    [appointments]
  );

  const selectedAppointments = useMemo(() => {
    return appointments
      .filter((appointment) => toDateKey(appointment.startsAt) === selectedDateKey)
      .sort((left, right) => new Date(left.startsAt) - new Date(right.startsAt));
  }, [appointments, selectedDateKey]);

  const appointmentCountsByDate = useMemo(() => {
    return appointments.reduce((accumulator, appointment) => {
      const dateKey = toDateKey(appointment.startsAt);
      accumulator[dateKey] = (accumulator[dateKey] || 0) + 1;
      return accumulator;
    }, {});
  }, [appointments]);

  const monthDays = useMemo(() => {
    const year = visibleMonth.getFullYear();
    const month = visibleMonth.getMonth();
    const firstDayIndex = new Date(year, month, 1).getDay();
    const startDate = new Date(year, month, 1 - firstDayIndex);

    return Array.from({ length: 42 }, (_, index) => {
      const date = new Date(startDate);
      date.setDate(startDate.getDate() + index);

      return {
        date,
        dateKey: toDateKey(date),
        inCurrentMonth: date.getMonth() === month,
      };
    });
  }, [visibleMonth]);

  async function handleScheduleAppointment(event) {
    event.preventDefault();
    setCreateError("");

    if (!form.patientId || !form.timeSlot) {
      setCreateError("Select a patient and an available time slot.");
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
      setAvailableSlots([]);
      await loadPageData();
      setSelectedDateKey(toDateKey(startsAt));
      setVisibleMonth(new Date(startsAt.getFullYear(), startsAt.getMonth(), 1));
    } catch (err) {
      setCreateError(err.message || "Failed to create appointment.");
    } finally {
      setCreateLoading(false);
    }
  }

  async function handleStatusChange(appointmentId, status) {
    try {
      setStatusLoadingId(appointmentId);
      await updateAppointmentStatus(appointmentId, status);
      await loadPageData();
    } catch (err) {
      setError(err.message || "Failed to update appointment status.");
    } finally {
      setStatusLoadingId("");
    }
  }

  async function handleReviewRequest(appointmentId, status) {
    try {
      setStatusLoadingId(appointmentId);
      await reviewAppointmentRequest(appointmentId, status, decisionNotes[appointmentId] || "");
      setDecisionNotes((current) => ({ ...current, [appointmentId]: "" }));
      await loadPageData();
    } catch (err) {
      setError(err.message || "Failed to review appointment request.");
    } finally {
      setStatusLoadingId("");
    }
  }

  function changeMonth(direction) {
    setVisibleMonth(
      (previousMonth) => new Date(previousMonth.getFullYear(), previousMonth.getMonth() + direction, 1)
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />

      <main className="pt-28 max-w-6xl mx-auto px-6 py-8">
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl text-slate-800 font-bold">Appointments</h1>
            <p className="text-slate-500 mt-1">
              Review patient appointment requests, schedule visits, and manage appointment status updates.
            </p>
          </div>
          <div className="flex gap-3">
            <div className="rounded-2xl bg-white border border-slate-200 px-4 py-3 text-right">
              <p className="text-xs text-slate-500">Requests</p>
              <p className="text-2xl font-bold text-slate-800">{requestedAppointments.length}</p>
            </div>
            <div className="rounded-2xl bg-white border border-slate-200 px-4 py-3 text-right">
              <p className="text-xs text-slate-500">Scheduled</p>
              <p className="text-2xl font-bold text-slate-800">{scheduledCount}</p>
            </div>
            <div className="rounded-2xl bg-white border border-slate-200 px-4 py-3 text-right">
              <p className="text-xs text-slate-500">Completed</p>
              <p className="text-2xl font-bold text-slate-800">{completedCount}</p>
            </div>
            <div className="rounded-2xl bg-white border border-slate-200 px-4 py-3 text-right">
              <p className="text-xs text-slate-500">Cancelled</p>
              <p className="text-2xl font-bold text-slate-800">{cancelledCount}</p>
            </div>
          </div>
        </div>

        {error && (
          <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <section className="bg-white rounded-3xl shadow p-6 mb-6">
          <h2 className="text-xl font-semibold text-slate-800 mb-4">Patient Requests</h2>

          <div className="overflow-x-auto">
            <table className="min-h-full text-sm text-left w-full">
              <thead className="text-slate-500 border-b">
                <tr>
                  <th className="py-3 px-4">Patient</th>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Time</th>
                  <th className="py-3 px-4">Location</th>
                  <th className="py-3 px-4">Patient Note</th>
                  <th className="py-3 px-4">Decision Note</th>
                  <th className="py-3 px-4">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr>
                    <td colSpan={7} className="py-6 px-4 text-center text-slate-500">
                      Loading requests...
                    </td>
                  </tr>
                ) : requestedAppointments.length > 0 ? (
                  requestedAppointments.map((appointment) => (
                    <tr key={appointment.id} className="hover:bg-slate-50">
                      <td className="py-3 px-4 text-slate-800 font-medium">
                        {patientNameById.get(appointment.patient?.id || appointment.patientId) ||
                          appointment.patient?.email ||
                          "Patient"}
                      </td>
                      <td className="py-3 px-4 text-slate-700">
                        {new Date(appointment.startsAt).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </td>
                      <td className="py-3 px-4 text-slate-700">{formatTime(appointment.startsAt)}</td>
                      <td className="py-3 px-4 text-slate-600">{appointment.location || "-"}</td>
                      <td className="py-3 px-4 text-slate-600">{appointment.notes || "-"}</td>
                      <td className="py-3 px-4">
                        <input
                          type="text"
                          value={decisionNotes[appointment.id] || ""}
                          onChange={(event) =>
                            setDecisionNotes((current) => ({
                              ...current,
                              [appointment.id]: event.target.value,
                            }))
                          }
                          placeholder="Optional note"
                          className="w-52 rounded-lg border border-slate-300 px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-sky-500"
                        />
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex gap-2">
                          <button
                            type="button"
                            disabled={statusLoadingId === appointment.id}
                            onClick={() => handleReviewRequest(appointment.id, "scheduled")}
                            className="rounded-lg bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-600 disabled:opacity-70"
                          >
                            Approve
                          </button>
                          <button
                            type="button"
                            disabled={statusLoadingId === appointment.id}
                            onClick={() => handleReviewRequest(appointment.id, "denied")}
                            className="rounded-lg bg-rose-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-rose-600 disabled:opacity-70"
                          >
                            Deny
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={7} className="py-6 px-4 text-center text-slate-500">
                      No pending requests.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="bg-white rounded-3xl shadow p-6 mb-6">
          <h2 className="text-xl font-semibold text-slate-800 mb-1">Schedule For Assigned Patient</h2>
          <p className="text-sm text-slate-500 mb-4">
            Available time slots come from the backend availability endpoint for the selected day.
          </p>

          <form onSubmit={handleScheduleAppointment} className="grid grid-cols-1 md:grid-cols-6 gap-3">
            <select
              value={form.patientId}
              onChange={(event) => setForm((current) => ({ ...current, patientId: event.target.value }))}
              className="rounded-xl border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
              required
            >
              <option value="">Select patient</option>
              {assignedPatients.map((record) => {
                const patient = record.patient || record;
                return (
                  <option key={patient.id} value={patient.id}>
                    {patientLabel(record)}
                  </option>
                );
              })}
            </select>

            <input
              type="date"
              value={form.date}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  date: event.target.value,
                  timeSlot: "",
                }))
              }
              className="rounded-xl border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
              required
            />

            <select
              value={form.duration}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  duration: event.target.value,
                  timeSlot: "",
                }))
              }
              className="rounded-xl border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
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
              className="rounded-xl border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
              required
              disabled={!form.date || slotsLoading}
            >
              <option value="">
                {!form.date
                  ? "Select date first"
                  : slotsLoading
                  ? "Loading slots..."
                  : availableSlots.length === 0
                  ? "No available slots"
                  : "Select slot"}
              </option>
              {availableSlots.map((slot) => (
                <option key={slot.startsAt} value={slot.startsAt}>
                  {formatTime(slot.startsAt)} - {formatTime(slot.endsAt)}
                </option>
              ))}
            </select>

            <input
              type="text"
              placeholder="Location"
              value={form.location}
              onChange={(event) => setForm((current) => ({ ...current, location: event.target.value }))}
              className="rounded-xl border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
            />

            <button
              type="submit"
              disabled={createLoading || assignedPatients.length === 0}
              className="rounded-xl bg-sky-500 px-4 py-2 text-sm font-medium text-white hover:bg-sky-600 transition disabled:opacity-70"
            >
              {createLoading ? "Scheduling..." : "Schedule"}
            </button>

            <textarea
              value={form.notes}
              onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))}
              className="md:col-span-6 rounded-xl border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
              rows={3}
              placeholder="Notes for the visit"
            />
          </form>

          {assignedPatients.length === 0 && (
            <p className="mt-3 text-sm text-amber-700">
              No active patient assignments were found for this doctor account.
            </p>
          )}

          {createError && (
            <div className="mt-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {createError}
            </div>
          )}
        </section>

        <section className="bg-white rounded-3xl shadow p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-xl font-semibold text-slate-800 mb-1">Appointments For {formatDateLabel(selectedDateKey)}</h2>
              <p className="text-sm text-slate-500">Select a date in the calendar to review and update statuses.</p>
            </div>
            <button
              type="button"
              onClick={loadPageData}
              className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition"
            >
              Refresh
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="min-h-full text-sm text-left w-full">
              <thead className="text-slate-500 border-b">
                <tr>
                  <th className="py-3 px-4">Time</th>
                  <th className="py-3 px-4">Patient</th>
                  <th className="py-3 px-4">Location</th>
                  <th className="py-3 px-4">Notes</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr>
                    <td colSpan={6} className="py-6 px-4 text-center text-slate-500">
                      Loading appointments...
                    </td>
                  </tr>
                ) : selectedAppointments.length > 0 ? (
                  selectedAppointments.map((appointment) => (
                    <tr key={appointment.id} className="hover:bg-slate-50">
                      <td className="py-3 px-4 text-slate-700 font-medium">{formatTime(appointment.startsAt)}</td>
                      <td className="py-3 px-4 text-slate-800">
                        {patientNameById.get(appointment.patient?.id || appointment.patientId) ||
                          appointment.patient?.displayName ||
                          appointment.patient?.email ||
                          "Patient"}
                      </td>
                      <td className="py-3 px-4 text-slate-600">{appointment.location || "-"}</td>
                      <td className="py-3 px-4 text-slate-600">{appointment.notes || "-"}</td>
                      <td className="py-3 px-4">
                        <span className={`px-2 py-1 text-xs rounded-full ${statusClass(appointment.status)}`}>
                          {statusLabel(appointment.status)}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        {appointment.status === "scheduled" ? (
                          <div className="flex gap-2">
                            <button
                              type="button"
                              disabled={statusLoadingId === appointment.id}
                              onClick={() => handleStatusChange(appointment.id, "completed")}
                              className="rounded-lg bg-sky-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-sky-600 disabled:opacity-70"
                            >
                              Complete
                            </button>
                            <button
                              type="button"
                              disabled={statusLoadingId === appointment.id}
                              onClick={() => handleStatusChange(appointment.id, "cancelled")}
                              className="rounded-lg bg-rose-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-rose-600 disabled:opacity-70"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <span className="text-xs text-slate-400">No action</span>
                        )}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="py-6 px-4 text-center text-slate-500">
                      No appointments found for this date.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="bg-white rounded-3xl shadow p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-slate-800">
              {visibleMonth.toLocaleString("en-US", { month: "long", year: "numeric" })}
            </h2>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => changeMonth(-1)}
                className="rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 transition"
              >
                Prev
              </button>
              <button
                type="button"
                onClick={() => changeMonth(1)}
                className="rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 transition"
              >
                Next
              </button>
            </div>
          </div>

          <div className="grid grid-cols-7 gap-2 mb-2">
            {weekDays.map((day) => (
              <p key={day} className="text-xs font-semibold text-slate-500 px-2 py-1">
                {day}
              </p>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-2">
            {monthDays.map((day) => {
              const isSelected = day.dateKey === selectedDateKey;
              const appointmentCount = appointmentCountsByDate[day.dateKey] || 0;

              return (
                <button
                  key={day.dateKey}
                  type="button"
                  onClick={() => {
                    setSelectedDateKey(day.dateKey);
                    setVisibleMonth(new Date(day.date.getFullYear(), day.date.getMonth(), 1));
                  }}
                  className={`rounded-xl border p-2 text-left min-h-[72px] transition ${
                    isSelected
                      ? "border-sky-400 bg-sky-50"
                      : "border-slate-200 bg-white hover:bg-slate-50"
                  } ${!day.inCurrentMonth ? "opacity-50" : "opacity-100"}`}
                >
                  <p className="text-sm font-medium text-slate-700">{day.date.getDate()}</p>
                  {appointmentCount > 0 && (
                    <p className="text-[11px] mt-2 text-sky-700 font-medium">
                      {appointmentCount} appt{appointmentCount === 1 ? "" : "s"}
                    </p>
                  )}
                </button>
              );
            })}
          </div>
        </section>
      </main>
    </div>
  );
}
