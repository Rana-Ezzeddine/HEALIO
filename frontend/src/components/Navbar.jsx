import { Link, useLocation, useNavigate } from "react-router-dom";
import { useEffect, useRef, useState } from "react";
import { clearSession, getUser } from "../api/http";
import { needsDoctorApprovalHold } from "../utils/authRouting";
import logo from "../assets/logo.png";
import DoctorPatientDock from "./doctor/DoctorPatientDock";

const PUBLIC_PATHS = new Set(["/", "/support", "/privacy", "/terms"]);

const PAGE_PURPOSES = [
  { prefix: "/dashboardpatient", text: "Track daily health activity, tasks, and next care actions in one place." },
  { prefix: "/dashboarddoctor", text: "Review assigned patients and coordinate clinical follow-up efficiently." },
  { prefix: "/dashboardcaregiver", text: "Manage support tasks within the active patient context." },
  { prefix: "/healthsummary", text: "See key health trends, risk signals, and overall progress at a glance." },
  { prefix: "/medication", text: "Review medications, schedules, and adherence details for safer daily care." },
  { prefix: "/symptoms", text: "Log and review symptom history to detect patterns early." },
  { prefix: "/caregiversymptoms", text: "Review patient symptom history and add caregiver observations with source labels." },
  { prefix: "/patientappointments", text: "Schedule, track, and prepare for upcoming appointments." },
  { prefix: "/doctorappointments", text: "Manage appointment requests and coordinate patient visits." },
  { prefix: "/doctor-calendar", text: "Review your schedule visually and manage availability across upcoming sessions." },
  { prefix: "/caregiverappointments", text: "Monitor and support appointment follow-through for the selected patient." },
  { prefix: "/patientmessages", text: "Stay aligned with your care team through secure updates and communication." },
  { prefix: "/caregivermessages", text: "Exchange care updates and communication tied to patient support." },
  { prefix: "/caregivernotes", text: "Capture structured caregiver notes to keep support records clear and actionable." },
  { prefix: "/doctor-patients", text: "Browse your panel and open each patient record quickly." },
  { prefix: "/doctor-patients/requests", text: "Review pending patient link requests before they enter your active panel." },
  { prefix: "/doctor-clinical-notes", text: "Document and review clinical notes to keep treatment decisions traceable." },
  { prefix: "/doctor-treatment-plans", text: "Build and adjust treatment plans based on each patient profile." },
  { prefix: "/caregiver-patients", text: "Manage linked patients and select the right context before taking action." },
  { prefix: "/care-team", text: "View connected care roles and coordination details for your support network." },
  { prefix: "/emergency", text: "Access emergency status and urgent-care information quickly." },
  { prefix: "/profilepatient", text: "Update personal and health profile information used across your care workflow." },
  { prefix: "/profiledoctor", text: "Maintain doctor profile and credentials used for patient trust and approvals." },
  { prefix: "/profilecaregiver", text: "Keep caregiver profile details current for patient visibility and support." },
];

