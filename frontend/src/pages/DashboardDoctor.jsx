import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "../components/Navbar";
import { apiUrl, authHeaders, getUser } from "../api/http";
import {
  createAppointment,
  getDoctorAvailability,
  getDoctorSchedule,
  getMyAppointments,
} from "../api/appointments";

function DashboardCard({ title, mainText, subText, navPage, tone = "sky" }) {
  const navigate = useNavigate();

  const toneClasses = {
    sky: "from-sky-500/10 to-cyan-500/10 text-sky-700",
    amber: "from-amber-500/10 to-orange-500/10 text-amber-700",
    rose: "from-rose-500/10 to-red-500/10 text-rose-700",
    emerald: "from-emerald-500/10 to-teal-500/10 text-emerald-700",
  };

  return (
    <button
      type="button"
      onClick={() => navigate(navPage)}
      className="group rounded-3xl border border-slate-200 bg-white p-5 text-left shadow-sm transition hover:-translate-y-1 hover:shadow-md"
    >
      <div className={`inline-flex rounded-full bg-gradient-to-r px-3 py-1 text-xs font-semibold ${toneClasses[tone] || toneClasses.sky}`}>
        {title}
      </div>
      <p className="mt-4 text-3xl font-black text-slate-900">{mainText}</p>
      {subText ? <p className="mt-2 text-sm font-medium text-slate-500">{subText}</p> : null}
      <p className="mt-4 text-xs font-semibold uppercase tracking-[0.2em] text-slate-400 transition group-hover:text-slate-600">
        Open
      </p>
    </button>
  );
}

function startOfToday() {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date;
}

function endOfToday() {
  const date = startOfToday();
  date.setDate(date.getDate() + 1);
  return date;
}

