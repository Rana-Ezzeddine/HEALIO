import { useEffect, useState } from "react";
import Navbar from "../components/Navbar";
import { useNavigate } from "react-router-dom";

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

export default function DashboarDoctor() {
  const navigate = useNavigate();
  const [role, setRole] = useState("Doctor");
  const [name, setName] = useState("Doctor");

  useEffect(() => {
    try {
      const r = localStorage.getItem("userRole");
      setRole(r || "Doctor");

      const firstName = localStorage.getItem("firstName") || "Doctor";
      setName(firstName);
    } catch (err) {
      console.error(err);
    }
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
          <h1 className="text-3xl text-slate-800 font-bold">Welcome Back, Dr. {name} 👋</h1>
          <p className="text-slate-500 mt-1">Here's a quick overview of your health</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-8">
          <DashboardCard
            title="🗓 Today's Appointments" 
            mainText="8 Apointments"
            subText="Next: 2:30 - Sarah Khalil"
          />
          <DashboardCard
            title="📩 New Messages"
            mainText="3 unread"
            navPage = "/doctorMessages"
          />
          <DashboardCard
            title="⚠️ Critical Alerts"
            mainText="2 patients flagged"
          />
          
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          
          <section className="md:col-span-2 bg-white rounded-3xl shadow p-6">
            <h2 className="text-xl font-semibold text-slate-800 mb-4">
              Today's Schedule
            </h2>

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
                    <tr className="hover:bg-slate-50">
                      <td className="py-3 px-4">2:30 PM</td>
                      <td className="py-3 px-4 font-medium">Sarah Khalil</td>
                      <td className="py-3 px-4">Follow-up</td>
                      <td className="py-3 px-4">
                        <span className="px-2 py-1 text-xs rounded-full bg-yellow-100 text-yellow-700">
                          Upcoming
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <button className="text-sky-600 hover:underline">
                          Open
                        </button>
                      </td>
                    </tr>
                  </tbody>
              </table>
            </div>
          </section>

          <aside className="bg-white rounded-3xl shadow p-6">
            <h2 className="text-lg font-semibold text-slate-800 mb-4">
              Doctor Tools
            </h2>

            <div className="flex flex-col gap-3">
              <button
                className="w-full px-4 py-2 rounded-xl bg-sky-100 text-sky-700 font-medium hover:bg-sky-200 transition"
              >
                ➕ Add Prescription
              </button>

              <button
                className="w-full px-4 py-2 rounded-xl bg-indigo-100 text-indigo-700 font-medium hover:bg-indigo-200 transition"
              >
                📝 Create Medical Report
              </button>

              <button
                className="w-full px-4 py-2 rounded-xl bg-emerald-100 text-emerald-700 font-medium hover:bg-emerald-200 transition"
              >
                📅 Schedule Appointment
              </button>

              <button
                className="w-full px-4 py-2 rounded-xl bg-cyan-100 text-cyan-700 font-medium hover:bg-cyan-200 transition"
              >
                📂 View All Patients
              </button>
            </div>
          </aside>
        </div>
      </main>
    </div>
  );
}
