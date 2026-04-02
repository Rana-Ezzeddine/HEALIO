import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "../components/Navbar";
import { apiUrl, authHeaders, getUser } from "../api/http";
import { getConversations } from "../api/messaging";
import { getMyAppointments } from "../api/appointments";
import { formatDoseTime, getNextMedicationDose } from "../utils/medicationSchedule";
import {
  resolveActiveCaregiverPatientId,
  setActiveCaregiverPatientId,
} from "../utils/caregiverPatientContext";

function formatAppointmentDate(dateLike) {
  return new Date(dateLike).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function formatAppointmentTime(dateLike) {
  return new Date(dateLike).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function DashboardCard({ title, mainText, subText, navPage, disabled = false }) {
  const navigate = useNavigate();
  return (
    <button
      type="button"
      onClick={() => { if (!disabled) navigate(navPage); }}
      disabled={disabled}
      className={`group rounded-3xl bg-white p-5 text-left shadow-sm transition ${
        disabled
          ? "cursor-not-allowed opacity-65"
          : "hover:-translate-y-1 hover:bg-slate-50 hover:shadow-md"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
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

const PERMISSION_DESCRIPTIONS = {
  canViewMedications: {
    label: "View Medications",
    description: "See the patient's current medication list, dosage, schedule, and history.",
  },
  canViewSymptoms: {
    label: "View Symptoms",
    description: "See the patient's logged symptoms, severity ratings, and notes.",
  },
  canViewAppointments: {
    label: "View Appointments",
    description: "See the patient's upcoming and past appointments and their status.",
  },
  canReceiveReminders: {
    label: "Receive Reminders",
    description: "Get reminders for the patient's medications and appointments.",
  },
  canMessageDoctor: {
    label: "Message Doctor",
    description: "Send structured care concerns to the patient's assigned doctor.",
  },
};

const CAREGIVER_ALLOWED_ACTIONS = [
  "Log symptom observations on behalf of the patient",
  "Write practical care notes (sleep, appetite, mood, refusals, mobility)",
  "Acknowledge and complete medication reminders",
  "Log medication support actions: assisted, missed, or refused",
  "Help coordinate appointments when the patient allows",
  "Send structured care concerns to the doctor when the patient allows",
];

const CAREGIVER_NOT_ALLOWED = [
  "Diagnose the patient",
  "Prescribe or recommend medications",
  "Edit or create treatment plans",
  "Access any data the patient has not permitted",
];

export default function DashboardCaregiver() {
  const navigate = useNavigate();

  const user = getUser();
  const greetingName = user?.firstName || user?.email || "Caregiver";

  const [linkedPatients, setLinkedPatients] = useState([]);
  const [activePatientId, setActivePatientId] = useState("");
  const [appointments, setAppointments] = useState([]);
  const [medications, setMedications] = useState([]);
  const [symptoms, setSymptoms] = useState([]);
  const [conversationCount, setConversationCount] = useState(0);
  const [showRoleGuide, setShowRoleGuide] = useState(false);

  const activePatientRecord = useMemo(
    () => linkedPatients.find((record) => record.patient?.id === activePatientId) || null,
    [activePatientId, linkedPatients]
  );
  const activePermissions = activePatientRecord?.permissions || {};

  const activePatientLabel =
    activePatientRecord?.patient?.displayName ||
    activePatientRecord?.patient?.email ||
    "No active patient";
  const allPatientCount = linkedPatients.length;

  const scopedAppointments = useMemo(() => {
    if (!activePatientId) return [];
    return appointments.filter((appt) => {
      const ownerId = getOwnerId(appt);
      return ownerId ? ownerId === activePatientId : true;
    });
  }, [activePatientId, appointments]);

  const upcomingAppointments = useMemo(
    () =>
      scopedAppointments
        .filter((appt) => {
          const startsAt = new Date(appt.startsAt).getTime();
          return (
            startsAt >= Date.now() &&
            (appt.status === "scheduled" || appt.status === "requested")
          );
        })
        .sort((a, b) => new Date(a.startsAt) - new Date(b.startsAt)),
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
  const nextDose = useMemo(() => getNextMedicationDose(scopedMedications), [scopedMedications]);

  useEffect(() => {
    const done = localStorage.getItem("caregiverOnboardingComplete");
    if (!done) navigate("/caregiverOnboarding");
  }, [navigate]);

  useEffect(() => {
    let cancelled = false;

    async function loadCaregiverDashboard() {
      try {
        const [patientsRes, appointmentsData, conversationsData, medicationsRes, symptomsRes] =
          await Promise.all([
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

        const filteredCount = (conversationsData.conversations || []).filter((conv) => {
          if (!resolvedId) return false;
          return (conv.participants || []).some((p) => p?.id === resolvedId);
        }).length;
        setConversationCount(filteredCount);
      } catch (error) {
        if (cancelled) return;
        console.error(error);
        setLinkedPatients([]);
        setActivePatientId("");
        setAppointments([]);
        setMedications([]);
        setSymptoms([]);
        setConversationCount(0);
      }
    }

    loadCaregiverDashboard();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!activePatientId) return;
    let cancelled = false;

    async function refreshConversationCount() {
      try {
        const data = await getConversations();
        if (cancelled) return;
        const count = (data.conversations || []).filter((conv) =>
          (conv.participants || []).some((p) => p?.id === activePatientId)
        ).length;
        setConversationCount(count);
      } catch {
        if (!cancelled) setConversationCount(0);
      }
    }

    refreshConversationCount();
    return () => { cancelled = true; };
  }, [activePatientId]);

  const canViewMedications = canUsePermission(activePermissions, "canViewMedications");
  const canViewSymptoms = canUsePermission(activePermissions, "canViewSymptoms");
  const canViewAppointments = canUsePermission(activePermissions, "canViewAppointments");
  const canMessagePatient = canUsePermission(activePermissions, "canMessageDoctor");
  const canReceiveReminders = canUsePermission(activePermissions, "canReceiveReminders");

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />

      <main className="mx-auto max-w-6xl px-6 pb-10 pt-28">

        {/* Hero header */}
        <section className="rounded-[2rem] bg-gradient-to-r from-slate-900 via-sky-800 to-cyan-600 p-8 text-white shadow-xl">
          <p className="text-sm font-semibold uppercase tracking-[0.25em] text-white/75">
            Caregiver Dashboard
          </p>
          <h1 className="mt-3 text-4xl font-black">Welcome back, {greetingName}</h1>
          {/* caregiver actions depend on patient permissions */}
          <p className="mt-3 max-w-2xl text-sm leading-6 text-white/85">
            Your access to each patient's information is controlled by the
            permissions they have set. Switch patients below to change your
            active context.
          </p>

          {/* patient switcher */}
          <div className="mt-4 max-w-sm">
            <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.16em] text-white/70">
              Active patient context
            </label>
            <select
              value={activePatientId}
              onChange={(e) => {
                const nextId = e.target.value;
                setActivePatientId(nextId);
                setActiveCaregiverPatientId(nextId);
              }}
              className="w-full rounded-xl border border-white/30 bg-white/95 px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-sky-300"
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
          </div>
        </section>

        {/* Empty state — no patients linked */}
        {linkedPatients.length === 0 && (
          <div className="mt-6 rounded-3xl border border-dashed border-slate-300 bg-white p-10 text-center">
            <p className="font-semibold text-slate-700 mb-2">
              You are not linked to any patients yet.
            </p>
            <p className="text-sm text-slate-400 mb-6">
              Ask your patient to share an invite link, then connect below.
            </p>
            <button
              onClick={() => navigate("/caregiverAcceptInvite")}
              className="rounded-xl bg-sky-500 px-6 py-2 text-sm font-semibold text-white hover:bg-sky-600 transition"
            >
              Enter Patient Invite Link
            </button>
          </div>
        )}

        {/* Dashboard cards */}
        {linkedPatients.length > 0 && (
          <>
            <section className="mt-6 grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
              <DashboardCard
                title="Active Medications"
                mainText={canViewMedications ? `${scopedMedications.length} tracked` : "No access"}
                subText={
                  canViewMedications
                    ? nextDose
                      ? `Next dose at ${formatDoseTime(nextDose.at)}`
                      : "No upcoming dose"
                    : "Enable medication visibility"
                }
                navPage={`/caregiverMedications?patientId=${activePatientId}`}
                disabled={!canViewMedications}
              />
              <DashboardCard
                title="Next Appointment"
                mainText={
                  canViewAppointments
                    ? nextAppointment
                      ? formatAppointmentDate(nextAppointment.startsAt)
                      : "Not booked"
                    : "No access"
                }
                subText={
                  canViewAppointments
                    ? nextAppointment
                      ? `${formatAppointmentTime(nextAppointment.startsAt)} — ${nextAppointment.status}`
                      : "No upcoming visit"
                    : "Enable appointment visibility"
                }
                navPage={`/caregiverAppointments?patientId=${activePatientId}`}
                disabled={!canViewAppointments}
              />
              <DashboardCard
                title="Patient Conversations"
                mainText={canMessagePatient ? `${conversationCount}` : "No access"}
                subText={
                  canMessagePatient
                    ? "Secure caregiver chat"
                    : "Enable messaging permission"
                }
                navPage="/caregiverMessages"
                disabled={!canMessagePatient}
              />
              <DashboardCard
                title="Linked Patients"
                mainText={`${allPatientCount}`}
                subText={activePatientLabel}
                navPage="/caregiverMyPatients"
              />
            </section>

            <section className="mt-6 grid gap-6 lg:grid-cols-[1.3fr_0.7fr]">
              {/* Patient timeline */}
              <div className="rounded-3xl bg-white p-6 shadow-sm">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <h2 className="text-xl font-semibold text-slate-900">Patient timeline</h2>
                    <p className="mt-1 text-sm text-slate-500">
                      Activities for the selected patient context.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => navigate("/profileCaregiver")}
                    className="rounded-2xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition"
                  >
                    Open profile
                  </button>
                </div>

                <div className="mt-5 space-y-3">
                  <div className="rounded-2xl border border-slate-200 p-4">
                    <p className="font-semibold text-slate-900">Active patient</p>
                    <p className="mt-1 text-sm text-slate-600">{activePatientLabel}</p>
                  </div>
                  <div className="rounded-2xl border border-slate-200 p-4">
                    <p className="font-semibold text-slate-900">Symptoms logged</p>
                    <p className="mt-1 text-sm text-slate-600">
                      {canViewSymptoms
                        ? `${scopedSymptoms.length} in current scope`
                        : "Not visible — enable symptom permission"}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-slate-200 p-4">
                    <p className="font-semibold text-slate-900">Appointments in scope</p>
                    <p className="mt-1 text-sm text-slate-600">
                      {canViewAppointments
                        ? `${scopedAppointments.length} total`
                        : "Not visible — enable appointment permission"}
                    </p>
                  </div>

                  {/* caregiver notes vs doctor notes */}
                  <div className="rounded-2xl border border-indigo-100 bg-indigo-50 p-4">
                    <p className="font-semibold text-indigo-800">Care Notes</p>
                    <p className="mt-1 text-sm text-indigo-600">
                      Your care notes are practical observations — sleep quality,
                      appetite, mood, refusals. They are labeled as caregiver
                      notes and are separate from the doctor's clinical notes.
                    </p>
                    <button
                      onClick={() => navigate("/careNotes")}
                      className="mt-3 rounded-xl bg-indigo-500 px-4 py-1.5 text-xs font-semibold text-white hover:bg-indigo-600 transition"
                    >
                      View Care Notes
                    </button>
                  </div>
                </div>
              </div>

              <div className="space-y-6">
                {/* Quick actions */}
                <section className="rounded-3xl bg-white p-6 shadow-sm">
                  <h2 className="text-xl font-semibold text-slate-900">Quick actions</h2>
                  <div className="mt-4 grid gap-3">
                    {[
                      {
                        label: "Medication tasks",
                        href: `/caregiverMedications?patientId=${activePatientId}`,
                        style: "bg-sky-100 text-sky-700",
                        enabled: canViewMedications,
                      },
                      {
                        label: "Symptom review",
                        href: `/caregiverSymptoms?patientId=${activePatientId}`,
                        style: "bg-indigo-100 text-indigo-700",
                        enabled: canViewSymptoms,
                      },
                      {
                        label: "Open patient chat",
                        href: "/caregiverMessages",
                        style: "bg-cyan-100 text-cyan-700",
                        enabled: canMessagePatient,
                      },
                      {
                        label: "Send care concern to doctor",
                        href: "/caregiverCareConcern",
                        style: "bg-amber-100 text-amber-700",
                        enabled: canMessagePatient,
                      },
                      {
                        label: "Write care note",
                        href: "/careNotes",
                        style: "bg-emerald-100 text-emerald-700",
                        enabled: true,
                      },
                      {
                        label: "Manage caregiver profile",
                        href: "/profileCaregiver",
                        style: "bg-slate-100 text-slate-700",
                        enabled: true,
                      },
                    ].map((action) => (
                      <button
                        key={action.label}
                        type="button"
                        onClick={() => action.enabled && navigate(action.href)}
                        disabled={!action.enabled}
                        className={`rounded-2xl px-4 py-3 text-left text-sm font-semibold transition ${action.style} ${
                          action.enabled ? "hover:opacity-85" : "cursor-not-allowed opacity-50"
                        }`}
                      >
                        {action.label}
                      </button>
                    ))}
                  </div>
                </section>

                {/* plain-language permission summary */}
                <section className="rounded-3xl bg-white p-6 shadow-sm">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-xl font-semibold text-slate-900">Your permissions</h2>
                    <button
                      onClick={() => setShowRoleGuide((s) => !s)}
                      className="text-xs text-sky-600 hover:underline"
                    >
                      {showRoleGuide ? "Hide guide" : "What can I do?"}
                    </button>
                  </div>

                  {/* each permission with plain description */}
                  <div className="space-y-3 text-sm">
                    {Object.entries(PERMISSION_DESCRIPTIONS).map(([key, { label, description }]) => {
                      const enabled = canUsePermission(activePermissions, key);
                      return (
                        <div key={key} className="flex items-start gap-2">
                          <span className="mt-0.5 text-base">
                            {enabled ? "✅" : "⬜"}
                          </span>
                          <div>
                            <p className={`font-medium ${enabled ? "text-slate-800" : "text-slate-400"}`}>
                              {label}
                            </p>
                            {/* plain language description */}
                            <p className="text-xs text-slate-400">{description}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/*expandable role guide */}
                  {showRoleGuide && (
                    <div className="mt-5 space-y-4 border-t border-slate-100 pt-4">
                      {/* support-oriented actions beyond viewing */}
                      <div>
                        <p className="text-sm font-semibold text-slate-700 mb-2">
                          What you can do as a caregiver:
                        </p>
                        <ul className="space-y-1">
                          {CAREGIVER_ALLOWED_ACTIONS.map((action) => (
                            <li key={action} className="flex items-start gap-2 text-xs text-slate-600">
                              <span className="text-emerald-500 mt-0.5">✓</span>
                              {action}
                            </li>
                          ))}
                        </ul>
                      </div>

                      {/* guardrails */}
                      <div>
                        <p className="text-sm font-semibold text-slate-700 mb-2">
                          What you must never do:
                        </p>
                        <ul className="space-y-1">
                          {CAREGIVER_NOT_ALLOWED.map((item) => (
                            <li key={item} className="flex items-start gap-2 text-xs text-red-600">
                              <span className="mt-0.5">🚫</span>
                              {item}
                            </li>
                          ))}
                        </ul>
                      </div>

                      {/*  caregiver notes vs doctor notes */}
                      <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                        <p className="text-xs font-semibold text-slate-700 mb-1">
                          Caregiver notes vs. Doctor notes
                        </p>
                        <p className="text-xs text-slate-500">
                          <strong>Your care notes</strong> are practical observations
                          (sleep, appetite, mobility, refusals). They are labeled as
                          caregiver notes and kept separate from the doctor's clinical
                          notes. You can never write or edit doctor notes.
                        </p>
                      </div>

                      {/*actions depend on permissions */}
                      <div className="rounded-xl border border-sky-100 bg-sky-50 p-3">
                        <p className="text-xs font-semibold text-sky-700 mb-1">
                          Your actions depend on what the patient allows
                        </p>
                        <p className="text-xs text-sky-600">
                          If a feature appears greyed out, the patient has not granted
                          that permission. Ask the patient to update your permissions
                          from their Care Team settings.
                        </p>
                      </div>
                    </div>
                  )}
                </section>
              </div>
            </section>
          </>
        )}
      </main>
    </div>
  );
}