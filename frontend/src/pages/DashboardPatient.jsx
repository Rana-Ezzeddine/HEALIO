import { useEffect, useState } from "react";
import Navbar from "../components/Navbar";
import { useNavigate } from "react-router-dom";

const PATIENT_APPOINTMENTS_STORAGE_KEY = "patientAppointments";
const fallbackAppointments = [
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

function appointmentDateTime(appointment) {
  const [timePart, period] = appointment.time.split(" ");
  const [hourString, minuteString] = timePart.split(":");
  let hour = Number(hourString);

  if (period === "PM" && hour !== 12) {
    hour += 12;
  }

  if (period === "AM" && hour === 12) {
    hour = 0;
  }

  const date = new Date(`${appointment.date}T00:00:00`);
  date.setHours(hour, Number(minuteString), 0, 0);
  return date;
}

function formatAppointmentDate(dateString) {
  const date = new Date(`${dateString}T00:00:00`);
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function DashboardCard({title, mainText, subText, navPage}){
  const navigate = useNavigate();
  return(
    <div 
      onClick={() => navigate(navPage)}
      className="group bg-white hover:bg-slate-100 shadow-lg p-4 rounded-2xl cursor-pointer hover:shadow-md hover:-translate-y-1 transition">
      <div className="flex justify-between items-start">
        <div>
          <h3 className="text-slate-500 text-sm">{title}</h3>
          <p className="text-slate-800 font-bold text-2xl">{mainText}</p>
          {subText &&(
            <p className="text-sky-600 font-medium text-sm mt-1">{subText}</p>
          )}
        </div>
          <span className="text-slate-400 text-xs group-hover:text-slate-600">View →</span>
      </div>
    </div>
  );
}

export default function DashboardPatient() {
  const navigate = useNavigate();
  const [role, setRole] = useState("Patient");
  const [name, setName] = useState("Patient");
  const [appointments, setAppointments] = useState(fallbackAppointments);

  useEffect(() => {
    try {
      const r = localStorage.getItem("userRole");
      setRole(r || "Patient");

      const firstName = localStorage.getItem("firstName") || "Patient";
      setName(firstName);
    } catch (err) {
      console.error(err);
    }

    try {
      const storedAppointments = localStorage.getItem(PATIENT_APPOINTMENTS_STORAGE_KEY);
      if (!storedAppointments) {
        return;
      }

      const parsedAppointments = JSON.parse(storedAppointments);
      if (Array.isArray(parsedAppointments)) {
        setAppointments(parsedAppointments);
      }
    } catch (err) {
      console.error(err);
    }
  }, []);

  const upcomingAppointments = appointments
    .filter((appointment) => appointment.status === "Upcoming")
    .sort((leftAppointment, rightAppointment) => {
      return appointmentDateTime(leftAppointment) - appointmentDateTime(rightAppointment);
    });

  const nextAppointment = upcomingAppointments[0];
  const nextAppointmentMainText = nextAppointment ? formatAppointmentDate(nextAppointment.date) : "No upcoming";
  const nextAppointmentSubText = nextAppointment
    ? `${nextAppointment.time} - ${nextAppointment.doctorName}`
    : "Book your next visit";

  function handleLogout() {
    try {
      localStorage.removeItem("accessToken");
      localStorage.removeItem("user");
      localStorage.removeItem("userRole");
      localStorage.removeItem("firstName");
    } catch (err) {
      console.error(err);
    }
    navigate("/");
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar/>

      <main className="pt-28 max-w-6xl mx-auto px-6 py-8">
        <div className="mb-6">
          <h1 className="text-3xl text-slate-800 font-bold">Welcome Back, {name} 👋</h1>
          <p className="text-slate-500 mt-1">Here's a quick overview of your health</p>
        </div>
        
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-8">
          <DashboardCard
            title="💊 Active Medications"
            mainText="3 Medications"
            subText="Next dose: Paracetamol - 8:00 PM"
            navPage="/medication"
          />
          <DashboardCard
            title="📅 Next Appointment"
            mainText={nextAppointmentMainText}
            subText={nextAppointmentSubText}
            navPage="/patientAppointments"
          />
          <DashboardCard
            title="🤒 Last Symptom Logged"
            mainText="Yesterday"
            navPage="/symptoms"
          />
          
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          
          <section className="md:col-span-2 bg-white rounded-3xl shadow p-6">
            <h2 className="text-xl font-semibold text-slate-800 mb-4">
              Upcoming Appointments
            </h2>

            {upcomingAppointments.length > 0 ? (
              <div className="space-y-3">
                {upcomingAppointments.slice(0, 3).map((appointment) => (
                  <div
                    key={appointment.id}
                    className="rounded-2xl border border-slate-200 bg-white px-4 py-3"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <p className="font-semibold text-slate-800">{appointment.doctorName}</p>
                      <p className="text-sm text-slate-500">
                        {formatAppointmentDate(appointment.date)} at {appointment.time}
                      </p>
                    </div>
                    <p className="text-sm text-slate-500 mt-1">
                      {appointment.specialty} • {appointment.reason}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-slate-500 text-sm">
                No upcoming appointments yet.
              </div>
            )}
          </section>

          <aside className="bg-white rounded-3xl shadow p-6">
            <h2 className="text-lg font-semibold text-slate-800 mb-4">
              Quick Actions
            </h2>

            <div className="flex flex-col gap-3">
              <button
                onClick={() => navigate("/patientAppointments")}
                className="w-full px-4 py-2 rounded-xl bg-sky-100 text-sky-700 font-medium hover:bg-sky-200 transition"
              >
                Book Appointment
              </button>

              <button
                className="w-full px-4 py-2 rounded-xl bg-indigo-100 text-indigo-700 font-medium hover:bg-indigo-200 transition"
              >
                View Records
              </button>

              <button
                onClick={() => navigate("/patientMessages")}
                className="w-full px-4 py-2 rounded-xl bg-emerald-100 text-emerald-700 font-medium hover:bg-emerald-200 transition"
              >
                Message Doctor
              </button>
            </div>
          </aside>
        </div>
      </main>
    </div>
  );
}
