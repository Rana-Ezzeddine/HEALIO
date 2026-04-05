import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "../components/Navbar";
import { apiUrl, authHeaders, getUser } from "../api/http";
import { getMyAppointments } from "../api/appointments";
import { getConversations } from "../api/messaging";
import { getCaregiverReminders, getCaregiverPatientSymptoms, getCareNotes } from "../api/caregiver";
import {
  formatDoseTime,
  getScheduleTimes,
  isActiveMedication,
} from "../utils/medicationSchedule";
import {
  resolveActiveCaregiverPatientId,
  setActiveCaregiverPatientId,
} from "../utils/caregiverPatientContext";
import { formatListOutput, getDoctorCaregiverNotes, getPatientClinicalNotes, getPatientTreatmentPlans } from "../utils/doctorPatientRecords";

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
  "Use secure messaging only when messaging permission is enabled.",
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
    label: "Secure messaging",
    description: "Access patient-related communication workflows.",
  },
  canReceiveReminders: {
    label: "Reminder routing",
    description: "Receive care reminders configured by patient settings.",
  },
};

export default function DashboardCaregiver() {
  const navigate = useNavigate();
  const user = getUser();
  const greetingName = user?.firstName || user?.email || "Caregiver";

  const [linkedPatients, setLinkedPatients] = useState([]);
  const [activePatientId, setActivePatientId] = useState("");
  const [appointments, setAppointments] = useState([]);
  const [medications, setMedications] = useState([]);
  const [symptoms, setSymptoms] = useState([]);
  const [reminders, setReminders] = useState([]);
  const [caregiverSymptoms, setCaregiverSymptoms] = useState([]);
  const [caregiverNotes, setCaregiverNotes] = useState([]);
  const [doctorClinicalNotes, setDoctorClinicalNotes] = useState([]);
  const [doctorTreatmentPlans, setDoctorTreatmentPlans] = useState([]);
  const [doctorToCaregiverNotes, setDoctorToCaregiverNotes] = useState([]);
  const [conversationCount, setConversationCount] = useState(0);
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
          const startsAt = new Date(appointment.startsAt).getTime();
          return startsAt >= Date.now() && (appointment.status === "scheduled" || appointment.status === "requested");
        })
        .sort((left, right) => new Date(left.startsAt) - new Date(right.startsAt)),
    [scopedAppointments]
  );

  const scopedMedications = useMemo(() => {
    if (!activePatientId) return [];
    return medications.filter((item) => {
      const ownerId = getOwnerId(item);
      return ownerId ? ownerId === activePatientId : true;
    });
  }, [activePatientId, medications]);

  const scopedSymptoms = useMemo(() => {
    if (!activePatientId) return [];
    return symptoms.filter((item) => {
      const ownerId = getOwnerId(item);
      return ownerId ? ownerId === activePatientId : true;
    });
  }, [activePatientId, symptoms]);

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
        const [patientsRes, appointmentsData, conversationsData, medicationsRes, symptomsRes] = await Promise.all([
          fetch(`${apiUrl}/api/caregivers/patients`, {
            headers: { "Content-Type": "application/json", ...authHeaders() },
          }).then(async (res) => {
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(data.message || "Failed to load caregiver patients.");
            return data;
          }),
          getMyAppointments().catch(() => ({ appointments: [] })),
          getConversations().catch(() => ({ conversations: [] })),
          fetch(`${apiUrl}/api/medications`, {
            headers: { "Content-Type": "application/json", ...authHeaders() },
          }).then((res) => (res.ok ? res.json() : [])),
          fetch(`${apiUrl}/api/symptoms`, {
            headers: { "Content-Type": "application/json", ...authHeaders() },
          }).then((res) => (res.ok ? res.json() : [])),
        ]);

        if (cancelled) return;

        const patients = patientsRes.patients || [];
        const resolvedId = resolveActiveCaregiverPatientId(patients);

        setLinkedPatients(patients);
        setActivePatientId(resolvedId);
        setAppointments(appointmentsData.appointments || []);
        setMedications(Array.isArray(medicationsRes) ? medicationsRes : []);
        setSymptoms(Array.isArray(symptomsRes) ? symptomsRes : []);

        const filteredConversationCount = (conversationsData.conversations || []).filter((conversation) => {
          if (!resolvedId) return false;
          return (conversation.participants || []).some((participant) => participant?.id === resolvedId);
        }).length;
        setConversationCount(filteredConversationCount);
      } catch (error) {
        if (cancelled) return;
        console.error(error);
        setLinkedPatients([]);
        setActivePatientId("");
        setAppointments([]);
        setMedications([]);
        setSymptoms([]);
        setReminders([]);
        setCaregiverSymptoms([]);
        setCaregiverNotes([]);
        setConversationCount(0);
      }
    }

    loadCaregiverDashboard();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!activePatientId) return;

    let cancelled = false;

    async function refreshConversationCount() {
      try {
        const data = await getConversations();
        if (cancelled) return;
        const count = (data.conversations || []).filter((conversation) =>
          (conversation.participants || []).some((participant) => participant?.id === activePatientId)
        ).length;
        setConversationCount(count);
      } catch {
        if (!cancelled) setConversationCount(0);
      }
    }

    refreshConversationCount();
    return () => {
      cancelled = true;
    };
  }, [activePatientId]);

  useEffect(() => {
    if (!activePatientId) {
      setReminders([]);
      setCaregiverSymptoms([]);
      setCaregiverNotes([]);
      setDoctorClinicalNotes([]);
      setDoctorTreatmentPlans([]);
      setDoctorToCaregiverNotes([]);
      return;
    }

    let cancelled = false;

    async function loadPatientSpecificData() {
      try {
        const [remindersData, symptomsData, notesData] = await Promise.all([
          getCaregiverReminders(activePatientId).catch(() => ({ reminders: [] })),
          getCaregiverPatientSymptoms(activePatientId).catch(() => ([])),
          getCareNotes(activePatientId).catch(() => ([])),
        ]);

        if (cancelled) return;

        setReminders(remindersData.reminders || remindersData || []);
        setCaregiverSymptoms(Array.isArray(symptomsData) ? symptomsData : []);
        setCaregiverNotes(Array.isArray(notesData) ? notesData : []);
        setDoctorClinicalNotes(getPatientClinicalNotes(activePatientId));
        setDoctorTreatmentPlans(getPatientTreatmentPlans(activePatientId));
        setDoctorToCaregiverNotes(
          getDoctorCaregiverNotes(activePatientId).filter(
            (note) => !note.caregiverId || note.caregiverId === user?.id
          )
        );
      } catch (error) {
        if (!cancelled) {
          console.error("Failed to load patient-specific data:", error);
          setReminders([]);
          setCaregiverSymptoms([]);
          setCaregiverNotes([]);
          setDoctorClinicalNotes([]);
          setDoctorTreatmentPlans([]);
          setDoctorToCaregiverNotes([]);
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
  const canMessagePatient = canUsePermission(activePermissions, "canMessageDoctor");
  const caregiverSetupChecklist = useMemo(() => {
    const tasks = [
      {
        key: "profile",
        label: "Complete caregiver profile",
        description: "Add relationship and contact details for trust and context.",
        href: "/profileCaregiver",
        done: Boolean(user?.firstName && user?.lastName),
      },
      {
        key: "link",
        label: "Accept first patient invitation",
        description: "Join at least one patient care context.",
        href: "/profileCaregiver",
        done: linkedPatients.length > 0,
      },
      {
        key: "context",
        label: "Select active patient",
        description: "Choose the patient context to scope medications and symptoms.",
        href: "/profileCaregiver",
        done: Boolean(activePatientId),
      },
    ];

    const doneCount = tasks.filter((task) => task.done).length;
    return {
      tasks,
      doneCount,
      totalCount: tasks.length,
      incomplete: doneCount < tasks.length,
      nextTask: tasks.find((task) => !task.done) || null,
    };
  }, [activePatientId, linkedPatients.length, user?.firstName, user?.lastName]);

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />

      <main className="mx-auto max-w-6xl px-6 pb-10 pt-28">
        {linkedPatients.length === 0 ? (
          <>
            <section className="rounded-[2rem] bg-gradient-to-r from-slate-900 via-emerald-800 to-teal-600 p-12 text-white shadow-xl">
              <p className="text-sm font-semibold uppercase tracking-[0.25em] text-white/75">Caregiver Dashboard</p>
              <h1 className="mt-3 text-4xl font-black">Welcome, {greetingName}</h1>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-white/85">
                You're all set. Now let's connect you with a patient. Once you're linked, you'll be able to support their medications, symptoms, appointments, and communication—within the permissions they grant.
              </p>
            </section>

            <section className="mt-10 grid gap-6 lg:grid-cols-2">
              <div className="order-2 flex flex-col justify-between lg:order-1">
                <div>
                  <h2 className="text-2xl font-bold text-slate-900">Caregiver Responsibilities</h2>
                  <p className="mt-2 text-sm text-slate-600">
                    Understand your role so you can support patients confidently and appropriately.
                  </p>

                  <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                    <p className="text-sm text-slate-600">
                      Need a refresher on role boundaries before linking with a patient?
                    </p>
                    <button
                      type="button"
                      onClick={() => setIsScopeModalOpen(true)}
                      className="mt-3 rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                    >
                      View caregiver role boundaries
                    </button>
                  </div>
                </div>
              </div>

              <div className="order-1 lg:order-2">
                <div className="rounded-3xl bg-gradient-to-br from-emerald-50 to-teal-50 border-2 border-emerald-200 p-8 text-center shadow-sm">
                  <div className="mb-4 inline-flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100">
                    <span className="text-3xl">👥</span>
                  </div>

                  <h3 className="text-2xl font-bold text-slate-900">Ready to get linked?</h3>
                  <p className="mt-2 text-sm text-slate-600">
                    A patient will send you an invitation link when they want to add you as a caregiver. Check your pending invitations below.
                  </p>

                  <button
                    type="button"
                    onClick={() => navigate("/profileCaregiver")}
                    className="mt-6 w-full rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 px-6 py-4 text-base font-bold text-white shadow-md hover:shadow-lg hover:from-emerald-600 hover:to-teal-600 transition"
                  >
                    Check pending invitations
                  </button>

                  <p className="mt-4 text-xs text-slate-500">
                    No invitations yet? Share your email with the patient or ask them to find you by email in their Care Team section.
                  </p>

                  <div className="mt-6 border-t border-emerald-200 pt-6">
                    <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-600">In the meantime</p>
                    <div className="space-y-2">
                      <button
                        type="button"
                        onClick={() => navigate("/profileCaregiver")}
                        className="w-full rounded-2xl bg-white border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition"
                      >
                        Complete your profile
                      </button>
                      <p className="text-xs text-slate-500 text-center">
                        Adding your details helps patients feel confident linking with you.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            <section className="mt-10 rounded-3xl bg-white border border-slate-200 p-8 shadow-sm">
              <h2 className="text-xl font-bold text-slate-900">How it works</h2>
              <div className="mt-6 grid gap-6 md:grid-cols-3">
                <div className="text-center">
                  <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-sky-100 text-lg font-bold text-sky-700">1</div>
                  <h3 className="mt-3 font-semibold text-slate-900">Patient invites you</h3>
                  <p className="mt-2 text-sm text-slate-600">A patient sends you a caregiver invitation link via email.</p>
                </div>

                <div className="text-center">
                  <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-sky-100 text-lg font-bold text-sky-700">2</div>
                  <h3 className="mt-3 font-semibold text-slate-900">You accept and set permissions</h3>
                  <p className="mt-2 text-sm text-slate-600">Review what the patient is allowing you to see and do.</p>
                </div>

                <div className="text-center">
                  <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-sky-100 text-lg font-bold text-sky-700">3</div>
                  <h3 className="mt-3 font-semibold text-slate-900">Start supporting</h3>
                  <p className="mt-2 text-sm text-slate-600">Access their care team dashboard and help monitor their health journey.</p>
                </div>
              </div>
            </section>
          </>
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

            {caregiverSetupChecklist.incomplete ? (
              <section className="mt-6 rounded-3xl border border-cyan-100 bg-white p-6 shadow-sm">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <p className="text-sm font-semibold uppercase tracking-wide text-cyan-700">Caregiver setup checklist</p>
                <h2 className="mt-2 text-2xl font-semibold text-slate-900">
                  {caregiverSetupChecklist.doneCount} of {caregiverSetupChecklist.totalCount} setup steps complete
                </h2>
                <p className="mt-2 text-sm text-slate-600">
                  Complete these steps so your dashboard can show real patient-scoped activity.
                </p>
              </div>
              <button
                type="button"
                onClick={() => navigate(caregiverSetupChecklist.nextTask?.href || "/profileCaregiver")}
                className="rounded-2xl bg-cyan-500 px-4 py-3 text-sm font-semibold text-white hover:bg-cyan-600 transition"
              >
                Continue setup
              </button>
            </div>

            <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {caregiverSetupChecklist.tasks.map((task) => (
                <button
                  key={task.key}
                  type="button"
                  onClick={() => navigate(task.href)}
                  className={`rounded-2xl border p-4 text-left transition ${
                    task.done
                      ? "border-emerald-200 bg-emerald-50"
                      : "border-slate-200 bg-slate-50 hover:border-cyan-200 hover:bg-cyan-50"
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-semibold text-slate-900">{task.label}</p>
                    <span className={`rounded-full px-2 py-1 text-xs font-semibold ${task.done ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
                      {task.done ? "Done" : "Next"}
                    </span>
                  </div>
                  <p className="mt-2 text-sm text-slate-600">{task.description}</p>
                </button>
              ))}
            </div>
          </section>
        ) : null}

        <section className="mt-6 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-slate-600">
              Caregiver access is patient-permission scoped for <span className="font-semibold text-slate-800">{activePatientLabel}</span>.
            </p>
            <button
              type="button"
              onClick={() => setIsScopeModalOpen(true)}
              className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              Role boundaries
            </button>
          </div>
        </section>

        <section className="mt-6 grid gap-6 xl:grid-cols-2">
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

          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold text-slate-900">Doctor-to-caregiver notes</h2>
                <p className="mt-1 text-sm text-slate-500">Doctor guidance written specifically for your caregiver support role.</p>
              </div>
              <MiniPill label="Notes" value={doctorToCaregiverNotes.length} tone="emerald" />
            </div>
            <div className="mt-4 space-y-3">
              {doctorToCaregiverNotes.length ? doctorToCaregiverNotes.map((note) => (
                <div key={note.id} className="rounded-3xl border border-slate-200 bg-gradient-to-br from-white to-emerald-50 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <MiniPill label="Support note" value="Caregiver" tone="emerald" />
                    <p className="text-xs text-slate-400">{new Date(note.createdAt).toLocaleString()}</p>
                  </div>
                  <p className="mt-3 text-sm leading-6 text-slate-700">{note.note}</p>
                </div>
              )) : (
                <div className="rounded-2xl border border-dashed border-slate-200 px-5 py-6 text-sm text-slate-500">
                  No doctor-to-caregiver notes for this patient yet.
                </div>
              )}
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
              <button
                type="button"
                onClick={() => navigate("/profileCaregiver")}
                className="rounded-2xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition"
              >
                Open profile
              </button>
            </div>

            <div className="mt-5">
              <div className="mb-4 rounded-2xl border border-slate-200 bg-gradient-to-r from-slate-50 to-sky-50 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Current Context</p>
                    <p className="mt-1 font-semibold text-slate-900">{activePatientLabel}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                      Symptoms: {canViewSymptoms ? scopedSymptoms.length : "Hidden"}
                    </span>
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                      Appointments: {canViewAppointments ? scopedAppointments.length : "Hidden"}
                    </span>
                  </div>
                </div>
              </div>

              <div className="relative pl-6">
                <div className="absolute left-2.5 top-1 h-[calc(100%-10px)] w-px bg-slate-200" />

                <article className="relative mb-4 rounded-2xl border border-slate-200 bg-white p-4">
                  <span className="absolute -left-[18px] top-5 h-3 w-3 rounded-full bg-sky-500 ring-4 ring-sky-100" />
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-semibold text-slate-900">Medications due today</p>
                    <button
                      type="button"
                      onClick={() => navigate("/medication")}
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
                    label: "Medication tasks",
                    href: "/medication",
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
                    label: "Open patient chat",
                    href: "/caregiverMessages",
                    style: "bg-cyan-100 text-cyan-700",
                    enabled: canMessagePatient,
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
