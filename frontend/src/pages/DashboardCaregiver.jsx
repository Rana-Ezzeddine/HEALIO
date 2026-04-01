import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "../components/Navbar";
import { apiUrl, authHeaders, getUser } from "../api/http";
import { getMyAppointments } from "../api/appointments";
import { getConversations } from "../api/messaging";
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
      onClick={() => {
        if (!disabled) navigate(navPage);
      }}
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

  const activePatientRecord = useMemo(
    () => linkedPatients.find((record) => record.patient?.id === activePatientId) || null,
    [activePatientId, linkedPatients]
  );
  const activePermissions = activePatientRecord?.permissions || {};

  const activePatientLabel = activePatientRecord?.patient?.displayName || activePatientRecord?.patient?.email || "No active patient";
  const allPatientCount = linkedPatients.length;

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
  const nextDose = useMemo(() => getNextMedicationDose(scopedMedications), [scopedMedications]);

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

  const canViewMedications = canUsePermission(activePermissions, "canViewMedications");
  const canViewSymptoms = canUsePermission(activePermissions, "canViewSymptoms");
  const canViewAppointments = canUsePermission(activePermissions, "canViewAppointments");
  const canMessagePatient = canUsePermission(activePermissions, "canMessageDoctor");

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />

      <main className="mx-auto max-w-6xl px-6 pb-10 pt-28">
        <section className="rounded-[2rem] bg-gradient-to-r from-slate-900 via-sky-800 to-cyan-600 p-8 text-white shadow-xl">
          <p className="text-sm font-semibold uppercase tracking-[0.25em] text-white/75">Caregiver Dashboard</p>
          <h1 className="mt-3 text-4xl font-black">Welcome back, {greetingName}</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-white/85">
            Manage support tasks in a patient-scoped context so each action is tied to the right person.
          </p>

          <div className="mt-4 max-w-sm">
            <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.16em] text-white/70">
              Active patient context
            </label>
            <select
              value={activePatientId}
              onChange={(event) => {
                const nextId = event.target.value;
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

        <section className="mt-6 grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
          <DashboardCard
            title="Active Medications"
            mainText={canViewMedications ? `${scopedMedications.length} tracked` : "No access"}
            subText={
              canViewMedications
                ? (nextDose ? `Next dose at ${formatDoseTime(nextDose.at)}` : "No upcoming dose")
                : "Enable medication visibility"
            }
            navPage="/medication"
            disabled={!canViewMedications}
          />
          <DashboardCard
            title="Next Appointment"
            mainText={
              canViewAppointments
                ? (nextAppointment ? formatAppointmentDate(nextAppointment.startsAt) : "Not booked")
                : "No access"
            }
            subText={
              canViewAppointments
                ? (nextAppointment ? `${formatAppointmentTime(nextAppointment.startsAt)} scheduled` : "No upcoming visit")
                : "Enable appointment visibility"
            }
            navPage="/patientAppointments"
            disabled={!canViewAppointments}
          />
          {/* <DashboardCard
            title="Patient Conversations"
            mainText={canMessagePatient ? `${conversationCount}` : "No access"}
            subText={canMessagePatient ? "Secure caregiver chat" : "Enable messaging permission"}
            navPage="/caregiverMessages"
            disabled={!canMessagePatient}
          /> */}
          <DashboardCard
            title="Linked Patients"
            mainText={`${allPatientCount}`}
            subText={activePatientLabel}
            navPage="/profileCaregiver"
          />
        </section>

        <section className="mt-6 grid gap-6 lg:grid-cols-[1.3fr_0.7fr]">
          <div className="rounded-3xl bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold text-slate-900">Patient timeline</h2>
                <p className="mt-1 text-sm text-slate-500">Activities for the selected patient context.</p>
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
                  {canViewSymptoms ? `${scopedSymptoms.length} in current scope` : "Not visible in current permissions"}
                </p>
              </div>
              <div className="rounded-2xl border border-slate-200 p-4">
                <p className="font-semibold text-slate-900">Appointments in scope</p>
                <p className="mt-1 text-sm text-slate-600">
                  {canViewAppointments ? `${scopedAppointments.length} total` : "Not visible in current permissions"}
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <section className="rounded-3xl bg-white p-6 shadow-sm">
              <h2 className="text-xl font-semibold text-slate-900">Quick actions</h2>
              <div className="mt-4 grid gap-3">
                {[
                  {
                    label: "Medication tasks",
                    href: "/medication",
                    style: "bg-sky-100 text-sky-700",
                    enabled: canViewMedications,
                  },
                  {
                    label: "Symptom review",
                    href: "/symptoms",
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

            <section className="rounded-3xl bg-white p-6 shadow-sm">
              <h2 className="text-xl font-semibold text-slate-900">Permission summary</h2>
              <div className="mt-4 space-y-3 text-sm text-slate-600">
                <p>View medications: <span className="font-semibold text-slate-900">{canViewMedications ? "Enabled" : "Disabled"}</span></p>
                <p>View symptoms: <span className="font-semibold text-slate-900">{canViewSymptoms ? "Enabled" : "Disabled"}</span></p>
                <p>View appointments: <span className="font-semibold text-slate-900">{canViewAppointments ? "Enabled" : "Disabled"}</span></p>
                <p>Message patient: <span className="font-semibold text-slate-900">{canMessagePatient ? "Enabled" : "Disabled"}</span></p>
              </div>
            </section>
          </div>
        </section>
      </main>
    </div>
  );
}