function resolvePagePurpose(pathname) {
  const normalizedPath = String(pathname || "").toLowerCase();
  const match = PAGE_PURPOSES.find(
    (item) => normalizedPath === item.prefix || normalizedPath.startsWith(`${item.prefix}/`)
  );
  return match?.text || "";
}

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
  const [showPageHelp, setShowPageHelp] = useState(false);
  const logoutConfirmRef = useRef(null);
  const moreMenuRef = useRef(null);
  const pageHelpRef = useRef(null);

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
  const isDoctorCalendar = path.toLowerCase().startsWith("/doctor-calendar");
  const isPatientAppointments = path.toLowerCase().startsWith("/patientappointments");
  const isCaregiverAppointments = path.toLowerCase().startsWith("/caregiverappointments");
  const isCaregiverNotes = path.toLowerCase().startsWith("/caregivernotes");
  const isDoctorPatients = path.toLowerCase().startsWith("/doctor-patients");
  const isDoctorLinkRequests = path.toLowerCase().startsWith("/doctor-patients/requests");
  const isDoctorClinicalNotes = path.toLowerCase().startsWith("/doctor-clinical-notes");
  const isDoctorTreatmentPlans = path.toLowerCase().startsWith("/doctor-treatment-plans");
  const isHealthSummary = path.toLowerCase().startsWith("/healthsummary");
  const isPatientMessages = path.toLowerCase().startsWith("/patientmessages");
  const isPatientNotifications = path.toLowerCase().startsWith("/patient-notifications");
  const isCaregiverMessages = path.toLowerCase().startsWith("/caregivermessages");
  const isCaregiverPatients = path.toLowerCase().startsWith("/caregiver-patients");
  const isCaregiverSymptoms = path.toLowerCase().startsWith("/caregiversymptoms");
  const isCaregiverMedications = path.toLowerCase().startsWith("/caregivermedications") || path.toLowerCase().startsWith("/medication");
  const isCaregiverCareConcern = path.toLowerCase().startsWith("/caregivercareconcern");
  const isLanding = path === "/";
  const isPublicPage = PUBLIC_PATHS.has(path.toLowerCase());
  const pagePurpose = isPublicPage ? "" : resolvePagePurpose(path);
  const patientMoreNavItems = isPatient
    ? [
      { label: "Health Summary", href: "/healthSummary", active: isHealthSummary, isDanger: false },
      { label: "Medications", href: "/medication", active: isMedication, isDanger: false },
      { label: "Symptoms", href: "/symptoms", active: isSymptoms, isDanger: false },
      { label: "Care Team", href: "/care-team", active: isCareTeam, isDanger: false },
      { label: "Profile", href: profilePath, active: isProfile, isDanger: false },
      { label: "Emergency", href: "/emergency", active: isEmergency, isDanger: true },
    ]
    : [];
  const isMoreActive = patientMoreNavItems.some((item) => item.active);
  const caregiverMoreNavItems = userRole === "caregiver"
    ? [
      { label: "Appointments", href: "/caregiverAppointments", active: isCaregiverAppointments, isDanger: false },
      { label: "Care Notes", href: "/caregiverNotes", active: isCaregiverNotes, isDanger: false },
      { label: "Medications", href: "/medication", active: isCaregiverMedications, isDanger: false },
      { label: "Symptoms", href: "/caregiverSymptoms", active: isCaregiverSymptoms, isDanger: false },
      { label: "Care Contacts", href: "/caregiverCareConcern", active: isCaregiverCareConcern, isDanger: false },
      { label: "Profile", href: "/profileCaregiver", active: isProfile, isDanger: false },
    ]
    : [];
  const isCaregiverMoreActive = caregiverMoreNavItems.some((item) => item.active);
  const doctorMoreNavItems = isDoctor
    ? doctorApprovalHeld
      ? [
        { label: "Application Status", href: "/doctor-approval-status", active: isDoctorApprovalStatus, isDanger: false },
        { label: "Profile", href: "/profileDoctor", active: isProfile, isDanger: false },
      ]
      : [
        { label: "Appointments", href: "/doctorAppointments", active: isDoctorAppointments, isDanger: false },
        { label: "Link Requests", href: "/doctor-patients/requests", active: isDoctorLinkRequests, isDanger: false },
        { label: "Clinical Notes", href: "/doctor-clinical-notes", active: isDoctorClinicalNotes, isDanger: false },
        { label: "Treatment Plans", href: "/doctor-treatment-plans", active: isDoctorTreatmentPlans, isDanger: false },
        { label: "Profile", href: "/profileDoctor", active: isProfile, isDanger: false },
      ]
    : [];
  const isDoctorMoreActive = doctorApprovalHeld
    ? doctorMoreNavItems.some((item) => item.active)
    : isDoctorAppointments || isDoctorLinkRequests || isDoctorClinicalNotes || isDoctorTreatmentPlans || isProfile;

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
    if (!showPageHelp) return;

    function handleOutsideClick(event) {
      if (!pageHelpRef.current?.contains(event.target)) {
        setShowPageHelp(false);
      }
    }

    function handleEscape(event) {
      if (event.key === "Escape") {
        setShowPageHelp(false);
      }
    }

    document.addEventListener("mousedown", handleOutsideClick);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [showPageHelp]);

  useEffect(() => {
    setShowMoreMenu(false);
    setShowPageHelp(false);
  }, [path]);

  function handleLogout() {
    clearSession();
    setShowLogoutConfirm(false);
    navigate("/");
  }

  return (
    <>
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
                    onClick={() => navigate("/doctor-calendar")}
                    className={`text-sm font-medium transition ${
                      isDoctorCalendar ? "text-sky-700 font-semibold" : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    Calendar
                  </button>
                )}
                {isDoctor && !doctorApprovalHeld && (
                  <button
                    onClick={() => navigate("/doctor-patients")}
                    className={`text-sm font-medium transition ${
                      isDoctorPatients && !isDoctorLinkRequests ? "text-sky-700 font-semibold" : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    Patients
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
                {userRole === "caregiver" && (
                  <button
                    onClick={() => navigate("/caregiver-patients")}
                    className={`text-sm font-medium transition ${
                      isCaregiverPatients ? "text-sky-700 font-semibold" : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    My Patients
                  </button>
                )}
                {isPatient && (
                  <button
                    onClick={() => navigate("/patient-notifications")}
                    className={`group inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-semibold transition ${
                      isPatientNotifications
                        ? "border-indigo-300 bg-indigo-50 text-indigo-800 shadow-sm"
                        : "border-slate-200 text-slate-600 hover:border-indigo-200 hover:bg-indigo-50/70 hover:text-indigo-700"
                    }`}
                  >
                    <span className={`h-2 w-2 rounded-full transition ${isPatientNotifications ? "bg-indigo-500" : "bg-slate-300 group-hover:bg-indigo-400"}`} />
                    Notifications
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
                    className={`group inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-semibold transition ${
                      isCaregiverMessages
                        ? "border-cyan-300 bg-cyan-50 text-cyan-800 shadow-sm"
                        : "border-slate-200 text-slate-600 hover:border-cyan-200 hover:bg-cyan-50/70 hover:text-cyan-700"
                    }`}
                  >
                    <span className={`h-2 w-2 rounded-full transition ${isCaregiverMessages ? "bg-cyan-500" : "bg-slate-300 group-hover:bg-cyan-400"}`} />
                    Updates & Communication
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

                {userRole === "caregiver" && caregiverMoreNavItems.length > 0 && (
                  <div ref={moreMenuRef} className="relative">
                    <button
                      onClick={() => setShowMoreMenu((current) => !current)}
                      className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-semibold transition ${
                        isCaregiverMoreActive
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
                      <div className="absolute right-0 top-full z-50 mt-2 w-60 rounded-2xl border border-slate-200 bg-white p-2 shadow-xl">
                        {caregiverMoreNavItems.map((item) => (
                          <button
                            key={item.href}
                            type="button"
                            onClick={() => navigate(item.href)}
                            className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm font-medium transition ${
                              item.active
                                ? "bg-sky-50 text-sky-700"
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

                {isDoctor && doctorMoreNavItems.length > 0 && (
                  <div ref={moreMenuRef} className="relative">
                    <button
                      onClick={() => setShowMoreMenu((current) => !current)}
                      className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-semibold transition ${
                        isDoctorMoreActive
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
                      <div className="absolute right-0 top-full z-50 mt-2 w-60 rounded-2xl border border-slate-200 bg-white p-2 shadow-xl">
                        {doctorMoreNavItems.map((item) => (
                          <button
                            key={item.href}
                            type="button"
                            onClick={() => navigate(item.href)}
                            className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm font-medium transition ${
                              item.active
                                ? "bg-sky-50 text-sky-700"
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

                {!isPatient && userRole !== "caregiver" && !isDoctor && (
                  <button
                    onClick={() => navigate(profilePath)}
                    className={`text-sm font-medium transition ${isProfile ? "text-sky-700 font-semibold" : "text-slate-600 hover:text-slate-900"
                      }`}
                  >
                    Profile
                  </button>
                )}

                {pagePurpose ? (
                  <div ref={pageHelpRef} className="relative">
                    <button
                      type="button"
                      onClick={() => setShowPageHelp((current) => !current)}
                      className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-600 transition hover:border-sky-200 hover:bg-sky-50 hover:text-sky-700"
                    >
                      <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-slate-100 text-xs font-bold text-slate-600">?</span>
                      <span className="hidden sm:inline">About this page</span>
                    </button>

                    {showPageHelp ? (
                      <div className="absolute right-0 top-full z-50 mt-3 w-80 max-w-[calc(100vw-3rem)] rounded-2xl border border-slate-200 bg-white p-4 shadow-xl">
                        <p className="text-xs font-semibold uppercase tracking-wide text-sky-700">Page purpose</p>
                        <p className="mt-2 text-sm leading-6 text-slate-700">{pagePurpose}</p>
                      </div>
                    ) : null}
                  </div>
                ) : null}

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
      {isDoctor && !doctorApprovalHeld ? <DoctorPatientDock /> : null}
    </>
  );
}
