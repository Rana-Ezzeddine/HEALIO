import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "../components/Navbar";
import { apiUrl, authHeaders, getUser } from "../api/http";
import { getMyAppointments } from "../api/appointments";
import { getConversationMessages, getConversations } from "../api/messaging";
import { getDoctorLinkRequests, getMyCaregivers, getMyDoctors } from "../api/links";
import { buildPatientSetupChecklist } from "../utils/patientSetup";
import {
  clearQueuedPatientOnboarding,
  clearDismissedPatientOnboarding,
  dismissPatientOnboarding,
  isPatientOnboardingQueued,
  isPatientOnboardingDismissed,
} from "../utils/patientOnboarding";
import { formatDoseTime, getNextMedicationDose, isActiveMedication } from "../utils/medicationSchedule";

const NEW_PATIENT_WELCOME_FLAG = "healio:new-patient-signup";

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

function lastSeenStorageKey(userId) {
  return `healio:messages:lastSeenByConversation:${userId || "unknown"}`;
}

function readLastSeenMap(userId) {
  if (!userId || typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(lastSeenStorageKey(userId));
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

async function countUnreadMessages(conversations, currentUserId) {
  if (!currentUserId || !Array.isArray(conversations) || conversations.length === 0) return 0;

  const lastSeenMap = readLastSeenMap(currentUserId);
  const candidateConversations = conversations.filter((conversation) => {
    const lastMessage = conversation?.lastMessage;
    if (!lastMessage?.sentAt) return false;
    if (lastMessage.sender?.id === currentUserId) return false;

    const seenAt = lastSeenMap[conversation.id];
    return !seenAt || new Date(lastMessage.sentAt).getTime() > new Date(seenAt).getTime();
  });

  if (!candidateConversations.length) return 0;

  const messageResults = await Promise.allSettled(
    candidateConversations.map((conversation) => getConversationMessages(conversation.id))
  );

  let unreadTotal = 0;
  messageResults.forEach((result, index) => {
    if (result.status !== "fulfilled") return;

    const conversationId = candidateConversations[index]?.id;
    const seenAt = lastSeenMap[conversationId];
    const seenTime = seenAt ? new Date(seenAt).getTime() : 0;

    unreadTotal += (result.value.messages || []).filter((message) => {
      if (!message?.sentAt) return false;
      if (message.sender?.id === currentUserId) return false;
      return new Date(message.sentAt).getTime() > seenTime;
    }).length;
  });

  return unreadTotal;
}

export default function DashboardPatient() {
  const navigate = useNavigate();
  const user = getUser();
  const [appointments, setAppointments] = useState([]);
  const [unreadMessageCount, setUnreadMessageCount] = useState(0);
  const [conversationCount, setConversationCount] = useState(0);
  const [medications, setMedications] = useState([]);
  const [symptoms, setSymptoms] = useState([]);
  const [profile, setProfile] = useState({});
  const [doctorCount, setDoctorCount] = useState(0);
  const [caregiverCount, setCaregiverCount] = useState(0);
  const [pendingDoctorRequestCount, setPendingDoctorRequestCount] = useState(0);
  const [isNewPatientGreeting, setIsNewPatientGreeting] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [isOnboardingOpen, setIsOnboardingOpen] = useState(false);
  const [currentTime, setCurrentTime] = useState(() => Date.now());

  const greetingName =
    profile?.firstName || user?.firstName || localStorage.getItem("firstName") || user?.email || "Patient";

  useEffect(() => {
    const isNewSignup = localStorage.getItem(NEW_PATIENT_WELCOME_FLAG) === "true";
    if (isNewSignup) {
      setIsNewPatientGreeting(true);
      localStorage.removeItem(NEW_PATIENT_WELCOME_FLAG);
    }
  }, []);

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
    const intervalId = window.setInterval(() => {
      setCurrentTime(Date.now());
    }, 60000);

    return () => {
      window.clearInterval(intervalId);
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
      if (conversationsResult.status === "fulfilled") {
        const conversationList = conversationsResult.value.conversations || [];
        setConversationCount(conversationList.length);
        const unreadCount = await countUnreadMessages(conversationList, user?.id);
        setUnreadMessageCount(unreadCount);
      } else {
        setConversationCount(0);
        setUnreadMessageCount(0);
      }
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
  const appointmentPreview = upcomingAppointments.slice(0, 2);
  const remainingAppointmentCount = Math.max(upcomingAppointments.length - appointmentPreview.length, 0);
  const nextSetupTask = checklist.tasks.find((task) => !task.done) || null;
  const nextSetupStepNumber = nextSetupTask
    ? checklist.tasks.findIndex((task) => task.key === nextSetupTask.key) + 1
    : checklist.totalCount;
  const dueSoonMedicationReminders = useMemo(() => {
    return activeMedications
      .filter((medication) => medication.reminderEnabled !== false)
      .map((medication) => {
        const dose = getNextMedicationDose([medication], new Date(currentTime));
        if (!dose) return null;

        const leadMinutes = Number.isInteger(medication.reminderLeadMinutes)
          ? medication.reminderLeadMinutes
          : 30;
        const minutesUntil = Math.round((dose.at.getTime() - currentTime) / (1000 * 60));

        return { medication, dose, leadMinutes, minutesUntil };
      })
      .filter((item) => item && item.minutesUntil >= 0 && item.minutesUntil <= item.leadMinutes)
      .sort((left, right) => left.dose.at - right.dose.at)
      .slice(0, 3);
  }, [activeMedications, currentTime]);
  const upcomingAppointmentReminders = useMemo(() => {
    return upcomingAppointments
      .map((appointment) => {
        const minutesUntil = Math.round((new Date(appointment.startsAt).getTime() - currentTime) / (1000 * 60));
        return { appointment, minutesUntil };
      })
      .filter((item) => item.minutesUntil >= 0 && item.minutesUntil <= 48 * 60)
      .slice(0, 3);
  }, [currentTime, upcomingAppointments]);
  const dashboardNotifications = [
    requestedAppointments > 0
      ? {
          key: "requests",
          title: "Appointment requests pending",
          body: `${requestedAppointments} request${requestedAppointments === 1 ? "" : "s"} still waiting for doctor review.`,
          action: "Open appointments",
          href: "/patientAppointments",
          tone: "border-amber-200 bg-amber-50 text-amber-800",
        }
      : null,
    checklist.profileStatus.missing.length > 0
      ? {
          key: "profile",
          title: "Profile still missing details",
          body: `${checklist.profileStatus.missing.length} item${checklist.profileStatus.missing.length === 1 ? "" : "s"} should be filled for stronger reminders and emergency access.`,
          action: "Complete profile",
          href: "/profilePatient",
          tone: "border-sky-200 bg-sky-50 text-sky-800",
        }
      : null,
    doctorCount === 0
      ? {
          key: "doctor",
          title: "No doctor linked yet",
          body: "Link a doctor to unlock appointment requests and treatment coordination.",
          action: "Manage care team",
          href: "/care-team",
          tone: "border-cyan-200 bg-cyan-50 text-cyan-800",
        }
      : null,
    conversationCount === 0 && caregiverCount > 0
      ? {
          key: "messages",
          title: "No caregiver conversations started",
          body: "Open a secure chat so updates and reminders can flow through one place.",
          action: "Open messages",
          href: "/patientMessages",
          tone: "border-fuchsia-200 bg-fuchsia-50 text-fuchsia-800",
        }
      : null,
  ].filter(Boolean);
  const shouldAutoOpenOnboarding =
    setupIncomplete && isPatientOnboardingQueued(user) && !isPatientOnboardingDismissed(user);
  const showOnboardingModal = setupIncomplete && (isOnboardingOpen || shouldAutoOpenOnboarding);

  useEffect(() => {
    if (!user || user.role !== "patient") return;

    if (!setupIncomplete) {
      clearDismissedPatientOnboarding(user);
      clearQueuedPatientOnboarding(user);
      return;
    }

    if (shouldAutoOpenOnboarding) {
      clearQueuedPatientOnboarding(user);
    }
  }, [setupIncomplete, shouldAutoOpenOnboarding, user]);

  function handleDismissOnboarding() {
    dismissPatientOnboarding(user);
    setIsOnboardingOpen(false);
  }

  function handleStartOnboardingTask() {
    setIsOnboardingOpen(false);
    navigate(nextSetupTask?.href || "/profilePatient");
  }

  const quickActions = [
    {
      key: "setup",
      label: setupIncomplete ? "Resume setup" : "Review setup",
      description: setupIncomplete
        ? `Continue with step ${nextSetupStepNumber}: ${nextSetupTask?.label || "profile setup"}.`
        : "All onboarding essentials are completed.",
      badge: `${checklist.doneCount}/${checklist.totalCount} done`,
      style: "bg-sky-100 text-sky-700",
      onClick: () => (setupIncomplete ? setIsOnboardingOpen(true) : navigate("/profilePatient")),
    },
    {
      key: "profile",
      label: "Update profile",
      description: `${checklist.profileStatus.percent}% complete across identity, health, and emergency details.`,
      badge: `${checklist.profileStatus.percent}%`,
      style: "bg-cyan-100 text-cyan-700",
      onClick: () => navigate("/profilePatient"),
    },
    {
      key: "care-team",
      label: "Manage care team",
      description: "Keep your linked doctors and caregivers aligned with your treatment journey.",
      badge: `${doctorCount + caregiverCount} linked`,
      style: "bg-teal-100 text-teal-700",
      onClick: () => navigate("/care-team"),
    },
    {
      key: "medications",
      label: "Manage medications",
      description: activeMedications.length > 0 ? "Review active treatment and upcoming doses." : "Add your first medication and reminder schedule.",
      badge: `${activeMedications.length} active`,
      style: "bg-indigo-100 text-indigo-700",
      onClick: () => navigate("/medication"),
    },
    {
      key: "symptoms",
      label: "Track symptoms",
      description: symptoms.length > 0 ? "Log updates and review how your symptoms are trending." : "Start your symptom history with the first entry.",
      badge: `${symptoms.length} logged`,
      style: "bg-amber-100 text-amber-700",
      onClick: () => navigate("/symptoms"),
    },
    {
      key: "appointments",
      label: "Handle appointments",
      description: requestedAppointments > 0 ? "Follow pending requests and upcoming visits in one place." : "Request or review visits with your linked doctors.",
      badge: `${upcomingAppointments.length} open`,
      style: "bg-emerald-100 text-emerald-700",
      onClick: () => navigate("/patientAppointments"),
    },
    {
      key: "messages",
      label: "Open messages",
      description: unreadMessageCount > 0 ? "Review new caregiver communication and care coordination updates." : "Open secure caregiver communication.",
      badge: `${unreadMessageCount} unread`,
      style: "bg-fuchsia-100 text-fuchsia-700",
      onClick: () => navigate("/patientMessages"),
    },
    {
      key: "emergency",
      label: "Emergency status",
      description: "Trigger urgent visibility for your care team when something cannot wait.",
      badge: "Urgent access",
      style: "bg-rose-100 text-rose-700",
      onClick: () => navigate("/emergency"),
    },
  ];

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />

      <main className="mx-auto max-w-6xl px-6 pb-10 pt-28">
        <section className="rounded-[2rem] bg-gradient-to-r from-slate-900 via-sky-800 to-cyan-600 p-8 text-white shadow-xl">
          <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.25em] text-white/75">Patient Dashboard</p>
              <h1 className="mt-3 text-4xl font-black">
                {isNewPatientGreeting ? `Welcome, ${greetingName}` : `Welcome back, ${greetingName}`}
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-white/85">
                Keep your profile, care team, medications, symptoms, and appointments moving together from one place.
              </p>
            </div>

            <button
              type="button"
              onClick={() => navigate("/emergency")}
              className={`min-w-[260px] rounded-3xl border px-5 py-4 text-left transition hover:opacity-95 ${
                profile?.emergencyStatus
                  ? "border-rose-200/80 bg-rose-500/20"
                  : "border-white/20 bg-white/10"
              }`}
            >
              <p className="text-xs font-semibold uppercase tracking-[0.25em] text-white/75">Emergency status</p>
              <p className="mt-2 text-2xl font-black text-white">
                {profile?.emergencyStatus ? "Active" : "Normal"}
              </p>
              <p className="mt-2 text-sm text-white/80">
                {profile?.emergencyStatus
                  ? "Your care team should see that urgent follow-up is needed."
                  : "No emergency flag is active on your profile right now."}
              </p>
              <p className="mt-3 text-xs text-white/70">
                Last updated:{" "}
                {profile?.emergencyStatusUpdatedAt
                  ? new Date(profile.emergencyStatusUpdatedAt).toLocaleString()
                  : "Never"}
              </p>
            </button>
          </div>
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
              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => setIsOnboardingOpen(true)}
                  className="rounded-2xl border border-sky-200 px-4 py-3 text-sm font-semibold text-sky-700 transition hover:bg-sky-50"
                >
                  Guided flow
                </button>
                <button
                  type="button"
                  onClick={() => navigate(nextSetupTask?.href || "/profilePatient")}
                  className="rounded-2xl bg-sky-500 px-4 py-3 text-sm font-semibold text-white hover:bg-sky-600 transition"
                >
                  Continue setup
                </button>
              </div>
            </div>

            <div className="mt-5 rounded-2xl border border-sky-100 bg-sky-50/70 p-4">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-700">
                    Recommended next step
                  </p>
                  <h3 className="mt-1 text-lg font-semibold text-slate-900">
                    Step {nextSetupStepNumber}: {nextSetupTask?.label || "Review your setup"}
                  </h3>
                  <p className="mt-1 text-sm text-slate-600">
                    {nextSetupTask?.description || "Open your onboarding checklist to continue setup."}
                  </p>
                </div>
                <div className="min-w-[180px]">
                  <div className="h-2 overflow-hidden rounded-full bg-white">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-sky-500 to-cyan-500"
                      style={{ width: `${Math.max(8, Math.round((checklist.doneCount / checklist.totalCount) * 100))}%` }}
                    />
                  </div>
                  <p className="mt-2 text-sm font-medium text-slate-700">
                    {checklist.doneCount} of {checklist.totalCount} completed
                  </p>
                </div>
              </div>
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
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Step {index + 1}</p>
                      <p className="font-semibold text-slate-900">{task.label}</p>
                    </div>
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
            mainText={`${unreadMessageCount}`}
            subText="New unread messages"
            navPage="/patientMessages"
          />
          <DashboardCard
            title="Care Team"
            mainText={`${doctorCount + caregiverCount} linked`}
            subText={`${doctorCount} doctor${doctorCount === 1 ? "" : "s"}, ${caregiverCount} caregiver${caregiverCount === 1 ? "" : "s"}${pendingDoctorRequestCount > 0 ? `, ${pendingDoctorRequestCount} pending request${pendingDoctorRequestCount === 1 ? "" : "s"}` : ""}`}
            navPage="/care-team"
          />
        </section>

        <section className="mt-6 grid gap-6 lg:grid-cols-[1fr_1fr] xl:grid-cols-[0.95fr_1.05fr]">
          <div className="rounded-3xl bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold text-slate-900">Upcoming appointments</h2>
                <p className="mt-1 text-sm text-slate-500">A quick look at your nearest visits and pending requests.</p>
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
                appointmentPreview.map((appointment) => (
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
                  <div className="mt-4 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => navigate("/care-team")}
                      className="rounded-xl bg-sky-100 px-3 py-2 text-xs font-semibold text-sky-700 hover:bg-sky-200 transition"
                    >
                      Link a doctor
                    </button>
                    <button
                      type="button"
                      onClick={() => navigate("/patientAppointments")}
                      className="rounded-xl bg-emerald-100 px-3 py-2 text-xs font-semibold text-emerald-700 hover:bg-emerald-200 transition"
                    >
                      Request appointment
                    </button>
                  </div>
                </div>
              )}
              {remainingAppointmentCount > 0 ? (
                <button
                  type="button"
                  onClick={() => navigate("/patientAppointments")}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
                >
                  View {remainingAppointmentCount} more appointment{remainingAppointmentCount === 1 ? "" : "s"}
                </button>
              ) : null}
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

              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Symptoms logged</p>
                  <p className="mt-1 text-lg font-bold text-slate-900">{symptoms.length}</p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Appointment requests</p>
                  <p className="mt-1 text-lg font-bold text-slate-900">{requestedAppointments}</p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Doctor-link pending</p>
                  <p className="mt-1 text-lg font-bold text-slate-900">{pendingDoctorRequestCount}</p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Unread messages</p>
                  <p className="mt-1 text-lg font-bold text-slate-900">{unreadMessageCount}</p>
                </div>
              </div>
            </section>

            <section className="rounded-3xl bg-white p-6 shadow-sm">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-xl font-semibold text-slate-900">Reminders and notifications</h2>
                  <p className="mt-1 text-sm text-slate-500">
                    Stay ahead of doses, visits, and dashboard actions that still need attention.
                  </p>
                </div>
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                  {dueSoonMedicationReminders.length + upcomingAppointmentReminders.length + dashboardNotifications.length} active
                </span>
              </div>

              <div className="mt-4 grid gap-4 xl:grid-cols-2">
                <div className="rounded-2xl border border-slate-200 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="font-semibold text-slate-900">Due soon reminders</h3>
                    <button
                      type="button"
                      onClick={() => navigate("/medication")}
                      className="text-xs font-semibold text-sky-700 transition hover:text-sky-800"
                    >
                      Manage meds
                    </button>
                  </div>
                  <div className="mt-3 space-y-3">
                    {dueSoonMedicationReminders.length > 0 || upcomingAppointmentReminders.length > 0 ? (
                      <>
                        {dueSoonMedicationReminders.map((item) => (
                          <button
                            key={`${item.medication.id}-${item.dose.at.toISOString()}`}
                            type="button"
                            onClick={() => navigate("/medication")}
                            className="w-full rounded-2xl border border-amber-200 bg-amber-50 p-4 text-left transition hover:border-amber-300"
                          >
                            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-700">Medication</p>
                            <p className="mt-1 font-semibold text-slate-900">{item.medication.name}</p>
                            <p className="mt-1 text-sm text-slate-600">
                              Dose at {formatDoseTime(item.dose.at)} with a {item.leadMinutes}-minute reminder window.
                            </p>
                          </button>
                        ))}
                        {upcomingAppointmentReminders.map((item) => (
                          <button
                            key={item.appointment.id}
                            type="button"
                            onClick={() => navigate("/patientAppointments")}
                            className="w-full rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-left transition hover:border-emerald-300"
                          >
                            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-700">Appointment</p>
                            <p className="mt-1 font-semibold text-slate-900">{doctorName(item.appointment)}</p>
                            <p className="mt-1 text-sm text-slate-600">
                              {formatAppointmentDate(item.appointment.startsAt)} at {formatAppointmentTime(item.appointment.startsAt)}.
                            </p>
                          </button>
                        ))}
                      </>
                    ) : (
                      <p className="rounded-2xl border border-dashed border-slate-200 p-4 text-sm text-slate-500">
                        No active reminders right now. Add medication schedules or request an appointment to populate this panel.
                      </p>
                    )}
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-200 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="font-semibold text-slate-900">Needs attention</h3>
                    <button
                      type="button"
                      onClick={() => navigate("/dashboardPatient")}
                      className="text-xs font-semibold text-slate-500 transition hover:text-slate-700"
                    >
                      Refresh context
                    </button>
                  </div>
                  <div className="mt-3 space-y-3">
                    {dashboardNotifications.length > 0 ? (
                      dashboardNotifications.map((notification) => (
                        <button
                          key={notification.key}
                          type="button"
                          onClick={() => navigate(notification.href)}
                          className={`w-full rounded-2xl border p-4 text-left transition hover:opacity-90 ${notification.tone}`}
                        >
                          <div className="flex items-center justify-between gap-3">
                            <p className="font-semibold">{notification.title}</p>
                            <span className="text-xs font-semibold">{notification.action}</span>
                          </div>
                          <p className="mt-2 text-sm">{notification.body}</p>
                        </button>
                      ))
                    ) : (
                      <p className="rounded-2xl border border-dashed border-slate-200 p-4 text-sm text-slate-500">
                        No unresolved dashboard notifications. Your current essentials look clear.
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </section>

            <section className="rounded-3xl bg-white p-6 shadow-sm">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-xl font-semibold text-slate-900">Quick actions</h2>
                  <p className="mt-1 text-sm text-slate-500">
                    Move through setup, daily management, communication, and urgent support from one panel.
                  </p>
                </div>
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                  {quickActions.length} actions
                </span>
              </div>
              <div className="mt-4 grid gap-3">
                {quickActions.map((action) => (
                  <button
                    key={action.key}
                    type="button"
                    onClick={action.onClick}
                    className="rounded-2xl border border-slate-200 px-4 py-4 text-left transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-sm"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">{action.label}</p>
                        <p className="mt-1 text-sm text-slate-600">{action.description}</p>
                      </div>
                      <span className={`rounded-full px-2.5 py-1 text-xs font-semibold whitespace-nowrap ${action.style}`}>
                        {action.badge}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            </section>
          </div>
        </section>
      </main>

      {showOnboardingModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 px-4 backdrop-blur-sm">
          <div className="w-full max-w-3xl rounded-[2rem] bg-white p-6 shadow-2xl">
            <div className="flex flex-col gap-4 border-b border-slate-200 pb-5 md:flex-row md:items-start md:justify-between">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.25em] text-sky-700">Patient onboarding</p>
                <h2 className="mt-2 text-3xl font-black text-slate-900">Start with the right setup order</h2>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
                  This guided flow walks through the essentials a new patient needs after first login so reminders, appointments, emergency access, and communication work correctly.
                </p>
              </div>
              <button
                type="button"
                onClick={handleDismissOnboarding}
                className="rounded-2xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
              >
                Maybe later
              </button>
            </div>

            <div className="mt-5 rounded-3xl bg-slate-50 p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-700">
                Step {nextSetupStepNumber} of {checklist.totalCount}
              </p>
              <h3 className="mt-2 text-2xl font-semibold text-slate-900">
                {nextSetupTask?.label || "Continue your setup"}
              </h3>
              <p className="mt-2 text-sm text-slate-600">
                {nextSetupTask?.description || "Open the next setup step to continue onboarding."}
              </p>
              <div className="mt-4 h-2 overflow-hidden rounded-full bg-white">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-sky-500 to-cyan-500"
                  style={{ width: `${Math.max(8, Math.round((checklist.doneCount / checklist.totalCount) * 100))}%` }}
                />
              </div>
            </div>

            <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {checklist.tasks.map((task, index) => (
                <div
                  key={task.key}
                  className={`rounded-2xl border p-4 ${
                    task.done ? "border-emerald-200 bg-emerald-50" : task.key === nextSetupTask?.key ? "border-sky-300 bg-sky-50" : "border-slate-200 bg-white"
                  }`}
                >
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Step {index + 1}</p>
                  <div className="mt-2 flex items-start justify-between gap-3">
                    <p className="font-semibold text-slate-900">{task.label}</p>
                    <span className={`rounded-full px-2 py-1 text-xs font-semibold ${task.done ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
                      {task.done ? "Done" : task.key === nextSetupTask?.key ? "Start here" : "Pending"}
                    </span>
                  </div>
                  <p className="mt-2 text-sm text-slate-600">{task.description}</p>
                </div>
              ))}
            </div>

            <div className="mt-6 flex flex-col gap-3 md:flex-row md:justify-end">
              <button
                type="button"
                onClick={handleDismissOnboarding}
                className="rounded-2xl border border-slate-300 px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                Stay on dashboard
              </button>
              <button
                type="button"
                onClick={handleStartOnboardingTask}
                className="rounded-2xl bg-sky-500 px-5 py-3 text-sm font-semibold text-white transition hover:bg-sky-600"
              >
                Open next step
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
