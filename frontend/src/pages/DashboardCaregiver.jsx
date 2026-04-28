import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "../components/Navbar";
import { apiUrl, authHeaders, getUser } from "../api/http";
import { getConversationMessages, getConversations } from "../api/messaging";
import {
  getCaregiverDashboard,
  getCaregiverReminders,
  getCaregiverPatientAppointments,
  getCaregiverPatientMedications,
  getCaregiverPatientSymptoms,
  getCareNotes,
} from "../api/caregiver";
import {
  formatDoseTime,
  getScheduleTimes,
  isActiveMedication,
} from "../utils/medicationSchedule";
import {
  resolveActiveCaregiverPatientId,
  setActiveCaregiverPatientId,
} from "../utils/caregiverPatientContext";
import { formatListOutput, getPatientClinicalNotes, getPatientTreatmentPlans } from "../utils/doctorPatientRecords";

function formatAppointmentDate(dateLike) {
  return new Date(dateLike).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function formatAppointmentTime(dateLike) {
  return new Date(dateLike).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function MiniPill({ label, value, tone = "sky" }) {
  const tones = {
    sky: "bg-sky-100 text-sky-700",
    violet: "bg-violet-100 text-violet-700",
    emerald: "bg-emerald-100 text-emerald-700",
    amber: "bg-amber-100 text-amber-700",
  };
  return (
    <div className={`rounded-full px-3 py-1 text-xs font-semibold ${tones[tone] || tones.sky}`}>
      {label}: {value}
    </div>
  );
}

function getOwnerId(record) {
  return (
    record?.patientId ||
    record?.patient?.id ||
    record?.ownerId ||
    record?.userId ||
    ""
  );
}

function canUsePermission(permissions, key) {
  return Boolean(permissions?.[key]);
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

function getDoseDateForToday(timeString, now = new Date()) {
  if (typeof timeString !== "string") return null;
  const [hourString, minuteString] = timeString.split(":");
  const hour = Number(hourString);
  const minute = Number(minuteString);

  if (!Number.isInteger(hour) || !Number.isInteger(minute)) return null;

  const doseDate = new Date(now);
  doseDate.setHours(hour, minute, 0, 0);
  return doseDate;
}

const CAREGIVER_SCOPE_ALLOWED = [
  "Support patient routines (medications, symptoms, appointments) only when patient grants access.",
  "Work within one active patient context at a time to avoid cross-patient mistakes.",
  "Use shared care contacts when contact visibility is enabled.",
];

const CAREGIVER_SCOPE_RESTRICTED = [
  "Cannot diagnose or prescribe medical treatment.",
  "Cannot access patient data that has not been explicitly granted by permission.",
  "Cannot manage doctor-only workflows unless patient and doctor permissions allow related visibility.",
];

const CAREGIVER_PERMISSION_HELP = {
  canViewMedications: {
    label: "Medication visibility",
    description: "See active medications and dose timing in patient scope.",
  },
  canViewSymptoms: {
    label: "Symptom visibility",
    description: "Review patient symptom logs and trends.",
  },
  canViewAppointments: {
    label: "Appointment visibility",
    description: "View upcoming and requested appointments.",
  },
  canMessageDoctor: {
    label: "Doctor contact visibility",
    description: "View doctor contact details shared in this patient context.",
  },
  canReceiveReminders: {
    label: "Reminder routing",
    description: "Receive care reminders configured by patient settings.",
  },
};

export default function DashboardCaregiver() {
  const navigate = useNavigate();
  const user = getUser();
  const currentUserId = user?.id;
  const greetingName = user?.firstName || user?.email || "Caregiver";

  const [linkedPatients, setLinkedPatients] = useState([]);
  const [activePatientId, setActivePatientId] = useState("");
  const [appointments, setAppointments] = useState([]);
  const [medications, setMedications] = useState([]);
  const [reminders, setReminders] = useState([]);
  const [caregiverSymptoms, setCaregiverSymptoms] = useState([]);
  const [caregiverNotes, setCaregiverNotes] = useState([]);
  const [doctorClinicalNotes, setDoctorClinicalNotes] = useState([]);
  const [doctorTreatmentPlans, setDoctorTreatmentPlans] = useState([]);
  const [unreadMessageCount, setUnreadMessageCount] = useState(0);
  const [isScopeModalOpen, setIsScopeModalOpen] = useState(false);

  const activePatientRecord = useMemo(
    () => linkedPatients.find((record) => record.patient?.id === activePatientId) || null,
    [activePatientId, linkedPatients]
  );
  const activePermissions = activePatientRecord?.permissions || {};

  const activePatientLabel = activePatientRecord?.patient?.displayName || activePatientRecord?.patient?.email || "No active patient";
  const scopedAppointments = useMemo(() => {
    if (!activePatientId) return [];
    return appointments.filter((appointment) => {
      const ownerId = getOwnerId(appointment);
      return ownerId ? ownerId === activePatientId : true;
    });
  }, [activePatientId, appointments]);

  const upcomingAppointments = useMemo(
    () =>
      scopedAppointments
        .filter((appointment) => {
          const now = Date.now();
          const startsAt = new Date(appointment.startsAt).getTime();
          const endsAt = new Date(appointment.endsAt || appointment.startsAt).getTime();
          const status = String(appointment.status || "").toLowerCase();
          const isTerminalStatus = status === "cancelled" || status === "completed" || status === "denied";

          if (isTerminalStatus) return false;
          if (Number.isFinite(startsAt) && startsAt >= now) return true;
          if (Number.isFinite(endsAt) && endsAt >= now) return true;
          return false;
        })
        .sort((left, right) => {
          const leftStart = new Date(left.startsAt).getTime();
          const rightStart = new Date(right.startsAt).getTime();

          if (Number.isFinite(leftStart) && Number.isFinite(rightStart)) {
            return leftStart - rightStart;
          }

          const leftEnd = new Date(left.endsAt || left.startsAt).getTime();
          const rightEnd = new Date(right.endsAt || right.startsAt).getTime();
          if (Number.isFinite(leftEnd) && Number.isFinite(rightEnd)) {
            return leftEnd - rightEnd;
          }

          return 0;
        }),
    [scopedAppointments]
  );

  const scopedMedications = useMemo(() => {
    if (!activePatientId) return [];
    return medications.filter((item) => {
      const ownerId = getOwnerId(item);
      return ownerId ? ownerId === activePatientId : true;
    });
  }, [activePatientId, medications]);

  const nextAppointment = upcomingAppointments[0] || null;
  const medicationDosesToday = useMemo(() => {
    const now = new Date();
    const doses = [];

    for (const medication of scopedMedications) {
      if (!isActiveMedication(medication, now)) continue;

      const times = getScheduleTimes(medication);
      for (const time of times) {
        const at = getDoseDateForToday(time, now);
        if (!at) continue;
        doses.push({
          id: `${medication.id}-${time}`,
          medication,
          at,
          isPast: at.getTime() < now.getTime(),
        });
      }
    }

    return doses.sort((left, right) => left.at - right.at);
  }, [scopedMedications]);
  const dueTodayCount = medicationDosesToday.filter((dose) => !dose.isPast).length;
  const nextDueDoses = medicationDosesToday.filter((dose) => !dose.isPast).slice(0, 4);

  useEffect(() => {
    let cancelled = false;

    async function loadCaregiverDashboard() {
      try {
        const [patientsRes, conversationsData] = await Promise.all([
          fetch(`${apiUrl}/api/caregivers/patients`, {
            headers: { "Content-Type": "application/json", ...authHeaders() },
          }).then(async (res) => {
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(data.message || "Failed to load caregiver patients.");
            return data;
          }),
          getConversations().catch(() => ({ conversations: [] })),
        ]);

        if (cancelled) return;

        const patients = patientsRes.patients || [];
        const resolvedId = resolveActiveCaregiverPatientId(patients);

        setLinkedPatients(patients);
        setActivePatientId(resolvedId);
        setAppointments([]);
        setMedications([]);
        setUnreadMessageCount(await countUnreadMessages(conversationsData.conversations || [], currentUserId));
      } catch (error) {
        if (cancelled) return;
        console.error(error);
        setLinkedPatients([]);
        setActivePatientId("");
        setAppointments([]);
        setMedications([]);
        setReminders([]);
        setCaregiverSymptoms([]);
        setCaregiverNotes([]);
        setUnreadMessageCount(0);
      }
    }

    loadCaregiverDashboard();
    return () => {
      cancelled = true;
    };
  }, [currentUserId]);

  useEffect(() => {
    if (!activePatientId) {
      setAppointments([]);
      setMedications([]);
      setReminders([]);
      setCaregiverSymptoms([]);
      setCaregiverNotes([]);
      setDoctorClinicalNotes([]);
      setDoctorTreatmentPlans([]);
      return;
    }

    let cancelled = false;

    async function loadPatientSpecificData() {
      try {
        const [dashboardData, appointmentsData, medicationsData, remindersData, symptomsData, notesData] = await Promise.all([
          getCaregiverDashboard(activePatientId).catch(() => ({ dashboard: { nextAppointment: { appointment: null } } })),
          getCaregiverPatientAppointments(activePatientId).catch(() => ({ appointments: [] })),
          getCaregiverPatientMedications(activePatientId).catch(() => ({ medications: [] })),
          getCaregiverReminders(activePatientId).catch(() => ({ reminders: [] })),
          getCaregiverPatientSymptoms(activePatientId).catch(() => ({ symptoms: [] })),
          getCareNotes(activePatientId).catch(() => ({ notes: [] })),
        ]);

        if (cancelled) return;

        const appointmentItems = Array.isArray(appointmentsData?.appointments) ? appointmentsData.appointments : [];
        const fallbackNextAppointment = dashboardData?.dashboard?.nextAppointment?.appointment || null;
        setAppointments(appointmentItems.length ? appointmentItems : fallbackNextAppointment ? [fallbackNextAppointment] : []);
        setMedications(Array.isArray(medicationsData?.medications) ? medicationsData.medications : []);
        setReminders(remindersData.reminders || remindersData || []);
        setCaregiverSymptoms(Array.isArray(symptomsData?.symptoms) ? symptomsData.symptoms : []);
        setCaregiverNotes(Array.isArray(notesData?.notes) ? notesData.notes : []);
        setDoctorClinicalNotes(getPatientClinicalNotes(activePatientId));
        setDoctorTreatmentPlans(getPatientTreatmentPlans(activePatientId));
      } catch (error) {
        if (!cancelled) {
          console.error("Failed to load patient-specific data:", error);
          setAppointments([]);
          setMedications([]);
          setReminders([]);
          setCaregiverSymptoms([]);
          setCaregiverNotes([]);
          setDoctorClinicalNotes([]);
          setDoctorTreatmentPlans([]);
        }
      }
    }

    loadPatientSpecificData();
    return () => {
      cancelled = true;
    };
  }, [activePatientId]);

  const canViewMedications = canUsePermission(activePermissions, "canViewMedications");
  const canViewSymptoms = canUsePermission(activePermissions, "canViewSymptoms");
  const canViewAppointments = canUsePermission(activePermissions, "canViewAppointments");

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />

      <main className="mx-auto max-w-6xl px-6 pb-10 pt-28">
        {linkedPatients.length === 0 ? (
          <section className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
            <p className="text-sm font-semibold uppercase tracking-[0.25em] text-slate-500">Caregiver Dashboard</p>
            <h1 className="mt-3 text-3xl font-black text-slate-900">Welcome, {greetingName}</h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">
              You are not linked to a patient yet. Accept an invitation to unlock medications, symptoms, appointments, and care notes in patient scope.
            </p>

            <div className="mt-6 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => navigate("/caregiver-patients")}
                className="rounded-2xl bg-cyan-500 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-cyan-600"
              >
                Open patient invitations
              </button>
              <button
                type="button"
                onClick={() => navigate("/profileCaregiver")}
                className="rounded-2xl border border-slate-300 px-5 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                Complete profile
              </button>
              <button
                type="button"
                onClick={() => setIsScopeModalOpen(true)}
                className="rounded-2xl border border-slate-300 px-5 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                Role boundaries
              </button>
            </div>
          </section>
        ) : (
          <>
            <section className="rounded-[2rem] bg-gradient-to-r from-slate-900 via-sky-800 to-cyan-600 p-8 text-white shadow-xl">
              <p className="text-sm font-semibold uppercase tracking-[0.25em] text-white/75">Caregiver Dashboard</p>
              <h1 className="mt-3 text-4xl font-black">Welcome back, {greetingName}</h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-white/85">
                Manage support tasks in a patient-scoped context so each action is tied to the right person.
              </p>

              <div className="mt-4 max-w-sm">
                <label className="mb-3 block text-xs font-semibold uppercase tracking-[0.16em] text-white/70">
                  Active patient context
                </label>
                <div className="relative overflow-hidden rounded-full border border-white/35 bg-white/95 shadow-sm">
                  <select
                    value={activePatientId}
                    onChange={(event) => {
                      const nextId = event.target.value;
                      setActivePatientId(nextId);
                      setActiveCaregiverPatientId(nextId);
                    }}
                    className="w-full appearance-none bg-transparent px-5 py-3 pr-12 text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-sky-300"
                  >
                    {linkedPatients.length > 0 ? (
                      linkedPatients.map(({ patient }) => (
                        <option key={patient?.id} value={patient?.id || ""}>
                          {patient?.displayName || patient?.email || "Patient"}
                        </option>
                      ))
                    ) : (
                      <option value="">No linked patients</option>
                    )}
                  </select>
                  <span className="pointer-events-none absolute inset-y-0 right-4 flex items-center text-slate-400">▾</span>
                </div>
              </div>
            </section>

        <section className="mt-6 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-slate-600">
              Caregiver access is patient-permission scoped for <span className="font-semibold text-slate-800">{activePatientLabel}</span>.
            </p>
            <div className="flex items-center gap-2">
              <MiniPill label="Unread messages" value={unreadMessageCount} tone="sky" />
              <button
                type="button"
                onClick={() => setIsScopeModalOpen(true)}
                className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                Role boundaries
              </button>
            </div>
          </div>
        </section>

        <section className="mt-6">
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold text-slate-900">Doctor guidance for this patient</h2>
                <p className="mt-1 text-sm text-slate-500">Only the readable, patient-safe portions of doctor updates appear here.</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <MiniPill label="Notes" value={doctorClinicalNotes.length} tone="sky" />
                <MiniPill label="Plans" value={doctorTreatmentPlans.length} tone="violet" />
              </div>
            </div>
            <div className="mt-4 space-y-3">
              {doctorClinicalNotes.length ? doctorClinicalNotes.slice(0, 3).map((note) => (
                <div key={note.id} className="rounded-3xl border border-slate-200 bg-gradient-to-br from-white to-sky-50 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <p className="font-semibold text-slate-900">{note.noteTitle || "Clinical note"}</p>
                    <MiniPill label="Action" value={note.patientInstructions?.length ? "Yes" : "None"} tone="sky" />
                  </div>
                  <p className="mt-3 text-sm leading-6 text-slate-700">{note.patientSafeSummary || "No patient-safe summary provided."}</p>
                  <div className="mt-3 rounded-2xl bg-white/80 p-3">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">Instructions</p>
                    <p className="mt-2 text-sm text-slate-700">{formatListOutput(note.patientInstructions) || "Not recorded"}</p>
                  </div>
                </div>
              )) : null}
              {doctorTreatmentPlans.length ? doctorTreatmentPlans.slice(0, 2).map((plan) => (
                <div key={plan.id} className="rounded-3xl border border-slate-200 bg-gradient-to-br from-white to-violet-50 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-semibold text-slate-900">{plan.title}</p>
                    <span className="rounded-full bg-violet-100 px-3 py-1 text-xs font-semibold text-violet-700">{plan.status}</span>
                  </div>
                  <p className="mt-3 text-sm leading-6 text-slate-700">{plan.patientSafeSummary || "No patient-safe summary provided."}</p>
                  <div className="mt-3 rounded-2xl bg-white/80 p-3">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">Goals</p>
                    <p className="mt-2 text-sm text-slate-700">{formatListOutput(plan.treatmentGoals) || "Not recorded"}</p>
                  </div>
                </div>
              )) : null}
              {!doctorClinicalNotes.length && !doctorTreatmentPlans.length ? (
                <div className="rounded-2xl border border-dashed border-slate-200 px-5 py-6 text-sm text-slate-500">
                  No doctor summaries available for this patient yet.
                </div>
              ) : null}
            </div>
          </div>
        </section>

        <section className="mt-6 grid gap-6 lg:grid-cols-[1.3fr_0.7fr]">
          <div className="rounded-3xl bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold text-slate-900">Patient timeline</h2>
                <p className="mt-1 text-sm text-slate-500">Activities for the selected patient context.</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <span className="rounded-full bg-sky-100 px-3 py-1 text-xs font-semibold text-sky-700">
                    Medications due today: {canViewMedications ? dueTodayCount : "Hidden"}
                  </span>
                </div>
              </div>
            </div>

            <div className="mt-5">
              <div className="relative pl-6">
                <div className="absolute left-2.5 top-1 h-[calc(100%-10px)] w-px bg-slate-200" />

                <article className="relative mb-4 rounded-2xl border border-slate-200 bg-white p-4">
                  <span className="absolute -left-[18px] top-5 h-3 w-3 rounded-full bg-sky-500 ring-4 ring-sky-100" />
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-semibold text-slate-900">Medications due today</p>
                    <button
                      type="button"
                      onClick={() => navigate("/caregiverMedications")}
                      disabled={!canViewMedications}
                      className={`rounded-xl px-3 py-1 text-xs font-semibold transition ${
                        canViewMedications
                          ? "bg-sky-100 text-sky-700 hover:bg-sky-200"
                          : "cursor-not-allowed bg-slate-100 text-slate-400"
                      }`}
                    >
                      Open meds
                    </button>
                  </div>
                  {!canViewMedications ? (
                    <p className="mt-1 text-sm text-slate-600">Not visible in current permissions.</p>
                  ) : medicationDosesToday.length === 0 ? (
                    <p className="mt-1 text-sm text-slate-600">No scheduled doses today.</p>
                  ) : (
                    <>
                      <p className="mt-1 text-sm text-slate-600">
                        <span className="font-semibold text-slate-900">{dueTodayCount}</span> remaining of {medicationDosesToday.length} total doses.
                      </p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {nextDueDoses.map((dose) => (
                          <span key={dose.id} className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-700">
                            {dose.medication?.name || "Medication"} at {formatDoseTime(dose.at)}
                          </span>
                        ))}
                      </div>
                    </>
                  )}
                </article>

                <article className="relative mb-4 rounded-2xl border border-slate-200 bg-white p-4">
                  <span className="absolute -left-[18px] top-5 h-3 w-3 rounded-full bg-amber-500 ring-4 ring-amber-100" />
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-semibold text-slate-900">Next appointment</p>
                    <button
                      type="button"
                      onClick={() => navigate("/caregiverAppointments")}
                      disabled={!canViewAppointments}
                      className={`rounded-xl px-3 py-1 text-xs font-semibold transition ${
                        canViewAppointments
                          ? "bg-amber-100 text-amber-700 hover:bg-amber-200"
                          : "cursor-not-allowed bg-slate-100 text-slate-400"
                      }`}
                    >
                      Open appts
                    </button>
                  </div>
                  {!canViewAppointments ? (
                    <p className="mt-1 text-sm text-slate-600">Not visible in current permissions.</p>
                  ) : !nextAppointment ? (
                    <p className="mt-1 text-sm text-slate-600">No upcoming appointment booked.</p>
                  ) : (
                    <p className="mt-1 text-sm text-slate-600">
                      <span className="font-semibold text-slate-900">{formatAppointmentDate(nextAppointment.startsAt)}</span>
                      {" "}at {formatAppointmentTime(nextAppointment.startsAt)}
                      <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700">
                        {nextAppointment.status || "scheduled"}
                      </span>
                    </p>
                  )}
                </article>

                <article className="relative mb-4 rounded-2xl border border-slate-200 bg-white p-4">
                  <span className="absolute -left-[18px] top-5 h-3 w-3 rounded-full bg-violet-500 ring-4 ring-violet-100" />
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-semibold text-slate-900">Pending reminders</p>
                    <button
                      type="button"
                      onClick={() => navigate("/profileCaregiver")}
                      disabled={!activePatientId}
                      className={`rounded-xl px-3 py-1 text-xs font-semibold transition ${
                        activePatientId
                          ? "bg-violet-100 text-violet-700 hover:bg-violet-200"
                          : "cursor-not-allowed bg-slate-100 text-slate-400"
                      }`}
                    >
                      View all
                    </button>
                  </div>
                  {!activePatientId ? (
                    <p className="mt-1 text-sm text-slate-600">Select an active patient to view reminders.</p>
                  ) : reminders.length === 0 ? (
                    <p className="mt-1 text-sm text-slate-600">No pending reminders.</p>
                  ) : (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {reminders.slice(0, 4).map((reminder) => (
                        <span key={reminder.id} className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-700">
                          {reminder.type || "Reminder"}
                        </span>
                      ))}
                    </div>
                  )}
                </article>

                <article className="relative mb-4 rounded-2xl border border-slate-200 bg-white p-4">
                  <span className="absolute -left-[18px] top-5 h-3 w-3 rounded-full bg-rose-500 ring-4 ring-rose-100" />
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-semibold text-slate-900">Recent symptoms</p>
                    <button
                      type="button"
                      onClick={() => navigate("/caregiverSymptoms")}
                      disabled={!canViewSymptoms}
                      className={`rounded-xl px-3 py-1 text-xs font-semibold transition ${
                        canViewSymptoms
                          ? "bg-rose-100 text-rose-700 hover:bg-rose-200"
                          : "cursor-not-allowed bg-slate-100 text-slate-400"
                      }`}
                    >
                      View all
                    </button>
                  </div>
                  {!canViewSymptoms ? (
                    <p className="mt-1 text-sm text-slate-600">Not visible in current permissions.</p>
                  ) : caregiverSymptoms.length === 0 ? (
                    <p className="mt-1 text-sm text-slate-600">No symptoms logged yet.</p>
                  ) : (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {caregiverSymptoms.slice(0, 4).map((symptom) => (
                        <span key={symptom.id} className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-700">
                          {symptom.name || "Symptom"} ({symptom.severity || 0}/10)
                        </span>
                      ))}
                    </div>
                  )}
                </article>

                <article className="relative rounded-2xl border border-slate-200 bg-white p-4">
                  <span className="absolute -left-[18px] top-5 h-3 w-3 rounded-full bg-teal-500 ring-4 ring-teal-100" />
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-semibold text-slate-900">Care notes</p>
                    <button
                      type="button"
                      onClick={() => navigate("/caregiverNotes")}
                      disabled={!activePatientId}
                      className={`rounded-xl px-3 py-1 text-xs font-semibold transition ${
                        activePatientId
                          ? "bg-teal-100 text-teal-700 hover:bg-teal-200"
                          : "cursor-not-allowed bg-slate-100 text-slate-400"
                      }`}
                    >
                      Manage
                    </button>
                  </div>
                  {!activePatientId ? (
                    <p className="mt-1 text-sm text-slate-600">Select an active patient to view care notes.</p>
                  ) : caregiverNotes.length === 0 ? (
                    <p className="mt-1 text-sm text-slate-600">No care notes yet.</p>
                  ) : (
                    <p className="mt-1 text-sm text-slate-600">
                      <span className="font-semibold text-slate-900">{caregiverNotes.length}</span> notes in this context.
                    </p>
                  )}
                </article>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <section className="rounded-3xl bg-white p-6 shadow-sm">
              <h2 className="text-xl font-semibold text-slate-900">Quick actions</h2>
              <div className="mt-4 grid gap-3">
                {[
                  {
                    label: "My patients",
                    href: "/caregiver-patients",
                    style: "bg-teal-100 text-teal-700",
                    enabled: true,
                  },
                  {
                    label: unreadMessageCount > 0 ? `Messages (${unreadMessageCount} unread)` : "Messages",
                    href: "/caregiverMessages",
                    style: "bg-sky-100 text-sky-700",
                    enabled: true,
                  },
                  {
                    label: "Medication tasks",
                    href: "/caregiverMedications",
                    style: "bg-sky-100 text-sky-700",
                    enabled: canViewMedications,
                  },
                  {
                    label: "Symptom review",
                    href: "/caregiverSymptoms",
                    style: "bg-indigo-100 text-indigo-700",
                    enabled: canViewSymptoms,
                  },
                  {
                    label: "Appointments",
                    href: "/caregiverAppointments",
                    style: "bg-amber-100 text-amber-700",
                    enabled: canViewAppointments,
                  },
                  {
                    label: "Care notes",
                    href: "/caregiverNotes",
                    style: "bg-teal-100 text-teal-700",
                    enabled: linkedPatients.length > 0,
                  },
                  {
                    label: "Care contacts",
                    href: "/caregiverCareConcern",
                    style: "bg-emerald-100 text-emerald-700",
                    enabled: linkedPatients.length > 0,
                  },
                  {
                    label: "Manage caregiver profile",
                    href: "/profileCaregiver",
                    style: "bg-emerald-100 text-emerald-700",
                    enabled: true,
                  },
                ].map((action) => (
                  <button
                    key={action.label}
                    type="button"
                    onClick={() => action.enabled && navigate(action.href)}
                    disabled={!action.enabled}
                    className={`rounded-2xl px-4 py-3 text-left text-sm font-semibold transition ${action.style} ${
                      action.enabled ? "hover:opacity-85" : "cursor-not-allowed opacity-60"
                    }`}
                  >
                    {action.label}
                  </button>
                ))}
              </div>
            </section>

          </div>
        </section>
          </>
        )}
      </main>

      {isScopeModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
          <div className="w-full max-w-3xl rounded-3xl border border-white/80 bg-white p-6 shadow-xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Caregiver Role Boundaries</p>
                <h2 className="mt-1 text-2xl font-bold text-slate-900">What you can and cannot do</h2>
                <p className="mt-1 text-sm text-slate-600">Applies to your active patient context and granted permissions.</p>
              </div>
              <button
                type="button"
                onClick={() => setIsScopeModalOpen(false)}
                className="rounded-full border border-slate-200 px-3 py-1 text-sm font-semibold text-slate-600 hover:bg-slate-50"
              >
                Close
              </button>
            </div>

            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Can do</p>
                <ul className="mt-3 space-y-2 text-sm text-emerald-900">
                  {CAREGIVER_SCOPE_ALLOWED.map((item) => (
                    <li key={item}>✓ {item}</li>
                  ))}
                </ul>
              </div>

              <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-rose-700">Cannot do</p>
                <ul className="mt-3 space-y-2 text-sm text-rose-900">
                  {CAREGIVER_SCOPE_RESTRICTED.map((item) => (
                    <li key={item}>✕ {item}</li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">Permission access summary</p>
              <div className="mt-3 grid gap-2 md:grid-cols-2">
                {Object.entries(CAREGIVER_PERMISSION_HELP).map(([key, info]) => {
                  const enabled = canUsePermission(activePermissions, key);
                  return (
                    <div key={key} className="rounded-xl border border-slate-200 bg-white px-3 py-2">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm font-semibold text-slate-900">{info.label}</p>
                        <span className={`rounded-full px-2 py-1 text-xs font-semibold ${enabled ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-700"}`}>
                          {enabled ? "Enabled" : "Disabled"}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-slate-500">{info.description}</p>
                    </div>
                  );
                })}
              </div>
            </div>
            
          </div>
        </div>
      ) : null}
    </div>
  );
}
