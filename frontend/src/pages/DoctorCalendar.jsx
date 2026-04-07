import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "../components/Navbar";
import { getMyAppointments } from "../api/appointments";
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

function formatShortDateLabel(dateKey) {
  return new Date(`${dateKey}T00:00:00`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
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
  return patientRecord.profile?.displayName || patientRecord.patient?.displayName || patientRecord.patient?.email || patientRecord.email || "Patient";
}

function SoftPill({ label, value, tone = "slate" }) {
  const tones = {
    slate: "bg-slate-100 text-slate-700",
    sky: "bg-sky-100 text-sky-700",
    emerald: "bg-emerald-100 text-emerald-700",
    amber: "bg-amber-100 text-amber-700",
    rose: "bg-rose-100 text-rose-700",
    violet: "bg-violet-100 text-violet-700",
  };
  return <span className={`rounded-full px-3 py-1 text-xs font-semibold ${tones[tone] || tones.slate}`}>{label}: {value}</span>;
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

export default function DoctorCalendar() {
  const navigate = useNavigate();
  const [appointments, setAppointments] = useState([]);
  const [assignedPatients, setAssignedPatients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedDateKey, setSelectedDateKey] = useState(toDateKey(new Date()));
  const [visibleMonth, setVisibleMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });

  useEffect(() => {
    let cancelled = false;

    async function loadData() {
      setLoading(true);
      setError("");
      const [appointmentsResult, patientsResult] = await Promise.allSettled([
        getMyAppointments(),
        fetchAssignedPatients(),
      ]);

      if (!cancelled) {
        if (appointmentsResult.status === "fulfilled") {
          setAppointments(appointmentsResult.value.appointments || []);
        } else {
          setAppointments([]);
          setError(appointmentsResult.reason?.message || "Failed to load appointments.");
        }

        if (patientsResult.status === "fulfilled") {
          setAssignedPatients(patientsResult.value.patients || []);
        } else {
          setAssignedPatients([]);
        }

        setLoading(false);
      }
    }

    loadData();
    return () => {
      cancelled = true;
    };
  }, []);

  const patientNameById = useMemo(() => {
    const map = new Map();
    for (const record of assignedPatients) {
      const patient = record.patient || record;
      map.set(patient.id, patientLabel(record));
    }
    return map;
  }, [assignedPatients]);

  const visibleAppointments = useMemo(
    () => appointments.filter((appointment) => appointment.status !== "denied"),
    [appointments]
  );

  const selectedAppointments = useMemo(() => {
    return visibleAppointments
      .filter((appointment) => toDateKey(appointment.startsAt) === selectedDateKey)
      .sort((left, right) => new Date(left.startsAt) - new Date(right.startsAt));
  }, [visibleAppointments, selectedDateKey]);

  const appointmentCountsByDate = useMemo(() => {
    return visibleAppointments.reduce((accumulator, appointment) => {
      const dateKey = toDateKey(appointment.startsAt);
      accumulator[dateKey] = (accumulator[dateKey] || 0) + 1;
      return accumulator;
    }, {});
  }, [visibleAppointments]);

  const selectedDayAppointmentCount = appointmentCountsByDate[selectedDateKey] || 0;

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

  function changeMonth(direction) {
    setVisibleMonth(
      (previousMonth) => new Date(previousMonth.getFullYear(), previousMonth.getMonth() + direction, 1)
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />

      <main className="mx-auto max-w-6xl px-6 pb-8 pt-28">
        <section className="mb-6 rounded-[2rem] bg-gradient-to-r from-slate-900 via-sky-800 to-cyan-600 p-8 text-white shadow-xl">
          <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.25em] text-white/75">Doctor Calendar</p>
              <h1 className="mt-3 text-4xl font-black">Schedule Calendar</h1>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-white/85">
                Scan the month, spot busy days instantly, and jump into the daily appointment list without the rest of the scheduling controls in the way.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => navigate("/doctorAppointments")}
                className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-slate-900 transition hover:bg-slate-100"
              >
                Back to appointments
              </button>
            </div>
          </div>
        </section>

        {error ? (
          <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        ) : null}

        <section className="mb-6 overflow-hidden rounded-3xl bg-gradient-to-br from-white via-cyan-50/60 to-sky-100/70 shadow">
          <div className="border-b border-white/70 bg-gradient-to-r from-slate-900 via-sky-800 to-cyan-600 p-6 text-white">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.28em] text-white/70">Schedule Calendar</p>
                <h2 className="mt-2 text-2xl font-black">
                  {visibleMonth.toLocaleString("en-US", { month: "long", year: "numeric" })}
                </h2>
                <p className="mt-2 text-sm text-white/80">
                  Use the monthly view to understand load, then open the selected day below.
                </p>
              </div>
              <div className="flex items-center gap-2 rounded-2xl bg-white/10 p-1 backdrop-blur-sm">
                <button
                  type="button"
                  onClick={() => changeMonth(-1)}
                  className="rounded-xl bg-white/10 px-3 py-2 text-sm font-semibold text-white transition hover:bg-white/20"
                >
                  Prev
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const today = new Date();
                    setSelectedDateKey(toDateKey(today));
                    setVisibleMonth(new Date(today.getFullYear(), today.getMonth(), 1));
                  }}
                  className="rounded-xl bg-white px-3 py-2 text-sm font-semibold text-slate-800 transition hover:bg-slate-100"
                >
                  Today
                </button>
                <button
                  type="button"
                  onClick={() => changeMonth(1)}
                  className="rounded-xl bg-white/10 px-3 py-2 text-sm font-semibold text-white transition hover:bg-white/20"
                >
                  Next
                </button>
              </div>
            </div>
          </div>

          <div className="p-6">
            <div className="mb-4 grid gap-3 md:grid-cols-3">
              <div className="rounded-2xl border border-white/80 bg-white/80 p-4 shadow-sm">
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">Selected day</p>
                <p className="mt-2 text-xl font-black text-slate-900">{formatShortDateLabel(selectedDateKey)}</p>
                <p className="mt-1 text-sm text-slate-500">Current schedule focus</p>
              </div>
              <div className="rounded-2xl border border-white/80 bg-white/80 p-4 shadow-sm">
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">This day</p>
                <p className="mt-2 text-xl font-black text-slate-900">{selectedDayAppointmentCount}</p>
                <p className="mt-1 text-sm text-slate-500">Appointments on the selected date</p>
              </div>
              <div className="rounded-2xl border border-white/80 bg-white/80 p-4 shadow-sm">
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">Busy days</p>
                <p className="mt-2 text-xl font-black text-slate-900">
                  {monthDays.filter((day) => (appointmentCountsByDate[day.dateKey] || 0) > 0 && day.inCurrentMonth).length}
                </p>
                <p className="mt-1 text-sm text-slate-500">Days with at least one appointment</p>
              </div>
            </div>

            <div className="mb-3 grid grid-cols-7 gap-3">
              {weekDays.map((day) => (
                <p key={day} className="px-2 py-1 text-center text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">
                  {day}
                </p>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-3">
              {monthDays.map((day) => {
                const isSelected = day.dateKey === selectedDateKey;
                const isToday = day.dateKey === toDateKey(new Date());
                const appointmentCount = appointmentCountsByDate[day.dateKey] || 0;
                const intensityClass =
                  appointmentCount >= 4
                    ? "bg-rose-500"
                    : appointmentCount >= 2
                    ? "bg-amber-400"
                    : appointmentCount === 1
                    ? "bg-emerald-400"
                    : "bg-transparent";

                return (
                  <button
                    key={day.dateKey}
                    type="button"
                    onClick={() => {
                      setSelectedDateKey(day.dateKey);
                      setVisibleMonth(new Date(day.date.getFullYear(), day.date.getMonth(), 1));
                    }}
                    className={`group min-h-[108px] rounded-2xl border p-3 text-left transition ${
                      isSelected
                        ? "border-sky-400 bg-gradient-to-br from-sky-50 to-cyan-50 shadow-lg shadow-sky-100"
                        : "border-white/80 bg-white/85 hover:-translate-y-0.5 hover:border-slate-300 hover:bg-white hover:shadow-md"
                    } ${!day.inCurrentMonth ? "opacity-45" : "opacity-100"}`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span
                        className={`inline-flex h-9 w-9 items-center justify-center rounded-full text-sm font-bold ${
                          isSelected
                            ? "bg-sky-500 text-white"
                            : isToday
                            ? "bg-slate-900 text-white"
                            : "bg-slate-100 text-slate-700 group-hover:bg-slate-200"
                        }`}
                      >
                        {day.date.getDate()}
                      </span>
                      {appointmentCount > 0 ? <span className={`h-3 w-3 rounded-full ${intensityClass}`} /> : null}
                    </div>

                    <div className="mt-6">
                      {appointmentCount > 0 ? (
                        <>
                          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Booked</p>
                          <p className="mt-1 text-lg font-black text-slate-900">{appointmentCount}</p>
                          <p className="text-xs text-slate-500">appointment{appointmentCount === 1 ? "" : "s"}</p>
                        </>
                      ) : (
                        <p className="text-xs font-medium text-slate-400">No appointments yet</p>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </section>

        <section className="rounded-3xl bg-white p-6 shadow">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-semibold text-slate-800 mb-1">Appointments For {formatDateLabel(selectedDateKey)}</h2>
              <p className="text-sm text-slate-500">The selected day opens here as a focused doctor schedule.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <SoftPill label="Selected" value={formatShortDateLabel(selectedDateKey)} tone="sky" />
              <SoftPill label="Appointments" value={selectedDayAppointmentCount} tone="emerald" />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="min-h-full w-full text-left text-sm">
              <thead className="border-b text-slate-500">
                <tr>
                  <th className="py-3 px-4">Time</th>
                  <th className="py-3 px-4">Patient</th>
                  <th className="py-3 px-4">Location</th>
                  <th className="py-3 px-4">Notes</th>
                  <th className="py-3 px-4">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr>
                    <td colSpan={5} className="py-6 px-4 text-center text-slate-500">Loading appointments...</td>
                  </tr>
                ) : selectedAppointments.length > 0 ? (
                  selectedAppointments.map((appointment) => (
                    <tr key={appointment.id} className="hover:bg-slate-50">
                      <td className="py-3 px-4 font-medium text-slate-700">{formatTime(appointment.startsAt)}</td>
                      <td className="py-3 px-4 text-slate-800">
                        {patientNameById.get(appointment.patient?.id || appointment.patientId) ||
                          appointment.patient?.displayName ||
                          appointment.patient?.email ||
                          "Patient"}
                      </td>
                      <td className="py-3 px-4 text-slate-600">{appointment.location || "-"}</td>
                      <td className="py-3 px-4 text-slate-600">{appointment.notes || "-"}</td>
                      <td className="py-3 px-4">
                        <span className={`rounded-full px-2 py-1 text-xs ${statusClass(appointment.status)}`}>
                          {statusLabel(appointment.status)}
                        </span>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="py-6 px-4 text-center text-slate-500">No appointments found for this date. Pick another day or open Appointments to schedule a visit.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </div>
  );
}
