import { useEffect, useMemo, useState } from "react";
import Navbar from "../components/Navbar";

const PATIENT_APPOINTMENTS_STORAGE_KEY = "patientAppointments";

const initialAppointments = [
  {
    id: "pa1",
    doctorName: "Dr. Hadi Rahme",
    specialty: "Internal Medicine",
    date: "2026-03-22",
    time: "10:30 AM",
    reason: "Monthly follow-up",
    status: "Upcoming",
  },
  {
    id: "pa2",
    doctorName: "Dr. Rania Khoury",
    specialty: "Cardiology",
    date: "2026-03-28",
    time: "01:00 PM",
    reason: "Blood pressure review",
    status: "Upcoming",
  },
];

function statusClass(status) {
  if (status === "Completed") {
    return "bg-emerald-100 text-emerald-700";
  }

  if (status === "Cancelled") {
    return "bg-rose-100 text-rose-700";
  }

  return "bg-yellow-100 text-yellow-700";
}

export default function PatientAppointments() {
  const [appointments, setAppointments] = useState(() => {
    try {
      const storedAppointments = localStorage.getItem(PATIENT_APPOINTMENTS_STORAGE_KEY);
      if (!storedAppointments) {
        return initialAppointments;
      }

      const parsedAppointments = JSON.parse(storedAppointments);
      return Array.isArray(parsedAppointments) ? parsedAppointments : initialAppointments;
    } catch (error) {
      console.error(error);
      return initialAppointments;
    }
  });
  const [doctorName, setDoctorName] = useState("");
  const [specialty, setSpecialty] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [reason, setReason] = useState("");

  const upcomingCount = useMemo(
    () => appointments.filter((appointment) => appointment.status === "Upcoming").length,
    [appointments]
  );

  useEffect(() => {
    try {
      localStorage.setItem(PATIENT_APPOINTMENTS_STORAGE_KEY, JSON.stringify(appointments));
    } catch (error) {
      console.error(error);
    }
  }, [appointments]);

  function handleAddAppointment(e) {
    e.preventDefault();

    const trimmedDoctorName = doctorName.trim();
    const trimmedSpecialty = specialty.trim();
    const trimmedReason = reason.trim();

    if (!trimmedDoctorName || !trimmedSpecialty || !trimmedReason || !date || !time) {
      return;
    }

    const [hour, minute] = time.split(":");
    const timeDate = new Date();
    timeDate.setHours(Number(hour), Number(minute), 0, 0);
    const formattedTime = timeDate.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

    const newAppointment = {
      id: `pa-${Date.now()}`,
      doctorName: trimmedDoctorName,
      specialty: trimmedSpecialty,
      date,
      time: formattedTime,
      reason: trimmedReason,
      status: "Upcoming",
    };

    setAppointments((previousAppointments) => [newAppointment, ...previousAppointments]);
    setDoctorName("");
    setSpecialty("");
    setDate("");
    setTime("");
    setReason("");
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />

      <main className="pt-28 max-w-6xl mx-auto px-6 py-8">
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl text-slate-800 font-bold">Appointments</h1>
            <p className="text-slate-500 mt-1">Book and review your appointments with doctors.</p>
          </div>
          <div className="rounded-2xl bg-white border border-slate-200 px-4 py-3 text-right">
            <p className="text-xs text-slate-500">Upcoming Appointments</p>
            <p className="text-2xl font-bold text-slate-800">{upcomingCount}</p>
          </div>
        </div>

        <section className="bg-white rounded-3xl shadow p-6 mb-6">
          <h2 className="text-xl font-semibold text-slate-800 mb-4">Add Appointment</h2>

          <form onSubmit={handleAddAppointment} className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <input
              type="text"
              placeholder="Doctor name"
              value={doctorName}
              onChange={(e) => setDoctorName(e.target.value)}
              className="rounded-xl border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
            />
            <input
              type="text"
              placeholder="Specialty"
              value={specialty}
              onChange={(e) => setSpecialty(e.target.value)}
              className="rounded-xl border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
            />
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="rounded-xl border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
            />
            <input
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              className="rounded-xl border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
            />
            <input
              type="text"
              placeholder="Reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="md:col-span-2 rounded-xl border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
            />
            <button
              type="submit"
              className="md:col-span-2 rounded-xl bg-sky-500 px-4 py-2 text-sm font-medium text-white hover:bg-sky-600 transition"
            >
              Book Appointment
            </button>
          </form>
        </section>

        <section className="bg-white rounded-3xl shadow p-6">
          <h2 className="text-xl font-semibold text-slate-800 mb-4">My Appointments</h2>

          <div className="overflow-x-auto">
            <table className="min-h-full text-sm text-left w-full">
              <thead className="text-slate-500 border-b">
                <tr>
                  <th className="py-3 px-4">Doctor</th>
                  <th className="py-3 px-4">Specialty</th>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Time</th>
                  <th className="py-3 px-4">Reason</th>
                  <th className="py-3 px-4">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {appointments.map((appointment) => (
                  <tr key={appointment.id} className="hover:bg-slate-50">
                    <td className="py-3 px-4 text-slate-800 font-medium">{appointment.doctorName}</td>
                    <td className="py-3 px-4 text-slate-600">{appointment.specialty}</td>
                    <td className="py-3 px-4 text-slate-700">{appointment.date}</td>
                    <td className="py-3 px-4 text-slate-700">{appointment.time}</td>
                    <td className="py-3 px-4 text-slate-600">{appointment.reason}</td>
                    <td className="py-3 px-4">
                      <span className={`px-2 py-1 text-xs rounded-full ${statusClass(appointment.status)}`}>
                        {appointment.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </div>
  );
}
