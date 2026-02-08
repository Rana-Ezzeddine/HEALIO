import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

export default function DashboardPatient1() {
  const navigate = useNavigate();
  const [role, setRole] = useState(null);
  const [name, setName] = useState(null);

  useEffect(() => {
    try {
      const r = localStorage.getItem("userRole");
      setRole(r || "patient");
      const firstName = localStorage.getItem("firstName") || "Patient";
      setName(firstName);
    } catch (err) {
      console.error(err);
    }
  }, []);

<<<<<<< HEAD
function handleLogout() {
  try {
    localStorage.removeItem("accessToken");
    localStorage.removeItem("user");

    localStorage.removeItem("userRole");
    localStorage.removeItem("firstName");
  } catch (err) {
    console.error(err);
=======
  function handleLogout() {
    try {
      localStorage.removeItem("userRole");
    } catch (err) {
      console.error(err);
    }
    navigate("/");
>>>>>>> frontend-roua
  }
  navigate("/");
}


  return (
    <div className="min-h-screen bg-gradient-to-b from-[#e6f7ff] to-white p-6">
      <header className="max-w-6xl mx-auto flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Welcome, {name}</h1>
          <p className="text-sm font-semibold text-slate-600">Role: {role}</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => navigate('/profilePatient')}
            className="px-4 py-2 bg-sky-600 text-white rounded-lg hover:bg-sky-500">
            Profile
          </button>
          <button
            onClick={handleLogout}
            className="px-4 py-2 bg-white border border-sky-700 text-sky-700 hover:bg-slate-100 rounded-lg">
            Logout
          </button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-6">
        <section className="col-span-2 bg-white p-6 rounded-xl shadow">
          <h2 className="text-lg font-semibold mb-3">Upcoming Appointments</h2>
          <div className="text-sm text-slate-600">No upcoming appointments — book one to get started.</div>
        </section>

        <aside className="bg-white p-6 rounded-xl shadow">
          <h3 className="text-md font-semibold mb-3">Quick Actions</h3>
          <div className="flex flex-col gap-2">
            <button
              onClick={() => navigate('/appointments')}
              className="text-left px-3 py-2 bg-sky-100 hover:bg-sky-50 rounded-md">Book Appointment</button>
            <button
              onClick={() => navigate('/records')}
              className="text-left px-3 py-2 bg-sky-100 hover:bg-sky-50 rounded-md">View Medical Records</button>
            <button
              onClick={() => navigate('/messages')}
              className="text-left px-3 py-2 bg-sky-100 hover:bg-sky-50 rounded-md">Messages</button>
          </div>
        </aside>
      </main>
    </div>
  );
}