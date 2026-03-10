import { useEffect, useMemo, useState } from "react";
import Navbar from "../components/Navbar";

const PATIENT_APPOINTMENTS_STORAGE_KEY = "patientAppointments";
const weekDays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const fallbackAppointments = [
  {
    id: "pa1",
    patientName: "Demo Patient",
    doctorName: "Dr. Hadi Rahme",
    specialty: "Internal Medicine",
    date: "2026-03-22",
    time: "10:30 AM",
    reason: "Monthly follow-up",
    status: "Upcoming",
  },
  {
    id: "pa2",
    patientName: "Demo Patient",
    doctorName: "Dr. Rania Khoury",
    specialty: "Cardiology",
    date: "2026-03-28",
    time: "01:00 PM",
    reason: "Blood pressure review",
    status: "Requested",
  },
];

function readAppointments() {
  try {
    const stored = localStorage.getItem(PATIENT_APPOINTMENTS_STORAGE_KEY);
    if (!stored) return fallbackAppointments;

    const parsed = JSON.parse(stored);
    return Array.isArray(parsed) ? parsed : fallbackAppointments;
  } catch (error) {
    console.error(error);
    return fallbackAppointments;
  }
}

function toDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function statusClass(status) {
  if (status === "Requested") return "bg-amber-100 text-amber-700";
  if (status === "Upcoming") return "bg-emerald-100 text-emerald-700";
  if (status === "Completed") return "bg-sky-100 text-sky-700";
  if (status === "Denied") return "bg-rose-100 text-rose-700";
  return "bg-slate-100 text-slate-700";
}

