import { useEffect, useState } from "react";
import Navbar from "../components/Navbar";
import { useNavigate } from "react-router-dom";

export default function DashboardPatient() {
  const navigate = useNavigate();
  const [role, setRole] = useState("Patient");
  const [name, setName] = useState("Patient");

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
      <Navbar
        onLogin={() => setAuthView("login")}
        onSignup={() => setAuthView("signup")}
      />

      <main className="pt-25 max-w-6xl mx-auto px-6 py-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          
          <section className="md:col-span-2 bg-white rounded-3xl shadow-lg p-6">
            <h2 className="text-xl font-semibold text-slate-800 mb-4">
              Upcoming Appointments
            </h2>

            <div className="text-slate-500 text-sm">
              No upcoming appointments yet.
            </div>
          </section>

          <aside className="bg-white rounded-3xl shadow-lg p-6">
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
