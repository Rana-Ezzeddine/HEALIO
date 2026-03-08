import { useLocation, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import logo from "../assets/logo.png";

export default function Navbar() {
  const location = useLocation();
  const navigate = useNavigate();

  const [userRole, setUserRole] = useState(
    localStorage.getItem("userRole")?.toLowerCase()
  );

  useEffect(() => {
    const role = localStorage.getItem("userRole")?.toLowerCase();
    setUserRole(role);
  }, [location]); // re-check role when route changes

  const isDoctor = userRole === "doctor";
  const isPatient = userRole === "patient";
  const dashboardPathByRole = {
    doctor: "/dashboardDoctor",
    patient: "/dashboardPatient",
    caregiver: "/dashboardCaregiver",
  };
  const profilePathByRole = {
    doctor: "/profileDoctor",
    patient: "/profilePatient",
    caregiver: "/profileCaregiver",
  };
  const dashboardPath = dashboardPathByRole[userRole] || "/dashboardPatient";
  const profilePath = profilePathByRole[userRole] || "/profilePatient";

  const path = location.pathname;
  const isDashboard = path.toLowerCase().startsWith("/dashboard");
  const isProfile = path.toLowerCase().startsWith("/profile");
  const isMedication = path.toLowerCase().startsWith("/medication");
  const isDoctorMessages = path.toLowerCase().startsWith("/doctormessages");
  const isPatientMessages = path.toLowerCase().startsWith("/patientmessages");
  const isLanding = path === "/";

  function handleLogout() {
    localStorage.clear();
    setUserRole(null);
    navigate("/");
  }

  return (
    <header className="fixed top-0 left-0 w-full z-40">
      <div className="mx-auto max-w-7xl px-6 py-4">
        <div
          className="flex items-center justify-between rounded-2xl
                     bg-white/70 backdrop-blur-md border border-white/60
                     shadow-sm px-6 py-3"
        >
          
          <button
            onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
            className="flex items-center gap-2"
          >
            <img src={logo} alt="Healio logo" className="h-8 w-auto" />
            <span className="font-bold text-slate-800">Healio</span>
          </button>

          {/* Actions */}
          <div className="flex items-center gap-6">
            {isLanding ? (
              <>
                <button
                  onClick={() => navigate("/loginPage")}
                  className="text-sm font-medium text-slate-600 hover:text-slate-900 transition"
                >
                  Login
                </button>

                <button
                  onClick={() => navigate("/signup")}
                  className="rounded-lg bg-sky-500 px-5 py-2 text-sm font-semibold text-white
                            hover:bg-sky-600 transition shadow"
                >
                  Sign Up
                </button>
              </>
            ) : (
              
              <>
              <button
                onClick={() => navigate(dashboardPath)}
                className={`text-sm font-medium transition ${
                isDashboard ? "text-sky-700 font-semibold" : "text-slate-600 hover:text-slate-900"
              }`}>
                Dashboard
              </button>
              {!isDoctor && (
                <>
                  <button
                    onClick={() => navigate("/medication")}
                    className={`text-sm font-medium transition ${
                    isMedication ? "text-sky-700 font-semibold" : "text-slate-600 hover:text-slate-900"
                  }`}>
                    Medications
                  </button>
                </>
              )}
              {isDoctor && (
                <button
                  onClick={() => navigate("/doctorMessages")}
                  className={`text-sm font-medium transition ${
                    isDoctorMessages ? "text-sky-700 font-semibold" : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  Messages
                </button>
              )}
              {isPatient && (
                <button
                  onClick={() => navigate("/patientMessages")}
                  className={`text-sm font-medium transition ${
                    isPatientMessages ? "text-sky-700 font-semibold" : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  Messages
                </button>
              )}
              
              <button
                onClick={() => navigate(profilePath)}
                className={`text-sm font-medium transition ${
                isProfile ? "text-sky-700 font-semibold" : "text-slate-600 hover:text-slate-900"
              }`}>
                Profile
              </button>
              
              <button
                onClick={handleLogout}
                className="rounded-lg bg-sky-500 px-5 py-2 text-sm font-semibold text-white
                            hover:bg-sky-600 transition shadow"
              >
                Logout
              </button>
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
