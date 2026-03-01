import { useEffect, useState } from "react";
import Navbar from "../components/Navbar";
import { useNavigate } from "react-router-dom";
import { apiUrl, authHeaders } from "../api/http";

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
  const [medicationCount, setMedicationCount] = useState(0);
  const [medicationSubText, setMedicationSubText] = useState("No medications added yet");
  const [lastSymptomText, setLastSymptomText] = useState("No logs");

  useEffect(() => {
    try {
      const r = localStorage.getItem("userRole");
      setRole(r || "Patient");

      const firstName = localStorage.getItem("firstName") || "Patient";
      setName(firstName);
    } catch (err) {
      console.error(err);
    }
  }, []);

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
        setMedicationSubText(
          list.length > 0 ? `Latest: ${list[0]?.name || "Medication"}` : "No medications added yet"
        );
      } catch (err) {
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
        if (!rawDate) {
          setLastSymptomText("No logs");
          return;
        }

        const loggedDate = new Date(rawDate);
        const today = new Date();
        const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
        const startOfLogged = new Date(loggedDate.getFullYear(), loggedDate.getMonth(), loggedDate.getDate());
        const diffDays = Math.round((startOfToday - startOfLogged) / (1000 * 60 * 60 * 24));

        if (diffDays === 0) setLastSymptomText("Today");
        else if (diffDays === 1) setLastSymptomText("Yesterday");
        else setLastSymptomText(loggedDate.toLocaleDateString(undefined, { month: "short", day: "numeric" }));
      } catch (err) {
        setLastSymptomText("No logs");
      }
    })();
  }, []);

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
            mainText={`${medicationCount} Medication${medicationCount === 1 ? "" : "s"}`}
            subText={medicationSubText}
            navPage="/medication"
          />
          <DashboardCard
            title="📅 Next Appointment"
            mainText="Mar 22"
            subText="In 3 days"
          />
          <DashboardCard
            title="🤒 Last Symptom Logged"
            mainText={lastSymptomText}
            navPage="/symptoms"
          />
          
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          
          <section className="md:col-span-2 bg-white rounded-3xl shadow p-6">
            <h2 className="text-xl font-semibold text-slate-800 mb-4">
              Upcoming Appointments
            </h2>

            <div className="text-slate-500 text-sm">
              No upcoming appointments yet.
            </div>
          </section>

          <aside className="bg-white rounded-3xl shadow p-6">
            <h2 className="text-lg font-semibold text-slate-800 mb-4">
              Quick Actions
            </h2>

            <div className="flex flex-col gap-3">
              <button
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
