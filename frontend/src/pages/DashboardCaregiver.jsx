import { useEffect, useState } from "react";
import Navbar from "../components/Navbar";
import { useNavigate } from "react-router-dom";
import { apiUrl, authHeaders, getUser } from "../api/http";

function DashboardCard({title, mainText, subText, navPage}){
  const navigate = useNavigate();
  const isClickable = Boolean(navPage);

  return(
    <div 
      onClick={isClickable ? () => navigate(navPage) : undefined}
      className={`group bg-white shadow-lg p-4 rounded-2xl transition ${
        isClickable
          ? "cursor-pointer hover:bg-slate-100 hover:shadow-md hover:-translate-y-1"
          : "cursor-default"
      }`}>
      <div className="flex justify-between items-start">
        <div>
          <h3 className="text-slate-500 text-sm">{title}</h3>
          <p className="text-slate-800 font-bold text-2xl">{mainText}</p>
          {subText &&(
            <p className="text-sky-600 font-medium text-sm mt-1">{subText}</p>
          )}
        </div>
          {isClickable ? (
            <span className="text-slate-400 text-xs group-hover:text-slate-600">View →</span>
          ) : null}
      </div>
    </div>
  );
}

export default function DashboardCaregiver() {
  const navigate = useNavigate();

  const user = getUser();
  const [name, setName] = useState(user?.firstName || user?.email || "Caregiver");
  const [linkedPatientLabel, setLinkedPatientLabel] = useState("No active patients linked yet");


  useEffect(() => {
    const done = localStorage.getItem("caregiverOnboardingComplete");
    if (!done) navigate("/caregiverOnboarding");
  }, [navigate]);
  


  useEffect(() => {
    setName(user?.firstName || user?.email || "Caregiver");

    (async () => {
      try {
        const res = await fetch(`${apiUrl}/api/caregivers/patients`, {
          headers: { "Content-Type": "application/json", ...authHeaders() },
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.message || "Failed to load caregiver patients.");

        const patients = data.patients || [];
        if (patients.length > 0) {
          setLinkedPatientLabel(patients.map(({ patient }) => patient?.email || "Patient").join(", "));
        }
      } catch (err) {
        console.error(err);
      }
    })();
  }, [user?.email, user?.firstName]);

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar/>

      <main className="pt-28 max-w-6xl mx-auto px-6 py-8">
        <div className="mb-6">
          <h1 className="text-3xl text-slate-800 font-bold">Welcome Back, {name} 👋</h1>
          <p className="text-slate-500 mt-1">Here&apos;s a quick overview for the patient you care for.</p>
          <p className="text-slate-600 mt-2 text-sm">
            Caring for: <span className="font-semibold">{linkedPatientLabel}</span>
          </p>
        </div>
        
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-8">
          <DashboardCard
            title="💊 Medications Due"
            mainText="2 Due Today"
            subText="Next dose: Paracetamol - 8:00 PM"
            navPage="/medication"
          />
          <DashboardCard
            title="📅 Next Appointment (Patient)"
            mainText="Mar 22"
            subText="In 3 days"
          />
          <DashboardCard
            title="🤒 Symptom Status"
            mainText="Last log: Yesterday"
            navPage="/symptoms"
          />
          
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          
          <section className="md:col-span-2 bg-white rounded-3xl shadow p-6">
            <h2 className="text-xl font-semibold text-slate-800 mb-4">
              Patient Care Timeline
            </h2>

            <div className="text-slate-500 text-sm">
              No upcoming care events yet.
            </div>
          </section>

          <aside className="bg-white rounded-3xl shadow p-6">
            <h2 className="text-lg font-semibold text-slate-800 mb-4">
              Quick Actions
            </h2>

            <div className="flex flex-col gap-3">
              <button
                onClick={() => navigate("/medication")}
                className="w-full px-4 py-2 rounded-xl bg-sky-100 text-sky-700 font-medium hover:bg-sky-200 transition"
              >
                Log Medication Taken
              </button>

              <button
                onClick={() => navigate("/symptoms")}
                className="w-full px-4 py-2 rounded-xl bg-indigo-100 text-indigo-700 font-medium hover:bg-indigo-200 transition"
              >
                Record Symptoms
              </button>

              <button
                
                className="w-full px-4 py-2 rounded-xl bg-emerald-100 text-emerald-700 font-medium hover:bg-emerald-200 transition"
              >
                View Care Notes
              </button>
            </div>
          </aside>
        </div>
      </main>
    </div>
  );
}
