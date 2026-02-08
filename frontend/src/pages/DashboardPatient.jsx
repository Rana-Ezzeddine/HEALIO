import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

export default function DashboardPatient() {
  const navigate = useNavigate();
  const [role, setRole] = useState(null);
  const [name, setName] = useState("Patient");

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
    <div className="min-h-screen bg-gradient-to-b from-sky-100 to-white">
      <header className="max-w-6xl flex p-6 items-center justify-between mx-auto">
        <div>
          <h1 className="font-bold text-slate-800 text-3xl">Welcome, {name}</h1>
          <p className="text-sm font-semibold text-slate-600">Role: {role || 'Patient'}</p>
        </div>
        <div className="flex gap-3">
          <button
            type="button"
            className="bg-sky-600 px-4 py-2 text-white rounded-lg px-4 py-2 hover:bg-sky-500">
            Notifications
          </button>
          <button
            type="button"
            onClick={() => navigate("/profilePatient")}
            className="bg-sky-600 px-4 py-2 text-white rounded-lg px-4 py-2 hover:bg-sky-500">
            Profile
          </button>
          <button
            type="button"
            onClick={handleLogout}
            className="bg-white px-4 py-2 text-slate-800 border border-slate-800 rounded-lg px-4 py-2 hover:bg-sky-50">
            Logout
          </button>
        </div>
      </header>
      <main className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-3 ">
        <section className="col-span-2 bg-white">
          <h2>Upcoming appointments</h2>
        </section>
      </main>
    </div>
  );
}