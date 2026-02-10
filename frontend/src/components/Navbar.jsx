import { useLocation, useNavigate } from "react-router-dom";
import logo from "../assets/logo.png";

export default function Navbar() {
    const location = useLocation();
  const navigate = useNavigate();

  const path = location.pathname;

  const isDashboard = path.startsWith("/dashboard");
  const isProfile = path.startsWith("/profile");
  const isLanding = path === "/";

    function handleLogout() {
    localStorage.clear();
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
          {/* Logo */}
          <button
            onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
            className="flex items-center gap-2"
          >
            <img src={logo} alt="Healio logo" className="h-8 w-auto" />
            <span className="font-bold text-slate-800">Healio</span>
          </button>

          {/* Actions */}
          <div className="flex items-center gap-6">
            {isLanding && (
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
            )}

            {isProfile && (
              <>
                <button
                  onClick={() => navigate("/dashboardPatient")}
                  className="text-sm font-medium text-slate-600 hover:text-slate-900 transition"
                >
                  Dashboard
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

            {isDashboard && (
              <>
                <button
                  onClick={() => navigate("/profilePatient")}
                  className="text-sm font-medium text-slate-600 hover:text-slate-900 transition"
                >
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