export default function DoctorAppointments() {
  const [appointmentsList, setAppointmentsList] = useState(readAppointments);
  const [decisionNotes, setDecisionNotes] = useState({});
  const [selectedDateKey, setSelectedDateKey] = useState(toDateKey(new Date()));
  const [visibleMonth, setVisibleMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });

  useEffect(() => {
    try {
      localStorage.setItem(PATIENT_APPOINTMENTS_STORAGE_KEY, JSON.stringify(appointmentsList));
    } catch (error) {
      console.error(error);
    }
  }, [appointmentsList]);

  const pendingRequests = useMemo(
    () => appointmentsList.filter((appointment) => appointment.status === "Requested"),
    [appointmentsList]
  );

  const approvedByDate = useMemo(() => {
    return appointmentsList
      .filter((appointment) => appointment.status === "Upcoming" || appointment.status === "Completed")
      .reduce((accumulator, appointment) => {
        accumulator[appointment.date] = (accumulator[appointment.date] || 0) + 1;
        return accumulator;
      }, {});
  }, [appointmentsList]);

  const selectedAppointments = useMemo(
    () =>
      appointmentsList.filter(
        (appointment) =>
          appointment.date === selectedDateKey &&
          (appointment.status === "Upcoming" || appointment.status === "Completed")
      ),
    [appointmentsList, selectedDateKey]
  );

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

  function updateDecisionNote(appointmentId, note) {
    setDecisionNotes((previous) => ({ ...previous, [appointmentId]: note }));
  }

  function approveRequest(appointmentId) {
    setAppointmentsList((previousAppointments) =>
      previousAppointments.map((appointment) => {
        if (appointment.id !== appointmentId) return appointment;

        const note = (decisionNotes[appointmentId] || "").trim();
        return {
          ...appointment,
          status: "Upcoming",
          decisionMessage: note || "Approved by doctor.",
          reviewedAt: new Date().toISOString(),
        };
      })
    );
    setDecisionNotes((previous) => ({ ...previous, [appointmentId]: "" }));
  }

  function denyRequest(appointmentId) {
    setAppointmentsList((previousAppointments) =>
      previousAppointments.map((appointment) => {
        if (appointment.id !== appointmentId) return appointment;

        const note = (decisionNotes[appointmentId] || "").trim();
        return {
          ...appointment,
          status: "Denied",
          decisionMessage: note || "Request denied by doctor.",
          reviewedAt: new Date().toISOString(),
        };
      })
    );
    setDecisionNotes((previous) => ({ ...previous, [appointmentId]: "" }));
  }

  function markCompleted(appointmentId) {
    setAppointmentsList((previousAppointments) =>
      previousAppointments.map((appointment) => {
        if (appointment.id !== appointmentId) return appointment;
        return {
          ...appointment,
          status: "Completed",
        };
      })
    );
  }

  function changeMonth(direction) {
    setVisibleMonth(
      (previousMonth) => new Date(previousMonth.getFullYear(), previousMonth.getMonth() + direction, 1)
    );
  }

  function handleDateSelect(dateKey, date) {
    setSelectedDateKey(dateKey);
    setVisibleMonth(new Date(date.getFullYear(), date.getMonth(), 1));
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />

      <main className="pt-28 max-w-6xl mx-auto px-6 py-8">
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl text-slate-800 font-bold">Appointments</h1>
            <p className="text-slate-500 mt-1">Review patient requests and manage approved appointments.</p>
          </div>
          <div className="rounded-2xl bg-white border border-slate-200 px-4 py-3 text-right">
            <p className="text-xs text-slate-500">Pending Requests</p>
            <p className="text-2xl font-bold text-slate-800">{pendingRequests.length}</p>
          </div>
        </div>

        <section className="bg-white rounded-3xl shadow p-6 mb-6">
          <h2 className="text-xl font-semibold text-slate-800 mb-4">Patient Requests</h2>

          <div className="overflow-x-auto">
            <table className="min-h-full text-sm text-left w-full">
              <thead className="text-slate-500 border-b">
                <tr>
                  <th className="py-3 px-4">Patient</th>
                  <th className="py-3 px-4">Doctor</th>
                  <th className="py-3 px-4">Specialty</th>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Time</th>
                  <th className="py-3 px-4">Reason</th>
                  <th className="py-3 px-4">Decision Note</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {pendingRequests.length > 0 ? (
                  pendingRequests.map((appointment) => (
                    <tr key={appointment.id} className="hover:bg-slate-50">
                      <td className="py-3 px-4 text-slate-800 font-medium">{appointment.patientName || "Patient"}</td>
                      <td className="py-3 px-4 text-slate-700">{appointment.doctorName}</td>
                      <td className="py-3 px-4 text-slate-600">{appointment.specialty}</td>
                      <td className="py-3 px-4 text-slate-700">{appointment.date}</td>
                      <td className="py-3 px-4 text-slate-700">{appointment.time}</td>
                      <td className="py-3 px-4 text-slate-600">{appointment.reason}</td>
                      <td className="py-3 px-4">
                        <input
                          type="text"
                          value={decisionNotes[appointment.id] || ""}
                          onChange={(e) => updateDecisionNote(appointment.id, e.target.value)}
                          placeholder="Optional note for patient"
                          className="w-52 rounded-lg border border-slate-300 px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-sky-500"
                        />
                      </td>
                      <td className="py-3 px-4">
                        <span className={`px-2 py-1 text-xs rounded-full ${statusClass(appointment.status)}`}>
                          {appointment.status}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => approveRequest(appointment.id)}
                            className="rounded-lg bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-600"
                          >
                            Approve
                          </button>
                          <button
                            type="button"
                            onClick={() => denyRequest(appointment.id)}
                            className="rounded-lg bg-rose-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-rose-600"
                          >
                            Deny
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={9} className="py-6 px-4 text-center text-slate-500">
                      No pending requests.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="bg-white rounded-3xl shadow p-6 mb-6">
          <h2 className="text-xl font-semibold text-slate-800 mb-1">Approved Schedule</h2>
          <p className="text-sm text-slate-500 mb-4">Selected Date: {selectedDateKey}</p>

          <div className="overflow-x-auto">
            <table className="min-h-full text-sm text-left w-full">
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
                {selectedAppointments.length > 0 ? (
                  selectedAppointments.map((appointment) => (
                    <tr key={appointment.id} className="hover:bg-slate-50">
                      <td className="py-3 px-4 text-slate-700 font-medium">{appointment.time}</td>
                      <td className="py-3 px-4 text-slate-800">{appointment.patientName || "Patient"}</td>
                      <td className="py-3 px-4 text-slate-600">{appointment.reason}</td>
                      <td className="py-3 px-4">
                        <span className={`px-2 py-1 text-xs rounded-full ${statusClass(appointment.status)}`}>
                          {appointment.status}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        {appointment.status === "Upcoming" ? (
                          <button
                            type="button"
                            onClick={() => markCompleted(appointment.id)}
                            className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                          >
                            Mark Completed
                          </button>
                        ) : (
                          <span className="text-xs text-slate-400">-</span>
                        )}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="py-6 px-4 text-center text-slate-500">
                      No approved appointments for this date.
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
              const hasAppointments = Boolean(approvedByDate[day.dateKey]);

              return (
                <button
                  key={day.dateKey}
                  type="button"
                  onClick={() => handleDateSelect(day.dateKey, day.date)}
                  className={`rounded-xl border p-2 text-left min-h-[72px] transition ${
                    isSelected
                      ? "border-sky-400 bg-sky-50"
                      : "border-slate-200 bg-white hover:bg-slate-50"
                  } ${!day.inCurrentMonth ? "opacity-50" : "opacity-100"}`}
                >
                  <p className="text-sm font-medium text-slate-700">{day.date.getDate()}</p>
                  {hasAppointments && (
                    <p className="text-[11px] mt-2 text-sky-700 font-medium">
                      {approvedByDate[day.dateKey]} approved
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
