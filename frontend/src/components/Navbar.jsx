import { Link, useLocation, useNavigate } from "react-router-dom";
import { useEffect, useRef, useState } from "react";
import { clearSession, getUser } from "../api/http";
import { needsDoctorApprovalHold } from "../utils/authRouting";
import logo from "../assets/logo.png";

const PUBLIC_PATHS = new Set(["/", "/support", "/privacy", "/terms"]);

function PublicNavLink({ to, children }) {
  const isAnchor = to.startsWith("#");

  if (isAnchor) {
    return (
      <a href={to} className="text-sm font-medium text-slate-600 transition hover:text-slate-900">
        {children}
      </a>
    );
  }

  return (
    <Link to={to} className="text-sm font-medium text-slate-600 transition hover:text-slate-900">
      {children}
    </Link>
  );
}

export default function Navbar({ onLogin, onSignup }) {
  const location = useLocation();
  const navigate = useNavigate();
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const logoutConfirmRef = useRef(null);
  const moreMenuRef = useRef(null);

  const user = getUser();
  const userRole = user?.role?.toLowerCase() || null;
  const isDoctor = userRole === "doctor";
  const isPatient = userRole === "patient";
  const doctorApprovalHeld = needsDoctorApprovalHold(user);
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
  const homePath = isDoctor && doctorApprovalHeld ? "/doctor-approval-status" : dashboardPath;

  const path = location.pathname;
  const isDashboard = path.toLowerCase().startsWith("/dashboard");
  const isProfile = path.toLowerCase().startsWith("/profile");
  const isDoctorApprovalStatus = path.toLowerCase().startsWith("/doctor-approval-status");
  const isMedication = path.toLowerCase().startsWith("/medication");
  const isSymptoms = path.toLowerCase().startsWith("/symptoms");
  const isCareTeam = path.toLowerCase().startsWith("/care-team");
  const isEmergency = path.toLowerCase().startsWith("/emergency");
  const isDoctorAppointments = path.toLowerCase().startsWith("/doctorappointments");
  const isPatientAppointments = path.toLowerCase().startsWith("/patientappointments");
  const isPatientMessages = path.toLowerCase().startsWith("/patientmessages");
  const isCaregiverMessages = path.toLowerCase().startsWith("/caregivermessages");
  const isLanding = path === "/";
  const isPublicPage = PUBLIC_PATHS.has(path.toLowerCase());
  const patientMoreNavItems = isPatient
    ? [
      { label: "Medications", href: "/medication", active: isMedication, isDanger: false },
      { label: "Symptoms", href: "/symptoms", active: isSymptoms, isDanger: false },
      { label: "Care Team", href: "/care-team", active: isCareTeam, isDanger: false },
      { label: "Profile", href: profilePath, active: isProfile, isDanger: false },
      { label: "Emergency", href: "/emergency", active: isEmergency, isDanger: true },
    ]
    : [];
  const isMoreActive = patientMoreNavItems.some((item) => item.active);

  useEffect(() => {
    if (!showLogoutConfirm) return;

    function handleOutsideClick(event) {
      if (!logoutConfirmRef.current?.contains(event.target)) {
        setShowLogoutConfirm(false);
      }
    }

    function handleEscape(event) {
      if (event.key === "Escape") {
        setShowLogoutConfirm(false);
      }
    }

    document.addEventListener("mousedown", handleOutsideClick);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [showLogoutConfirm]);

  useEffect(() => {
    if (!showMoreMenu) return;

    function handleOutsideClick(event) {
      if (!moreMenuRef.current?.contains(event.target)) {
        setShowMoreMenu(false);
      }
    }

    function handleEscape(event) {
      if (event.key === "Escape") {
        setShowMoreMenu(false);
      }
    }

    document.addEventListener("mousedown", handleOutsideClick);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [showMoreMenu]);

  useEffect(() => {
    setShowMoreMenu(false);
  }, [path]);

  function handleLogout() {
    clearSession();
    setShowLogoutConfirm(false);
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
            onClick={() => navigate("/")}
            className="flex items-center gap-2"
          >
            <img src={logo} alt="Healio logo" className="h-8 w-auto" />
            <span className="font-bold text-slate-800">Healio</span>
          </button>

          <div className="flex items-center gap-6">
            {isPublicPage ? (
              <>
                <nav className="hidden items-center gap-5 lg:flex">
                  <PublicNavLink to={isLanding ? "#roles" : "/#roles"}>Roles</PublicNavLink>
                  <PublicNavLink to={isLanding ? "#features" : "/#features"}>Features</PublicNavLink>
                  <PublicNavLink to={isLanding ? "#how-it-works" : "/#how-it-works"}>How It Works</PublicNavLink>
                  <PublicNavLink to={isLanding ? "#trust" : "/#trust"}>Trust & Safety</PublicNavLink>
                  <PublicNavLink to="/support">Support</PublicNavLink>
                  <PublicNavLink to="/privacy">Privacy</PublicNavLink>
                  <PublicNavLink to="/terms">Terms</PublicNavLink>
                </nav>

                <button
                  onClick={() => (isLanding && onLogin ? onLogin() : navigate("/loginPage"))}
                  className="text-sm font-medium text-slate-600 hover:text-slate-900 transition"
                >
                  Login
                </button>

                <button
                  onClick={() => (isLanding && onSignup ? onSignup() : navigate("/signup"))}
                  className="rounded-lg bg-sky-500 px-5 py-2 text-sm font-semibold text-white
                            hover:bg-sky-600 transition shadow"
                >
                  Sign Up
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() => navigate(homePath)}
                  className={`text-sm font-medium transition ${
                    isDoctor && doctorApprovalHeld
                      ? isDoctorApprovalStatus
                        ? "text-sky-700 font-semibold"
                        : "text-slate-600 hover:text-slate-900"
                      : isDashboard
                        ? "text-sky-700 font-semibold"
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                >
                  {isDoctor && doctorApprovalHeld ? "Application Status" : "Dashboard"}
                </button>

                {isDoctor && !doctorApprovalHeld && (
                  <button
                    onClick={() => navigate("/doctorAppointments")}
                    className={`text-sm font-medium transition ${
                      isDoctorAppointments ? "text-sky-700 font-semibold" : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    Appointments
                  </button>
                )}
                {isPatient && (
                  <button
                    onClick={() => navigate("/patientAppointments")}
                    className={`text-sm font-medium transition ${
                      isPatientAppointments ? "text-sky-700 font-semibold" : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    Appointments
                  </button>
                )}
                {isPatient && (
                  <button
                    onClick={() => navigate("/patientMessages")}
                    className={`group inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-semibold transition ${
                      isPatientMessages
                        ? "border-cyan-300 bg-cyan-50 text-cyan-800 shadow-sm"
                        : "border-slate-200 text-slate-600 hover:border-cyan-200 hover:bg-cyan-50/70 hover:text-cyan-700"
                    }`}
                  >
                    <span className={`h-2 w-2 rounded-full transition ${isPatientMessages ? "bg-cyan-500" : "bg-slate-300 group-hover:bg-cyan-400"}`} />
                    Updates & Communication
                  </button>
                )}
                {userRole === "caregiver" && (
                  <button
                    onClick={() => navigate("/caregiverMessages")}
                    className={`text-sm font-medium transition ${
                      isCaregiverMessages ? "text-sky-700 font-semibold" : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    Messages
                  </button>
                )}
                {isPatient && patientMoreNavItems.length > 0 && (
                  <div ref={moreMenuRef} className="relative">
                    <button
                      onClick={() => setShowMoreMenu((current) => !current)}
                      className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-semibold transition ${
                        isMoreActive
                          ? "border-sky-300 bg-sky-50 text-sky-800"
                          : "border-slate-200 text-slate-600 hover:border-sky-200 hover:bg-sky-50 hover:text-sky-700"
                      }`}
                    >
                      More
                      <svg
                        viewBox="0 0 20 20"
                        fill="currentColor"
                        className={`h-4 w-4 transition ${showMoreMenu ? "rotate-180" : "rotate-0"}`}
                        aria-hidden="true"
                      >
                        <path d="M5.25 7.5a.75.75 0 011.06 0L10 11.19l3.69-3.69a.75.75 0 111.06 1.06l-4.22 4.22a.75.75 0 01-1.06 0L5.25 8.56a.75.75 0 010-1.06z" />
                      </svg>
                    </button>

                    {showMoreMenu ? (
                      <div className="absolute right-0 top-full z-50 mt-2 w-52 rounded-2xl border border-slate-200 bg-white p-2 shadow-xl">
                        {patientMoreNavItems.map((item) => (
                          <button
                            key={item.href}
                            type="button"
                            onClick={() => navigate(item.href)}
                            className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm font-medium transition ${
                              item.active
                                ? item.isDanger
                                  ? "bg-rose-50 text-rose-700"
                                  : "bg-sky-50 text-sky-700"
                                : item.isDanger
                                  ? "text-rose-600 hover:bg-rose-50"
                                  : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                            }`}
                          >
                            <span>{item.label}</span>
                            {item.active ? <span className="text-xs font-semibold">Open</span> : null}
                          </button>
                        ))}
                      </div>
                    ) : null}
                  </div>
                )}

                {!isPatient && (
                  <button
                    onClick={() => navigate(profilePath)}
                    className={`text-sm font-medium transition ${isProfile ? "text-sky-700 font-semibold" : "text-slate-600 hover:text-slate-900"
                      }`}
                  >
                    Profile
                  </button>
                )}

                <div ref={logoutConfirmRef} className="relative">
                  <button
                    onClick={() => setShowLogoutConfirm((current) => !current)}
                    className="rounded-lg bg-sky-500 px-5 py-2 text-sm font-semibold text-white
                              hover:bg-sky-600 transition shadow"
                  >
                    Logout
                  </button>

                  {showLogoutConfirm ? (
                    <div className="absolute right-0 top-full z-50 mt-3 w-80 max-w-[calc(100vw-3rem)] rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl">
                      <h2 className="text-xl font-extrabold text-slate-900">Log Out?</h2>
                      <p className="mt-2 text-sm leading-6 text-slate-600">
                        Are you sure you want to log out? Your current session will be cleared on this device.
                      </p>
                      <div className="mt-5 flex gap-3">
                        <button
                          type="button"
                          onClick={() => setShowLogoutConfirm(false)}
                          className="h-11 flex-1 rounded-xl border border-slate-300 text-slate-700 font-semibold hover:bg-slate-50 transition"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={handleLogout}
                          className="h-11 flex-1 rounded-xl bg-sky-500 text-white font-semibold hover:bg-sky-600 transition"
                        >
                          Log Out
                        </button>
                      </div>
                    </div>
                  ) : null}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
