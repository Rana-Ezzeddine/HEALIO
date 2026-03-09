import { useMemo, useState } from "react";
import Navbar from "../components/Navbar";

const appointments = [
  {
    id: "a1",
    date: "2026-03-09",
    time: "09:00 AM",
    patientName: "Omar Haddad",
    visitType: "Routine Check",
    status: "Completed",
  },
  {
    id: "a2",
    date: "2026-03-09",
    time: "11:30 AM",
    patientName: "Lina Saad",
    visitType: "Blood Pressure Follow-up",
    status: "In Progress",
  },
  {
    id: "a3",
    date: "2026-03-09",
    time: "02:30 PM",
    patientName: "Sarah Khalil",
    visitType: "Follow-up",
    status: "Upcoming",
  },
  {
    id: "a4",
    date: "2026-03-11",
    time: "04:00 PM",
    patientName: "Maya Daher",
    visitType: "Consultation",
    status: "Upcoming",
  },
  {
    id: "a5",
    date: "2026-03-14",
    time: "10:00 AM",
    patientName: "Nour Fares",
    visitType: "Medication Review",
    status: "Upcoming",
  },
  {
    id: "a6",
    date: "2026-03-18",
    time: "01:15 PM",
    patientName: "Rami Tannous",
    visitType: "Lab Results",
    status: "Upcoming",
  },
];

const weekDays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function toDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function statusClass(status) {
  if (status === "Completed") {
    return "bg-emerald-100 text-emerald-700";
  }

  if (status === "In Progress") {
    return "bg-sky-100 text-sky-700";
  }

  return "bg-yellow-100 text-yellow-700";
}

