import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "../components/Navbar";
import { authHeaders, getUser } from "../api/http";
import { apiUrl } from "../api/http";
import { getMyAppointments } from "../api/appointments";
import { getConversations } from "../api/messaging";
import { getNextMedicationDose, formatDoseTime } from "../utils/medicationSchedule";

function startOfDayFromValue(value) {
  if (!value) return null;

  if (typeof value === "string") {
    const dateOnly = value.match(/^(\d{4})-(\d{2})-(\d{2})(?:$|T)/);
    if (dateOnly) {
      const year = Number(dateOnly[1]);
      const month = Number(dateOnly[2]) - 1;
      const day = Number(dateOnly[3]);
      return new Date(year, month, day);
    }
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
}

function formatAppointmentDate(dateLike) {
  return new Date(dateLike).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function formatAppointmentTime(dateLike) {
  return new Date(dateLike).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function doctorName(appointment) {
  return appointment.doctor?.displayName || appointment.doctor?.email || "Doctor";
}

function DashboardCard({ title, mainText, subText, navPage }) {
  const navigate = useNavigate();

  return (
    <div
      onClick={() => navigate(navPage)}
      className="group bg-white hover:bg-slate-100 shadow-lg p-4 rounded-2xl cursor-pointer hover:shadow-md hover:-translate-y-1 transition"
    >
      <div className="flex justify-between items-start">
        <div>
          <h3 className="text-slate-500 text-sm">{title}</h3>
          <p className="text-slate-800 font-bold text-2xl">{mainText}</p>
          {subText && <p className="text-sky-600 font-medium text-sm mt-1">{subText}</p>}
        </div>
        <span className="text-slate-400 text-xs group-hover:text-slate-600">View -&gt;</span>
      </div>
    </div>
  );
}

export default function DashboardPatient() {
  const navigate = useNavigate();
  const user = getUser();
  const greetingName = user?.firstName || localStorage.getItem("firstName") || user?.email || "Patient";
  const [appointments, setAppointments] = useState([]);
  const [conversationCount, setConversationCount] = useState(0);
  const [medicationCount, setMedicationCount] = useState(0);
  const [medicationSubText, setMedicationSubText] = useState("No medications added yet");
  const [lastSymptomText, setLastSymptomText] = useState("No logs");

  useEffect(() => {
    let cancelled = false;

    async function loadAppointmentsAndMessages() {
      try {
        const [appointmentsData, conversationsData] = await Promise.all([
          getMyAppointments(),
          getConversations(),
        ]);

        if (!cancelled) {
          setAppointments(appointmentsData.appointments || []);
          setConversationCount((conversationsData.conversations || []).length);
        }
      } catch {
        if (!cancelled) {
          setAppointments([]);
          setConversationCount(0);
        }
      }
    }

    loadAppointmentsAndMessages();
    return () => {
      cancelled = true;
    };
  }, []);

  const upcomingAppointments = useMemo(() => {
    return appointments
      .filter((appointment) => appointment.status === "scheduled")
      .sort((left, right) => new Date(left.startsAt) - new Date(right.startsAt));
  }, [appointments]);

  const nextAppointment = upcomingAppointments[0];
  const nextAppointmentMainText = nextAppointment ? formatAppointmentDate(nextAppointment.startsAt) : "No upcoming";
  const nextAppointmentSubText = nextAppointment
    ? `${formatAppointmentTime(nextAppointment.startsAt)} - ${doctorName(nextAppointment)}`
    : "Message your doctor to plan the next visit";

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${apiUrl}/api/medications`, {
          headers: { "Content-Type": "application/json", ...authHeaders() },
        });

        if (!res.ok) {
          setMedicationCount(0);
          setMedicationSubText("No medications added yet");
          return;
        }

        const meds = await res.json().catch(() => []);
        const list = Array.isArray(meds) ? meds : [];
        setMedicationCount(list.length);

        const nextDose = getNextMedicationDose(list);
        if (!nextDose) {
          setMedicationSubText(list.length > 0 ? "No upcoming doses" : "No medications added yet");
          return;
        }

        setMedicationSubText(
          `Next: ${nextDose.medication?.name || "Medication"} at ${formatDoseTime(nextDose.at)}`
        );
      } catch {
        setMedicationCount(0);
        setMedicationSubText("No medications added yet");
      }
    })();
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${apiUrl}/api/symptoms`, {
          headers: { "Content-Type": "application/json", ...authHeaders() },
        });

        if (!res.ok) {
          setLastSymptomText("No logs");
          return;
        }

        const symptoms = await res.json().catch(() => []);
        const list = Array.isArray(symptoms) ? symptoms : [];
        if (list.length === 0) {
          setLastSymptomText("No logs");
          return;
        }

        const rawDate = list[0]?.loggedAt;
        const startOfLogged = startOfDayFromValue(rawDate);
        if (!startOfLogged) {
          setLastSymptomText("No logs");
          return;
        }

        const today = new Date();
        const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
        const diffDays = Math.floor((startOfToday - startOfLogged) / (1000 * 60 * 60 * 24));

        if (diffDays <= 0) setLastSymptomText("Today");
        else if (diffDays === 1) setLastSymptomText("Yesterday");
        else setLastSymptomText(`${diffDays} days ago`);
      } catch {
        setLastSymptomText("No logs");
      }
    })();
  }, []);

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />

      <main className="pt-28 max-w-6xl mx-auto px-6 py-8">
        <div className="mb-6">
          <h1 className="text-3xl text-slate-800 font-bold">
            Welcome Back, {greetingName}
          </h1>
          <p className="text-slate-500 mt-1">Here is a quick overview of your health</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-8">
          <DashboardCard
            title="Active Medications"
            mainText={`${medicationCount} Medication${medicationCount === 1 ? "" : "s"}`}
            subText={medicationSubText}
            navPage="/medication"
          />
          <DashboardCard
            title="Next Appointment"
            mainText={nextAppointmentMainText}
            subText={nextAppointmentSubText}
            navPage="/patientAppointments"
          />
          <DashboardCard
            title="Doctor Conversations"
            mainText={`${conversationCount}`}
            subText="Open secure chats"
            navPage="/patientMessages"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <section className="md:col-span-2 bg-white rounded-3xl shadow p-6">
            <h2 className="text-xl font-semibold text-slate-800 mb-4">Upcoming Appointments</h2>

            {upcomingAppointments.length > 0 ? (
              <div className="space-y-3">
                {upcomingAppointments.slice(0, 3).map((appointment) => (
                  <div
                    key={appointment.id}
                    className="rounded-2xl border border-slate-200 bg-white px-4 py-3"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <p className="font-semibold text-slate-800">{doctorName(appointment)}</p>
                      <p className="text-sm text-slate-500">
                        {formatAppointmentDate(appointment.startsAt)} at {formatAppointmentTime(appointment.startsAt)}
                      </p>
                    </div>
                    <p className="text-sm text-slate-500 mt-1">
                      {appointment.location || "Location pending"} | {appointment.notes || "No notes"}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-slate-500 text-sm">No upcoming appointments yet.</div>
            )}
          </section>

          <aside className="bg-white rounded-3xl shadow p-6">
            <h2 className="text-lg font-semibold text-slate-800 mb-4">Quick Actions</h2>

            <div className="flex flex-col gap-3">
              <button
                onClick={() => navigate("/patientAppointments")}
                className="w-full px-4 py-2 rounded-xl bg-sky-100 text-sky-700 font-medium hover:bg-sky-200 transition"
              >
                View Appointments
              </button>

              <button
                onClick={() => navigate("/symptoms")}
                className="w-full px-4 py-2 rounded-xl bg-indigo-100 text-indigo-700 font-medium hover:bg-indigo-200 transition"
              >
                Symptom History
              </button>

              <button
                onClick={() => navigate("/patientMessages")}
                className="w-full px-4 py-2 rounded-xl bg-emerald-100 text-emerald-700 font-medium hover:bg-emerald-200 transition"
              >
                Message Doctor
              </button>
            </div>

            <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
              <p className="text-sm font-medium text-slate-800">Last Symptom Logged</p>
              <p className="text-sm text-slate-500 mt-1">{lastSymptomText}</p>
            </div>
          </aside>
        </div>
      </main>
    </div>
  );
}