function formatTime(dateLike) {
  return new Date(dateLike).toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatDate(dateLike) {
  return new Date(dateLike).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatDateTime(dateLike) {
  return new Date(dateLike).toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function statusClasses(status) {
  if (status === "requested") return "bg-amber-100 text-amber-700";
  if (status === "scheduled") return "bg-yellow-100 text-yellow-700";
  if (status === "completed") return "bg-green-100 text-green-700";
  if (status === "cancelled") return "bg-red-100 text-red-700";
  return "bg-slate-100 text-slate-700";
}

function statusLabel(status) {
  if (status === "requested") return "Requested";
  if (status === "scheduled") return "Upcoming";
  if (status === "completed") return "Completed";
  if (status === "cancelled") return "Cancelled";
  return status || "Unknown";
}

function patientDisplayName(patient) {
  return patient?.profile?.displayName || patient?.displayName || patient?.email || "Patient";
}

function activityTypeLabel(type) {
  switch (type) {
    case "symptom_logged":
      return "Symptom update";
    case "medical_note_added":
      return "Medical note";
    case "diagnosis_updated":
      return "Diagnosis update";
    case "appointment_scheduled":
      return "Appointment event";
    default:
      return "Recent activity";
  }
}

function activityDescription(item) {
  if (item.type === "symptom_logged") {
    return `${item.details?.name || "Symptom"} logged at ${item.details?.severity || "unknown"} severity.`;
  }
  if (item.type === "medical_note_added") {
    return item.details?.preview || "A new note was added.";
  }
  if (item.type === "diagnosis_updated") {
    return item.details?.preview || `Diagnosis marked ${item.details?.status || "updated"}.`;
  }
  if (item.type === "appointment_scheduled") {
    return item.details?.startsAt
      ? `Appointment set for ${formatDateTime(item.details.startsAt)}${item.details?.location ? ` at ${item.details.location}` : ""}.`
      : "Appointment updated.";
  }
  return "Recent patient activity.";
}

function isDoctorProfileComplete(profile) {
  if (!profile) return false;
  const requiredFields = [
    profile.firstName,
    profile.lastName,
    profile.specialization,
    profile.yearsOfExperience,
    profile.licenseNb,
    profile.clinicName,
    profile.clinicAddress,
  ];
  return requiredFields.every((value) => String(value || "").trim().length > 0);
}

async function fetchDoctorOverview() {
  const response = await fetch(`${apiUrl}/api/doctors/dashboard-overview`, {
    headers: { ...authHeaders() },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.message || "Failed to load doctor overview");
  }
  return data;
}

async function fetchDoctorProfile() {
  const response = await fetch(`${apiUrl}/api/doctors/me/profile`, {
    headers: { ...authHeaders() },
  });
  const data = await response.json().catch(() => ({}));
  if (response.status === 404) {
    return null;
  }
  if (!response.ok) {
    throw new Error(data.message || "Failed to load doctor profile");
  }
  return data?.patientProfile || null;
}

async function fetchDoctorAvailabilityEntries() {
  const response = await fetch(`${apiUrl}/api/doctors/availability`, {
    headers: { ...authHeaders() },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.message || "Failed to load doctor availability");
  }
  return data?.availabilities || [];
}

async function createDoctorAvailabilityEntry(payload) {
  const response = await fetch(`${apiUrl}/api/doctors/availability`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(),
    },
    body: JSON.stringify(payload),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.message || "Failed to create availability entry");
  }
  return data;
}

export default function DashboardDoctor() {
  const navigate = useNavigate();
  const user = getUser();
  const greetingName = user?.firstName || user?.email || "Doctor";

  const [scheduleLoading, setScheduleLoading] = useState(true);
  const [scheduleError, setScheduleError] = useState("");
  const [schedule, setSchedule] = useState([]);
  const [assignedPatients, setAssignedPatients] = useState([]);
  const [requestedAppointments, setRequestedAppointments] = useState([]);
  const [urgentPatients, setUrgentPatients] = useState([]);
  const [recentActivity, setRecentActivity] = useState([]);
  const [overviewSummary, setOverviewSummary] = useState(null);
  const [doctorProfile, setDoctorProfile] = useState(null);
  const [availabilityEntries, setAvailabilityEntries] = useState([]);
  const [showScheduleForm, setShowScheduleForm] = useState(false);
  const [createLoading, setCreateLoading] = useState(false);
  const [createError, setCreateError] = useState("");
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [availableSlots, setAvailableSlots] = useState([]);
  const [showAvailabilitySetup, setShowAvailabilitySetup] = useState(false);
  const [availabilitySaving, setAvailabilitySaving] = useState(false);
  const [availabilityError, setAvailabilityError] = useState("");
  const [availabilitySuccess, setAvailabilitySuccess] = useState("");
  const [availabilityForm, setAvailabilityForm] = useState({
    dayOfWeek: "1",
    startTime: "09:00",
    endTime: "17:00",
  });
  const [form, setForm] = useState({
    patientId: "",
    date: "",
    timeSlot: "",
    duration: "30",
    location: "",
    notes: "",
  });

  const patientNameById = useMemo(() => {
    const map = new Map();
    for (const patient of assignedPatients) {
      map.set(patient.id, patientDisplayName(patient));
    }
    return map;
  }, [assignedPatients]);

  const todayAppointments = useMemo(
    () => schedule.filter((appointment) => appointment.status !== "cancelled"),
    [schedule]
  );

  const nextAppointment = useMemo(() => {
    const now = Date.now();
    return todayAppointments.find((appointment) => new Date(appointment.startsAt).getTime() >= now) || null;
  }, [todayAppointments]);

  const nextAppointmentSubText = nextAppointment
    ? `Next: ${formatTime(nextAppointment.startsAt)} - ${
        patientNameById.get(nextAppointment.patientId) || nextAppointment.patient?.email || "Patient"
      }`
    : "No more appointments today";

  const upcomingAppointments = useMemo(
    () =>
      todayAppointments
        .filter((appointment) => new Date(appointment.startsAt).getTime() >= Date.now())
        .sort((left, right) => new Date(left.startsAt) - new Date(right.startsAt)),
    [todayAppointments]
  );

  const completedTodayCount = todayAppointments.filter((appointment) => appointment.status === "completed").length;
  const profileComplete = isDoctorProfileComplete(doctorProfile);
  const hasAvailability = availabilityEntries.some((entry) => entry.type === "workHours");
  const showOnboarding = !profileComplete || !hasAvailability;

  const loadDashboard = useCallback(async () => {
    setScheduleLoading(true);
    setScheduleError("");

    const [todayScheduleResult, appointmentsResult, overviewResult, profileResult, availabilityResult] = await Promise.allSettled([
      getDoctorSchedule({
        from: startOfToday().toISOString(),
        to: endOfToday().toISOString(),
      }),
      getMyAppointments(),
      fetchDoctorOverview(),
      fetchDoctorProfile(),
      fetchDoctorAvailabilityEntries(),
    ]);

    if (todayScheduleResult.status === "fulfilled") {
      setSchedule(todayScheduleResult.value.appointments || []);
    } else {
      setSchedule([]);
      setScheduleError(todayScheduleResult.reason?.message || "Failed to load today's schedule.");
    }

    if (appointmentsResult.status === "fulfilled") {
      const appointments = appointmentsResult.value.appointments || [];
      setRequestedAppointments(
        appointments
          .filter((appointment) => appointment.status === "requested")
          .sort((left, right) => new Date(left.startsAt) - new Date(right.startsAt))
      );
    } else {
      setRequestedAppointments([]);
    }

    if (overviewResult.status === "fulfilled") {
      const urgent = overviewResult.value.urgentPatients || [];
      const urgentIds = new Set(urgent.map((patient) => patient.id));
      setAssignedPatients((overviewResult.value.assignedPatients || []).map((patient) => ({
        ...patient,
        emergencyStatus: urgentIds.has(patient.id),
        emergencyStatusUpdatedAt: urgent.find((item) => item.id === patient.id)?.emergencyStatusUpdatedAt || null,
      })));
      setUrgentPatients(urgent);
      setRecentActivity(overviewResult.value.activityOverview?.items || []);
      setOverviewSummary(overviewResult.value.summary || null);
    } else {
      setAssignedPatients([]);
      setUrgentPatients([]);
      setRecentActivity([]);
      setOverviewSummary(null);
      setScheduleError((current) => current || overviewResult.reason?.message || "Failed to load doctor overview.");
    }

    if (profileResult.status === "fulfilled") {
      setDoctorProfile(profileResult.value);
    }

    if (availabilityResult.status === "fulfilled") {
      setAvailabilityEntries(availabilityResult.value || []);
    }

    setScheduleLoading(false);
  }, []);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  useEffect(() => {
    let cancelled = false;

    async function loadAvailability() {
      if (!showScheduleForm || !form.date) {
        setAvailableSlots([]);
        return;
      }

      const durationMinutes = Number(form.duration || "30");
      if (!Number.isInteger(durationMinutes) || durationMinutes <= 0) {
        setAvailableSlots([]);
        return;
      }

      try {
        setSlotsLoading(true);
        setCreateError("");

        const dayStart = new Date(`${form.date}T00:00:00`);
        const dayEnd = new Date(dayStart);
        dayEnd.setDate(dayEnd.getDate() + 1);

        const data = await getDoctorAvailability({
          from: dayStart.toISOString(),
          to: dayEnd.toISOString(),
          slotMinutes: durationMinutes,
        });

        if (!cancelled) {
          const now = Date.now();
          const slots = (data.slots || []).filter((slot) => new Date(slot.startsAt).getTime() > now);
          setAvailableSlots(slots);
        }
      } catch (err) {
        if (!cancelled) {
          setCreateError(err.message || "Failed to load available slots.");
          setAvailableSlots([]);
        }
      } finally {
        if (!cancelled) {
          setSlotsLoading(false);
        }
      }
    }

    loadAvailability();
    return () => {
      cancelled = true;
    };
  }, [form.date, form.duration, showScheduleForm]);

  async function submitSchedule(event) {
    event.preventDefault();
    setCreateError("");

    if (!form.patientId || !form.timeSlot) {
      setCreateError("Please select patient and an available time slot.");
      return;
    }

    const startsAt = new Date(form.timeSlot);
    const durationMinutes = Number(form.duration || "30");
    const endsAt = new Date(startsAt.getTime() + durationMinutes * 60 * 1000);

    const isAvailable = availableSlots.some((slot) => {
      return (
        new Date(slot.startsAt).getTime() === startsAt.getTime() &&
        new Date(slot.endsAt).getTime() === endsAt.getTime()
      );
    });

    if (!isAvailable) {
      setCreateError("Selected slot is no longer available.");
      return;
    }

    try {
      setCreateLoading(true);

      await createAppointment({
        patientId: form.patientId,
        startsAt: startsAt.toISOString(),
        endsAt: endsAt.toISOString(),
        location: form.location,
        notes: form.notes,
      });

      setForm({
        patientId: "",
        date: "",
        timeSlot: "",
        duration: "30",
        location: "",
        notes: "",
      });
      setShowScheduleForm(false);
      await loadDashboard();
    } catch (err) {
      setCreateError(err.message || "Failed to create appointment.");
    } finally {
      setCreateLoading(false);
    }
  }

  async function submitFirstAvailability(event) {
    event.preventDefault();
    setAvailabilityError("");
    setAvailabilitySuccess("");

    if (availabilityForm.endTime <= availabilityForm.startTime) {
      setAvailabilityError("End time must be after start time.");
      return;
    }

    try {
      setAvailabilitySaving(true);
      await createDoctorAvailabilityEntry({
        type: "workHours",
        dayOfWeek: Number(availabilityForm.dayOfWeek),
        startTime: availabilityForm.startTime,
        endTime: availabilityForm.endTime,
      });
      setAvailabilitySuccess("Your first weekly availability block is ready.");
      setShowAvailabilitySetup(false);
      await loadDashboard();
    } catch (err) {
      setAvailabilityError(err.message || "Failed to save availability.");
    } finally {
      setAvailabilitySaving(false);
    }
  }



  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />

      <main className="mx-auto max-w-7xl px-6 pb-10 pt-28">
        <section className="rounded-[2rem] bg-gradient-to-r from-slate-900 via-sky-800 to-cyan-600 p-8 text-white shadow-xl">
          <p className="text-sm font-semibold uppercase tracking-[0.25em] text-white/75">Doctor Dashboard</p>
          <h1 className="mt-3 text-4xl font-black">Welcome back, Dr. {greetingName}</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-white/85">
            Review today&apos;s work, respond to pending appointment requests, and track urgent patient signals from one place.
          </p>
        </section>

        {showOnboarding && (
          <section className="mt-6 rounded-3xl border border-sky-100 bg-white p-6 shadow-sm">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-600">Approved Doctor Onboarding</p>
                <h2 className="mt-2 text-2xl font-bold text-slate-900">Finish your setup before clinical work ramps up</h2>
                <p className="mt-2 max-w-2xl text-sm text-slate-500">
                  This checklist helps newly approved doctors complete the minimum setup needed to review requests, schedule patients, and start using the workspace confidently.
                </p>
              </div>
              <button
                type="button"
                onClick={() => navigate("/profileDoctor")}
                className="rounded-2xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800"
              >
                Open Doctor Profile
              </button>
            </div>

            <div className="mt-5 grid gap-4 lg:grid-cols-2">
              <div className={`rounded-2xl border p-4 ${profileComplete ? "border-emerald-200 bg-emerald-50" : "border-amber-200 bg-amber-50"}`}>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">Complete professional profile</p>
                    <p className="mt-1 text-sm text-slate-600">
                      Add specialization, experience, license number, clinic name, and clinic address so your doctor account is presentation-ready.
                    </p>
                  </div>
                  <span className={`rounded-full px-3 py-1 text-xs font-semibold ${profileComplete ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
                    {profileComplete ? "Done" : "Needs attention"}
                  </span>
                </div>
              </div>

              <div className={`rounded-2xl border p-4 ${hasAvailability ? "border-emerald-200 bg-emerald-50" : "border-sky-200 bg-sky-50"}`}>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">Add your first availability block</p>
                    <p className="mt-1 text-sm text-slate-600">
                      Weekly availability lets appointment requests and scheduling flows reflect realistic working hours.
                    </p>
                  </div>
                  <span className={`rounded-full px-3 py-1 text-xs font-semibold ${hasAvailability ? "bg-emerald-100 text-emerald-700" : "bg-sky-100 text-sky-700"}`}>
                    {hasAvailability ? `${availabilityEntries.length} entries` : "Set up now"}
                  </span>
                </div>

                {!hasAvailability && (
                  <div className="mt-4">
                    <button
                      type="button"
                      onClick={() => {
                        setAvailabilityError("");
                        setAvailabilitySuccess("");
                        setShowAvailabilitySetup((current) => !current);
                      }}
                      className="rounded-xl border border-sky-300 bg-white px-4 py-2 text-sm font-semibold text-sky-700 transition hover:bg-sky-50"
                    >
                      {showAvailabilitySetup ? "Hide availability setup" : "Add first weekly hours"}
                    </button>
                  </div>
                )}
              </div>
            </div>

            {availabilitySuccess && (
              <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                {availabilitySuccess}
              </div>
            )}

            {!hasAvailability && showAvailabilitySetup && (
              <form onSubmit={submitFirstAvailability} className="mt-4 grid gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 md:grid-cols-4">
                <select
                  value={availabilityForm.dayOfWeek}
                  onChange={(event) => setAvailabilityForm((current) => ({ ...current, dayOfWeek: event.target.value }))}
                  className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
                >
                  <option value="0">Sunday</option>
                  <option value="1">Monday</option>
                  <option value="2">Tuesday</option>
                  <option value="3">Wednesday</option>
                  <option value="4">Thursday</option>
                  <option value="5">Friday</option>
                  <option value="6">Saturday</option>
                </select>
                <input
                  type="time"
                  value={availabilityForm.startTime}
                  onChange={(event) => setAvailabilityForm((current) => ({ ...current, startTime: event.target.value }))}
                  className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
                  required
                />
                <input
                  type="time"
                  value={availabilityForm.endTime}
                  onChange={(event) => setAvailabilityForm((current) => ({ ...current, endTime: event.target.value }))}
                  className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
                  required
                />
                <button
                  type="submit"
                  disabled={availabilitySaving}
                  className="rounded-xl bg-sky-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-sky-700 disabled:opacity-70"
                >
                  {availabilitySaving ? "Saving..." : "Save weekly hours"}
                </button>
                {availabilityError ? (
                  <p className="md:col-span-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                    {availabilityError}
                  </p>
                ) : null}
              </form>
            )}
          </section>
        )}

        <section className="mt-6 grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
          <DashboardCard
            title="Today's Appointments"
            mainText={`${todayAppointments.length}`}
            subText={nextAppointmentSubText}
            navPage="/doctorAppointments"
            tone="sky"
          />
          <DashboardCard
            title="Pending Requests"
            mainText={`${requestedAppointments.length}`}
            subText={requestedAppointments.length ? "Needs doctor review" : "No pending requests"}
            navPage="/doctorAppointments"
            tone="amber"
          />
          <DashboardCard
            title="Urgent Patients"
            mainText={`${urgentPatients.length}`}
            subText={urgentPatients.length ? "Emergency alerts are active" : "No active emergency alerts"}
            navPage="/doctorAppointments"
            tone="rose"
          />
          <DashboardCard
            title="Assigned Patients"
            mainText={`${assignedPatients.length}`}
            subText="Active doctor-patient links"
            navPage="/doctorAppointments"
            tone="emerald"
          />
        </section>

        {scheduleError && (
          <div className="mt-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {scheduleError}
          </div>
        )}

        <section className="mt-6 grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="rounded-3xl bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold text-slate-900">Pending appointment requests</h2>
                <p className="mt-1 text-sm text-slate-500">
                  New patient appointment requests surface here so they are visible before you open the full appointments workspace.
                </p>
              </div>
              <button
                type="button"
                onClick={() => navigate("/doctorAppointments")}
                className="rounded-2xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
              >
                Open appointments
              </button>
            </div>

            <div className="mt-5 space-y-3">
              {scheduleLoading ? (
                <div className="rounded-2xl border border-dashed border-slate-200 p-6 text-sm text-slate-500">
                  Loading requests...
                </div>
              ) : requestedAppointments.length > 0 ? (
                requestedAppointments.slice(0, 4).map((appointment) => (
                  <div key={appointment.id} className="rounded-2xl border border-amber-100 bg-amber-50/60 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold text-slate-900">
                          {patientNameById.get(appointment.patient?.id || appointment.patientId) || appointment.patient?.email || "Patient"}
                        </p>
                        <p className="mt-1 text-sm text-slate-500">
                          {formatDate(appointment.startsAt)} at {formatTime(appointment.startsAt)}
                        </p>
                      </div>
                      <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-700">
                        Requested
                      </span>
                    </div>
                    <p className="mt-3 text-sm text-slate-600">
                      {appointment.notes || "No patient note was included with this request."}
                    </p>
                  </div>
                ))
              ) : (
                <div className="rounded-2xl border border-dashed border-slate-200 p-6 text-sm text-slate-500">
                  No pending appointment requests right now.
                </div>
              )}
            </div>
          </div>

          <div className="rounded-3xl bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold text-slate-900">Urgent patients and emergency alerts</h2>
                <p className="mt-1 text-sm text-slate-500">
                  Patients with an active emergency status are prioritized here so the dashboard makes urgent signals immediately visible.
                </p>
              </div>
              <button
                type="button"
                onClick={loadDashboard}
                className="rounded-2xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
              >
                Refresh
              </button>
            </div>

            <div className="mt-5 space-y-3">
              {scheduleLoading ? (
                <div className="rounded-2xl border border-dashed border-slate-200 p-6 text-sm text-slate-500">
                  Loading alerts...
                </div>
              ) : urgentPatients.length > 0 ? (
                urgentPatients.map((patient) => (
                  <div key={patient.id} className="rounded-2xl border border-rose-200 bg-rose-50 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold text-slate-900">{patient.displayName}</p>
                        <p className="mt-1 text-sm text-rose-700">Emergency status active</p>
                      </div>
                      <span className="rounded-full bg-rose-100 px-3 py-1 text-xs font-semibold text-rose-700">
                        {patient.emergencyStatusUpdatedAt ? `Updated ${formatDateTime(patient.emergencyStatusUpdatedAt)}` : "Needs review"}
                      </span>
                    </div>
                  </div>
                ))
              ) : (
                <div className="rounded-2xl border border-dashed border-slate-200 p-6 text-sm text-slate-500">
                  No patients currently have an active emergency alert.
                </div>
              )}
            </div>
          </div>
        </section>

        <section className="mt-6 grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="rounded-3xl bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold text-slate-900">Recent patient activity</h2>
                <p className="mt-1 text-sm text-slate-500">
                  A live feed of symptoms, notes, diagnosis updates, and appointment events across your assigned patients.
                </p>
              </div>
            </div>

            <div className="mt-5 space-y-3">
              {scheduleLoading ? (
                <div className="rounded-2xl border border-dashed border-slate-200 p-6 text-sm text-slate-500">
                  Loading activity...
                </div>
              ) : recentActivity.length > 0 ? (
                recentActivity.slice(0, 8).map((item) => (
                  <div key={`${item.type}-${item.entityId}`} className="rounded-2xl border border-slate-200 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-600">{activityTypeLabel(item.type)}</p>
                        <p className="mt-1 font-semibold text-slate-900">{item.patient?.displayName || "Patient"}</p>
                      </div>
                      <span className="text-xs font-medium text-slate-400">{formatDateTime(item.activityAt)}</span>
                    </div>
                    <p className="mt-3 text-sm text-slate-600">{activityDescription(item)}</p>
                  </div>
                ))
              ) : (
                <div className="rounded-2xl border border-dashed border-slate-200 p-6 text-sm text-slate-500">
                  No recent patient activity yet.
                </div>
              )}
            </div>
          </div>

          <div className="space-y-6">
            <section className="rounded-3xl bg-white p-6 shadow-sm">
              <h2 className="text-xl font-semibold text-slate-900">Doctor summary</h2>
              <div className="mt-4 grid gap-3 text-sm text-slate-600 sm:grid-cols-2">
                <div className="rounded-2xl bg-slate-50 p-4">
                  <p className="text-slate-500">Assigned patients</p>
                  <p className="mt-1 text-2xl font-bold text-slate-900">{assignedPatients.length}</p>
                </div>
                <div className="rounded-2xl bg-slate-50 p-4">
                  <p className="text-slate-500">Pending patient requests</p>
                  <p className="mt-1 text-2xl font-bold text-slate-900">{overviewSummary?.pendingPatientRequestsCount || 0}</p>
                </div>
                <div className="rounded-2xl bg-slate-50 p-4">
                  <p className="text-slate-500">Appointments next 7 days</p>
                  <p className="mt-1 text-2xl font-bold text-slate-900">{overviewSummary?.upcomingAppointmentsNext7Days || 0}</p>
                </div>
                <div className="rounded-2xl bg-slate-50 p-4">
                  <p className="text-slate-500">Patients with symptoms this week</p>
                  <p className="mt-1 text-2xl font-bold text-slate-900">{overviewSummary?.patientsWithSymptomsLast7Days || 0}</p>
                </div>
              </div>
            </section>

            <section className="rounded-3xl bg-white p-6 shadow-sm">
              <h2 className="text-xl font-semibold text-slate-900">Today&apos;s schedule</h2>
              <div className="mt-4 space-y-3">
                {scheduleLoading ? (
                  <div className="rounded-2xl border border-dashed border-slate-200 p-6 text-sm text-slate-500">
                    Loading schedule...
                  </div>
                ) : upcomingAppointments.length > 0 ? (
                  upcomingAppointments.slice(0, 5).map((appointment) => (
                    <div key={appointment.id} className="rounded-2xl border border-slate-200 p-4">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <p className="font-semibold text-slate-900">
                            {patientNameById.get(appointment.patientId) || appointment.patient?.email || "Patient"}
                          </p>
                          <p className="mt-1 text-sm text-slate-500">
                            {formatTime(appointment.startsAt)} - {formatTime(appointment.endsAt)}
                          </p>
                        </div>
                        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${statusClasses(appointment.status)}`}>
                          {statusLabel(appointment.status)}
                        </span>
                      </div>
                      <p className="mt-2 text-sm text-slate-600">
                        {appointment.location || "Location pending"} | {appointment.notes || "No notes"}
                      </p>
                    </div>
                  ))
                ) : (
                  <div className="rounded-2xl border border-dashed border-slate-200 p-6 text-sm text-slate-500">
                    No upcoming appointments for today.
                  </div>
                )}
              </div>
            </section>

            <section className="rounded-3xl bg-white p-6 shadow-sm">
              <h2 className="text-xl font-semibold text-slate-900">Quick actions</h2>

              <div className="mt-4 grid gap-3">
                {[
                  {
                    label: showScheduleForm ? "Hide schedule form" : "Schedule appointment",
                    onClick: () => {
                      setCreateError("");
                      setShowScheduleForm((current) => !current);
                    },
                    style: "bg-emerald-100 text-emerald-700",
                  },
                  { label: "Review appointments", onClick: () => navigate("/doctorAppointments"), style: "bg-sky-100 text-sky-700" },
                  { label: "Open doctor profile", onClick: () => navigate("/profileDoctor"), style: "bg-indigo-100 text-indigo-700" },
                ].map((action) => (
                  <button
                    key={action.label}
                    type="button"
                    onClick={action.onClick}
                    className={`rounded-2xl px-4 py-3 text-left text-sm font-semibold transition hover:opacity-85 ${action.style}`}
                  >
                    {action.label}
                  </button>
                ))}
              </div>
            </section>

            {showScheduleForm && (
              <section className="rounded-3xl bg-white p-6 shadow-sm">
                <form onSubmit={submitSchedule} className="space-y-3">
                  <h3 className="text-lg font-semibold text-slate-900">Create appointment</h3>

                  <select
                    value={form.patientId}
                    onChange={(event) => setForm((current) => ({ ...current, patientId: event.target.value }))}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                    required
                  >
                    <option value="">Select patient</option>
                    {assignedPatients.map((patient) => (
                      <option key={patient.id} value={patient.id}>
                        {patientDisplayName(patient)}
                      </option>
                    ))}
                  </select>

                  <input
                    type="date"
                    value={form.date}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, date: event.target.value, timeSlot: "" }))
                    }
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                    required
                  />

                  <select
                    value={form.duration}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, duration: event.target.value, timeSlot: "" }))
                    }
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                    required
                  >
                    <option value="15">15 minutes</option>
                    <option value="30">30 minutes</option>
                    <option value="45">45 minutes</option>
                    <option value="60">60 minutes</option>
                  </select>

                  <select
                    value={form.timeSlot}
                    onChange={(event) => setForm((current) => ({ ...current, timeSlot: event.target.value }))}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                    required
                    disabled={!form.date || slotsLoading}
                  >
                    <option value="">
                      {!form.date
                        ? "Select date first"
                        : slotsLoading
                        ? "Loading available slots..."
                        : availableSlots.length === 0
                        ? "No available slots"
                        : "Select available time"}
                    </option>
                    {availableSlots.map((slot) => (
                      <option key={slot.startsAt} value={slot.startsAt}>
                        {formatTime(slot.startsAt)} - {formatTime(slot.endsAt)}
                      </option>
                    ))}
                  </select>

                  <input
                    type="text"
                    value={form.location}
                    onChange={(event) => setForm((current) => ({ ...current, location: event.target.value }))}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                    placeholder="Clinic/location"
                  />

                  <textarea
                    value={form.notes}
                    onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                    placeholder="Notes"
                    rows={3}
                  />

                  {createError && (
                    <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                      {createError}
                    </p>
                  )}

                  <button
                    type="submit"
                    disabled={createLoading || assignedPatients.length === 0}
                    className="w-full rounded-xl bg-emerald-600 px-4 py-2 font-medium text-white transition hover:bg-emerald-700 disabled:opacity-70"
                  >
                    {createLoading ? "Creating..." : "Create Appointment"}
                  </button>
                </form>
              </section>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