export default function DoctorAppointments() {
  const [appointmentsList, setAppointmentsList] = useState(appointments);
  const [selectedDateKey, setSelectedDateKey] = useState("2026-03-09");
  const [visibleMonth, setVisibleMonth] = useState(new Date(2026, 2, 1));
  const [newPatientName, setNewPatientName] = useState("");
  const [newTime, setNewTime] = useState("");
  const [newVisitType, setNewVisitType] = useState("");
  const [newStatus, setNewStatus] = useState("Upcoming");
  const [editingAppointmentId, setEditingAppointmentId] = useState(null);

  const appointmentsByDate = useMemo(() => {
    return appointmentsList.reduce((accumulator, appointment) => {
      accumulator[appointment.date] = (accumulator[appointment.date] || 0) + 1;
      return accumulator;
    }, {});
  }, [appointmentsList]);

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

  const selectedAppointments = appointmentsList.filter((appointment) => appointment.date === selectedDateKey);
  const upcomingCount = selectedAppointments.filter((appointment) => appointment.status === "Upcoming").length;

  function changeMonth(direction) {
    setVisibleMonth(
      (previousMonth) =>
        new Date(previousMonth.getFullYear(), previousMonth.getMonth() + direction, 1)
    );
  }

  function handleDateSelect(dateKey, date) {
    setSelectedDateKey(dateKey);
    setVisibleMonth(new Date(date.getFullYear(), date.getMonth(), 1));
  }

  function toTimeInputValue(timeLabel) {
    const [timePart, period] = timeLabel.split(" ");
    const [hourString, minute] = timePart.split(":");
    let hour = Number(hourString);

    if (period === "PM" && hour !== 12) {
      hour += 12;
    }

    if (period === "AM" && hour === 12) {
      hour = 0;
    }

    return `${String(hour).padStart(2, "0")}:${minute}`;
  }

  function resetForm() {
    setNewPatientName("");
    setNewTime("");
    setNewVisitType("");
    setNewStatus("Upcoming");
    setEditingAppointmentId(null);
  }

  function handleAddAppointment(e) {
    e.preventDefault();

    const trimmedPatientName = newPatientName.trim();
    const trimmedVisitType = newVisitType.trim();

    if (!trimmedPatientName || !trimmedVisitType || !newTime) {
      return;
    }

    const [hour, minute] = newTime.split(":");
    const timeDate = new Date();
    timeDate.setHours(Number(hour), Number(minute), 0, 0);
    const formattedTime = timeDate.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

    if (editingAppointmentId) {
      setAppointmentsList((previousAppointments) =>
        previousAppointments.map((appointment) => {
          if (appointment.id !== editingAppointmentId) {
            return appointment;
          }

          return {
            ...appointment,
            date: selectedDateKey,
            time: formattedTime,
            patientName: trimmedPatientName,
            visitType: trimmedVisitType,
            status: newStatus,
          };
        })
      );
      resetForm();
      return;
    }

    const newAppointment = {
      id: `a-${Date.now()}`,
      date: selectedDateKey,
      time: formattedTime,
      patientName: trimmedPatientName,
      visitType: trimmedVisitType,
      status: newStatus,
    };

    setAppointmentsList((previousAppointments) => [...previousAppointments, newAppointment]);
    resetForm();
  }

  function handleEditAppointment(appointment) {
    setEditingAppointmentId(appointment.id);
    setSelectedDateKey(appointment.date);
    const editDate = new Date(`${appointment.date}T00:00:00`);
    setVisibleMonth(new Date(editDate.getFullYear(), editDate.getMonth(), 1));
    setNewPatientName(appointment.patientName);
    setNewTime(toTimeInputValue(appointment.time));
    setNewVisitType(appointment.visitType);
    setNewStatus(appointment.status);
  }

  function handleDeleteAppointment(appointmentId) {
    setAppointmentsList((previousAppointments) =>
      previousAppointments.filter((appointment) => appointment.id !== appointmentId)
    );

    if (editingAppointmentId === appointmentId) {
      resetForm();
    }
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />

      <main className="pt-28 max-w-6xl mx-auto px-6 py-8">
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl text-slate-800 font-bold">Appointments</h1>
            <p className="text-slate-500 mt-1">Manage your schedule with a calendar view.</p>
          </div>
          <div className="rounded-2xl bg-white border border-slate-200 px-4 py-3 text-right">
            <p className="text-xs text-slate-500">Upcoming On Selected Date</p>
            <p className="text-2xl font-bold text-slate-800">{upcomingCount}</p>
          </div>
        </div>

        <section className="bg-white rounded-3xl shadow p-6 mb-6">
          <h2 className="text-xl font-semibold text-slate-800 mb-1">Selected Day Schedule</h2>
          <p className="text-sm text-slate-500 mb-4">{selectedDateKey}</p>

          <form onSubmit={handleAddAppointment} className="grid grid-cols-1 md:grid-cols-6 gap-2 mb-5">
            <input
              type="text"
              placeholder="Patient name"
              value={newPatientName}
              onChange={(e) => setNewPatientName(e.target.value)}
              className="rounded-xl border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
            />
            <input
              type="time"
              value={newTime}
              onChange={(e) => setNewTime(e.target.value)}
              className="rounded-xl border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
            />
            <input
              type="text"
              placeholder="Visit type"
              value={newVisitType}
              onChange={(e) => setNewVisitType(e.target.value)}
              className="rounded-xl border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
            />
            <select
              value={newStatus}
              onChange={(e) => setNewStatus(e.target.value)}
              className="rounded-xl border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
            >
              <option>Upcoming</option>
              <option>In Progress</option>
              <option>Completed</option>
            </select>
            <button
              type="submit"
              className="rounded-xl bg-sky-500 px-4 py-2 text-sm font-medium text-white hover:bg-sky-600 transition"
            >
              {editingAppointmentId ? "Save Changes" : "Add Appointment"}
            </button>
            {editingAppointmentId && (
              <button
                type="button"
                onClick={resetForm}
                className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition"
              >
                Cancel
              </button>
            )}
          </form>

          <div className="overflow-x-auto">
            <table className="min-h-full text-sm text-left w-full">
              <thead className="text-slate-500 border-b">
                <tr>
                  <th className="py-3 px-4">Time</th>
                  <th className="py-3 px-4">Patient</th>
                  <th className="py-3 px-4">Visit Type</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {selectedAppointments.length > 0 ? (
                  selectedAppointments.map((appointment) => (
                    <tr key={appointment.id} className="hover:bg-slate-50">
                      <td className="py-3 px-4 font-medium text-slate-700">{appointment.time}</td>
                      <td className="py-3 px-4 text-slate-800">{appointment.patientName}</td>
                      <td className="py-3 px-4 text-slate-600">{appointment.visitType}</td>
                      <td className="py-3 px-4">
                        <span className={`px-2 py-1 text-xs rounded-full ${statusClass(appointment.status)}`}>
                          {appointment.status}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3 text-sm">
                          <button
                            type="button"
                            onClick={() => handleEditAppointment(appointment)}
                            className="text-sky-600 hover:text-sky-700"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteAppointment(appointment.id)}
                            className="text-rose-600 hover:text-rose-700"
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="py-6 px-4 text-center text-slate-500">
                      No appointments for this date.
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
              const hasAppointments = Boolean(appointmentsByDate[day.dateKey]);

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
                      {appointmentsByDate[day.dateKey]} appt.
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
