import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "../components/Navbar";
import { apiUrl, authHeaders, getUser } from "../api/http";
import { getMyAppointments } from "../api/appointments";
import { getConversations } from "../api/messaging";
import { getDoctorLinkRequests, getMyCaregivers, getMyDoctors } from "../api/links";
import { buildPatientSetupChecklist } from "../utils/patientSetup";
import { formatDoseTime, getNextMedicationDose, isActiveMedication } from "../utils/medicationSchedule";

function formatAppointmentDate(dateLike) {
  return new Date(dateLike).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function formatAppointmentTime(dateLike) {
  return new Date(dateLike).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function doctorName(appointment) {
  return appointment.doctor?.displayName || appointment.doctor?.email || "Doctor";
}

function DashboardCard({ title, mainText, subText, navPage }) {
  const navigate = useNavigate();

  return (
    <button
      type="button"
      onClick={() => navigate(navPage)}
      className="group rounded-3xl bg-white p-5 text-left shadow-sm transition hover:-translate-y-1 hover:bg-slate-50 hover:shadow-md"
    >
      <div className="flex items-start justify-between gap-1">
        <div>
          <h3 className="text-sm text-slate-500">{title}</h3>
          <p className="mt-1 text-2xl font-bold text-slate-900">{mainText}</p>
          {subText ? <p className="mt-2 text-sm font-medium text-sky-700">{subText}</p> : null}
        </div>
        <span className="text-xs text-slate-400 transition group-hover:text-slate-600">Open</span>
      </div>
    </button>
  );
}

export default function DashboardPatient() {
  const navigate = useNavigate();
  const user = getUser();
  const [appointments, setAppointments] = useState([]);
  const [conversationCount, setConversationCount] = useState(0);
  const [medications, setMedications] = useState([]);
  const [symptoms, setSymptoms] = useState([]);
  const [profile, setProfile] = useState({});
  const [doctorCount, setDoctorCount] = useState(0);
  const [caregiverCount, setCaregiverCount] = useState(0);
  const [pendingDoctorRequestCount, setPendingDoctorRequestCount] = useState(0);
  const [reloadKey, setReloadKey] = useState(0);

  const greetingName =
    profile?.firstName || user?.firstName || localStorage.getItem("firstName") || user?.email || "Patient";

  useEffect(() => {
    function refreshDashboard() {
      setReloadKey((current) => current + 1);
    }

    function onStorage(event) {
      if (event.key === "healio:profile-updated") {
        refreshDashboard();
      }
    }

    window.addEventListener("focus", refreshDashboard);
    window.addEventListener("storage", onStorage);

    return () => {
      window.removeEventListener("focus", refreshDashboard);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadDashboardData() {
      const results = await Promise.allSettled([
        getMyAppointments(),
        getConversations(),
        fetch(`${apiUrl}/api/medications`, {
          headers: { "Content-Type": "application/json", ...authHeaders() },
        }).then((res) => (res.ok ? res.json() : [])),
        fetch(`${apiUrl}/api/symptoms`, {
          headers: { "Content-Type": "application/json", ...authHeaders() },
        }).then((res) => (res.ok ? res.json() : [])),
        fetch(`${apiUrl}/api/profile`, {
          headers: { "Content-Type": "application/json", ...authHeaders() },
        }).then(async (res) => {
          if (res.status === 404) return {};
          if (!res.ok) throw new Error("Failed to load profile");
          return res.json().catch(() => ({}));
        }),
        getMyDoctors(),
        getMyCaregivers(),
        getDoctorLinkRequests(),
      ]);

      if (cancelled) return;

      const [appointmentsResult, conversationsResult, medicationsResult, symptomsResult, profileResult, doctorsResult, caregiversResult, doctorRequestsResult] = results;

      setAppointments(
        appointmentsResult.status === "fulfilled" ? appointmentsResult.value.appointments || [] : []
      );
      setConversationCount(
        conversationsResult.status === "fulfilled" ? (conversationsResult.value.conversations || []).length : 0
      );
      setMedications(
        medicationsResult.status === "fulfilled" && Array.isArray(medicationsResult.value)
          ? medicationsResult.value
          : []
      );
      setSymptoms(
        symptomsResult.status === "fulfilled" && Array.isArray(symptomsResult.value)
          ? symptomsResult.value
          : []
      );
      setProfile(profileResult.status === "fulfilled" ? profileResult.value || {} : {});
      setDoctorCount(
        doctorsResult.status === "fulfilled" ? (doctorsResult.value.doctors || []).length : 0
      );
      setCaregiverCount(
        caregiversResult.status === "fulfilled" ? (caregiversResult.value.caregivers || []).length : 0
      );
      setPendingDoctorRequestCount(
        doctorRequestsResult.status === "fulfilled" ? (doctorRequestsResult.value.requests || []).length : 0
      );
    }

    loadDashboardData();
    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  const upcomingAppointments = useMemo(
    () =>
      appointments
        .filter((appointment) => appointment.status === "scheduled" || appointment.status === "requested")
        .sort((left, right) => new Date(left.startsAt) - new Date(right.startsAt)),
    [appointments]
  );

  const nextAppointment = upcomingAppointments[0];
  const activeMedications = useMemo(
    () => medications.filter((medication) => isActiveMedication(medication)),
    [medications]
  );
  const nextDose = useMemo(() => getNextMedicationDose(activeMedications), [activeMedications]);

  const checklist = useMemo(
    () =>
      buildPatientSetupChecklist({
        profile,
        doctorCount,
        caregiverCount,
        medicationCount: medications.length,
        symptomCount: symptoms.length,
        appointmentCount: appointments.length,
      }),
    [appointments.length, caregiverCount, doctorCount, medications.length, profile, symptoms.length]
  );

  const requestedAppointments = appointments.filter((item) => item.status === "requested").length;
  const setupIncomplete = checklist.doneCount < checklist.totalCount;
  const profileCompletion = checklist.profileStatus;
  const profileMissingPreview = profileCompletion.missing.slice(0, 3);
  const setupProgressPercent = Math.round((checklist.doneCount / checklist.totalCount) * 100);

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />

      <main className="mx-auto max-w-6xl px-6 pb-10 pt-28">
        <section className="rounded-[2rem] bg-gradient-to-r from-slate-900 via-sky-800 to-cyan-600 p-8 text-white shadow-xl">
          <p className="text-sm font-semibold uppercase tracking-[0.25em] text-white/75">Patient Dashboard</p>
          <h1 className="mt-3 text-4xl font-black">Welcome back, {greetingName}</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-white/85">
            Keep your profile, care team, medications, symptoms, and appointments moving together from one place.
          </p>
        </section>

        {setupIncomplete ? (
          <section className="mt-6 rounded-3xl border border-sky-100 bg-white p-6 shadow-sm">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <p className="text-sm font-semibold uppercase tracking-wide text-sky-700">First-time setup</p>
                <h2 className="mt-2 text-2xl font-semibold text-slate-900">
                  {checklist.doneCount} of {checklist.totalCount} onboarding steps complete
                </h2>
                <p className="mt-2 text-sm text-slate-600">
                  New patients should complete these essentials right after login so the rest of the journey works smoothly.
                </p>
              </div>
              <button
                type="button"
                onClick={() => navigate(checklist.tasks.find((task) => !task.done)?.href || "/profilePatient")}
                className="rounded-2xl bg-sky-500 px-4 py-3 text-sm font-semibold text-white hover:bg-sky-600 transition"
              >
                Continue setup
              </button>
            </div>

            <div className="mt-5">
              <div className="flex items-center justify-between gap-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                <span>Setup progress</span>
                <span>{setupProgressPercent}% complete</span>
              </div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
                <div className="h-full rounded-full bg-gradient-to-r from-sky-500 to-cyan-400" style={{ width: `${setupProgressPercent}%` }} />
              </div>
            </div>

            <div className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {checklist.tasks.map((task, index) => (
                <button
                  key={task.key}
                  type="button"
                  onClick={() => navigate(task.href)}
                  className={`rounded-2xl border p-4 text-left transition ${
                    task.done
                      ? "border-emerald-200 bg-emerald-50"
                      : "border-slate-200 bg-slate-50 hover:border-sky-200 hover:bg-sky-50"
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-semibold text-slate-900">{task.label}</p>
                    <span className={`rounded-full px-2 py-1 text-xs font-semibold ${task.done ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
                      {task.done ? "Done" : "Next"}
                    </span>
                  </div>
                  <p className="mt-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Step {index + 1}</p>
                  <p className="mt-2 text-sm text-slate-600">{task.description}</p>
                </button>
              ))}
            </div>
          </section>
        ) : null}

        <section className="mt-6 grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
          <DashboardCard
            title="Active Medications"
            mainText={`${activeMedications.length} tracked`}
            subText={nextDose ? `Next dose: ${nextDose.medication?.name} at ${formatDoseTime(nextDose.at)}` : "Add medication reminders"}
            navPage="/medication"
          />
          <DashboardCard
            title="Next Appointment"
            mainText={nextAppointment ? formatAppointmentDate(nextAppointment.startsAt) : "Not booked"}
            subText={
              nextAppointment
                ? `${formatAppointmentTime(nextAppointment.startsAt)} - ${doctorName(nextAppointment)}`
                : "Request your first visit"
            }
            navPage="/patientAppointments"
          />
          <DashboardCard
            title="Updates & Communication"
            mainText={`${conversationCount}`}
            subText="Check care updates and secure chats"
            navPage="/patientMessages"
          />
          <DashboardCard
            title="Care Team"
            mainText={`${doctorCount + caregiverCount} linked`}
            subText={`${doctorCount} doctor${doctorCount === 1 ? "" : "s"}, ${caregiverCount} caregiver${caregiverCount === 1 ? "" : "s"}${pendingDoctorRequestCount > 0 ? `, ${pendingDoctorRequestCount} pending request${pendingDoctorRequestCount === 1 ? "" : "s"}` : ""}`}
            navPage="/care-team"
          />
        </section>

        <section className="mt-6 grid gap-6 lg:grid-cols-[1.3fr_0.7fr]">
          <div className="rounded-3xl bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold text-slate-900">Upcoming appointments</h2>
                <p className="mt-1 text-sm text-slate-500">Requested and scheduled visits stay visible here.</p>
              </div>
              <button
                type="button"
                onClick={() => navigate("/patientAppointments")}
                className="rounded-2xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition"
              >
                Open appointments
              </button>
            </div>

            <div className="mt-5 space-y-3">
              {upcomingAppointments.length > 0 ? (
                upcomingAppointments.slice(0, 4).map((appointment) => (
                  <div key={appointment.id} className="rounded-2xl border border-slate-200 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="font-semibold text-slate-900">{doctorName(appointment)}</p>
                        <p className="mt-1 text-sm text-slate-500">
                          {formatAppointmentDate(appointment.startsAt)} at {formatAppointmentTime(appointment.startsAt)}
                        </p>
                      </div>
                      <span className={`rounded-full px-3 py-1 text-xs font-semibold ${
                        appointment.status === "requested" ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700"
                      }`}>
                        {appointment.status}
                      </span>
                    </div>
                    <p className="mt-2 text-sm text-slate-600">
                      {appointment.location || "Location pending"} | {appointment.notes || "No notes"}
                    </p>
                  </div>
                ))
              ) : (
                <div className="rounded-2xl border border-dashed border-slate-200 p-6 text-sm text-slate-500">
                  No appointment requests yet. Link a doctor, then request your first visit.
                </div>
              )}
            </div>
          </div>

          <div className="space-y-6">
            <section className="rounded-3xl border border-sky-100 bg-white p-6 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-xl font-semibold text-slate-900">Profile completion guidance</h2>
                  <p className="mt-1 text-sm text-slate-600">
                    Your profile is {profileCompletion.percent}% complete. Fill missing details to improve appointment readiness and emergency access.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => navigate("/profilePatient")}
                  className="rounded-2xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                >
                  Complete profile
                </button>
              </div>

              <div className="mt-4 h-3 overflow-hidden rounded-full bg-slate-100">
                <div className="h-full rounded-full bg-gradient-to-r from-sky-500 to-cyan-400" style={{ width: `${profileCompletion.percent}%` }} />
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                {profileCompletion.missing.length > 0 ? (
                  profileMissingPreview.map((item) => (
                    <span key={item.key} className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-700">
                      Missing: {item.label}
                    </span>
                  ))
                ) : (
                  <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">
                    Profile is complete
                  </span>
                )}
                {profileCompletion.missing.length > profileMissingPreview.length ? (
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                    +{profileCompletion.missing.length - profileMissingPreview.length} more missing
                  </span>
                ) : null}
              </div>
            </section>

            <section className="rounded-3xl bg-white p-6 shadow-sm">
              <h2 className="text-xl font-semibold text-slate-900">Quick actions</h2>
              <div className="mt-4 grid gap-3">
                {[
                  { label: "Health summary", href: "/healthSummary", style: "bg-sky-100 text-sky-700" },
                  {
                    label: profileCompletion.complete
                      ? "Profile complete"
                      : `Complete profile (${profileCompletion.missing.length} left)`,
                    href: "/profilePatient",
                    style: "bg-sky-100 text-sky-700",
                  },
                  { label: "Manage care team", href: "/care-team", style: "bg-cyan-100 text-cyan-700" },
                  { label: "Add medication", href: "/medication", style: "bg-indigo-100 text-indigo-700" },
                  { label: "Log symptom", href: "/symptoms", style: "bg-amber-100 text-amber-700" },
                  { label: "Request appointment", href: "/patientAppointments", style: "bg-emerald-100 text-emerald-700" },
                  { label: "Emergency", href: "/emergency", style: "bg-rose-100 text-rose-700" },
                ].map((action) => (
                  <button
                    key={action.label}
                    type="button"
                    onClick={() => navigate(action.href)}
                    className={`rounded-2xl px-4 py-3 text-left text-sm font-semibold transition hover:opacity-85 ${action.style}`}
                  >
                    {action.label}
                  </button>
                ))}
              </div>
            </section>

            <section className="rounded-3xl bg-white p-6 shadow-sm">
              <h2 className="text-xl font-semibold text-slate-900">Journey summary</h2>
              <div className="mt-4 space-y-3 text-sm text-slate-600">
                <p>Symptoms logged: <span className="font-semibold text-slate-900">{symptoms.length}</span></p>
                <p>Appointment requests pending: <span className="font-semibold text-slate-900">{requestedAppointments}</span></p>
                <p>Doctor-link requests pending: <span className="font-semibold text-slate-900">{pendingDoctorRequestCount}</span></p>
                <p>Profile completion: <span className="font-semibold text-slate-900">{profileCompletion.percent}%</span></p>
                <p>Missing profile items: <span className="font-semibold text-slate-900">{profileCompletion.missing.length}</span></p>
                <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                  <div className="h-full rounded-full bg-gradient-to-r from-sky-500 to-cyan-400" style={{ width: `${profileCompletion.percent}%` }} />
                </div>
              </div>
            </section>
          </div>
        </section>
      </main>
    </div>
  );
}
