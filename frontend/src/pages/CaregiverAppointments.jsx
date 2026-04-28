
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "../components/Navbar";
import { apiUrl, authHeaders } from "../api/http";
import {
  getCaregiverPatientDoctors,
  caregiverRequestAppointment,
  getCaregiverPatientAppointmentAvailability,
  getCaregiverPatientAppointments,
} from "../api/caregiver";
import { reviewAppointmentReschedule, markAppointmentComplete } from "../api/appointments";
import {
  resolveActiveCaregiverPatientId,
  setActiveCaregiverPatientId,
} from "../utils/caregiverPatientContext";

function patientLabel(record) {
  return record?.patient?.displayName || record?.patient?.email || "Patient";
}

function doctorLabel(appointment) {
  return appointment?.doctor?.displayName || appointment?.doctor?.email || "Doctor";
}

function formatDateTimeParts(dateLike) {
  const date = new Date(dateLike);
  return {
    date: date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
    time: date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }),
  };
}

function formatUtcDateTime(dateLike) {
  const date = new Date(dateLike);
  const datePart = date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
  const timePart = date.toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
    timeZone: "UTC",
    hour12: true,
  });
  return `${datePart} at ${timePart} UTC`;
}

function statusLabel(status) {
  if (status === "requested") return "Requested";
  if (status === "scheduled") return "Scheduled";
  if (status === "completed") return "Completed";
  if (status === "cancelled") return "Cancelled";
  if (status === "denied") return "Denied";
  if (status === "reschedule_requested") return "Reschedule Requested";
  return status || "Unknown";
}

function statusClass(status) {
  if (status === "requested") return "bg-amber-100 text-amber-700";
  if (status === "scheduled") return "bg-emerald-100 text-emerald-700";
  if (status === "completed") return "bg-sky-100 text-sky-700";
  if (status === "cancelled") return "bg-slate-200 text-slate-700";
  if (status === "denied") return "bg-rose-100 text-rose-700";
  if (status === "reschedule_requested") return "bg-violet-100 text-violet-700";
  return "bg-slate-100 text-slate-700";
}

export default function CaregiverAppointments() {
  const navigate = useNavigate();
  const localTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || "Local timezone";

  const [linkedPatients, setLinkedPatients] = useState([]);
  const [doctorOptions, setDoctorOptions] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [activePatientId, setActivePatientId] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [form, setForm] = useState({ doctorId: "", date: "", duration: "30", timeSlot: "", location: "", notes: "" });
  const [availableSlots, setAvailableSlots] = useState([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [availabilityDoctor, setAvailabilityDoctor] = useState(null);
  const [requestMessage, setRequestMessage] = useState(null);
  const [requesting, setRequesting] = useState(false);
  const [rescheduleLoadingId, setRescheduleLoadingId] = useState("");
  const [completionLoadingId, setCompletionLoadingId] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadPatients() {
      setLoading(true);
      setError("");
      try {
        const res = await fetch(`${apiUrl}/api/caregivers/patients`, {
          headers: { "Content-Type": "application/json", ...authHeaders() },
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.message || "Failed to load linked patients.");

        if (cancelled) return;

        const patients = data.patients || [];
        const resolvedId = resolveActiveCaregiverPatientId(patients);
        setLinkedPatients(patients);
        setActivePatientId(resolvedId);
      } catch (err) {
        if (!cancelled) setError(err.message || "Failed to load patients.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadPatients();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!activePatientId) return;

    const entry = linkedPatients.find((r) => r.patient?.id === activePatientId);
    // Only fetch if canViewAppointments — exact field from CaregiverPatientPermission
    if (!entry?.permissions?.canViewAppointments) {
      setAppointments([]);
      return;
    }

    getCaregiverPatientAppointments(activePatientId)
      .then((data) => setAppointments(data.appointments || []))
      .catch(() => setAppointments([]));
  }, [activePatientId, linkedPatients]);

  useEffect(() => {
    if (!activePatientId) {
      setDoctorOptions([]);
      return;
    }

    const entry = linkedPatients.find((r) => r.patient?.id === activePatientId);
    if (!entry?.permissions?.canViewAppointments) {
      setDoctorOptions([]);
      return;
    }

    getCaregiverPatientDoctors(activePatientId)
      .then((data) => setDoctorOptions(Array.isArray(data.doctors) ? data.doctors : []))
      .catch(() => setDoctorOptions([]));
  }, [activePatientId, linkedPatients]);

  const activePatientRecord = useMemo(
    () => linkedPatients.find((r) => r.patient?.id === activePatientId) || null,
    [activePatientId, linkedPatients]
  );

  const canViewAppointments = Boolean(activePatientRecord?.permissions?.canViewAppointments);

  useEffect(() => {
    let cancelled = false;

    async function loadAvailability() {
      if (!isModalOpen || !activePatientId || !form.doctorId || !form.date || !canViewAppointments) {
        setAvailableSlots([]);
        setAvailabilityDoctor(null);
        return;
      }

      try {
        setSlotsLoading(true);
        setRequestMessage(null);

        const dayStart = new Date(`${form.date}T00:00:00`);
        const dayEnd = new Date(dayStart);
        dayEnd.setDate(dayEnd.getDate() + 1);

        const data = await getCaregiverPatientAppointmentAvailability({
          patientId: activePatientId,
          doctorId: form.doctorId,
          from: dayStart.toISOString(),
          to: dayEnd.toISOString(),
          slotMinutes: Number(form.duration || "30"),
        });

        if (!cancelled) {
          const now = Date.now();
          setAvailabilityDoctor(data.doctor || null);
          setAvailableSlots((data.slots || []).filter((slot) => new Date(slot.startsAt).getTime() > now));
        }
      } catch (err) {
        if (!cancelled) {
          setAvailableSlots([]);
          setAvailabilityDoctor(null);
          setRequestMessage(err.message || "Failed to load doctor availability.");
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
  }, [activePatientId, canViewAppointments, form.date, form.doctorId, form.duration, isModalOpen]);

  useEffect(() => {
    if (!availableSlots.length) {
      if (form.timeSlot) {
        setForm((current) => ({ ...current, timeSlot: "" }));
      }
      return;
    }

    const hasSelectedSlot = availableSlots.some((slot) => slot.startsAt === form.timeSlot);
    if (!hasSelectedSlot) {
      setForm((current) => ({ ...current, timeSlot: availableSlots[0].startsAt }));
    }
  }, [availableSlots, form.timeSlot]);

  useEffect(() => {
    if (!isModalOpen) return;
    if (form.doctorId) return;
    if (!doctorOptions.length) return;

    setForm((current) => ({ ...current, doctorId: doctorOptions[0].id }));
  }, [doctorOptions, form.doctorId, isModalOpen]);

  const handleRequest = async () => {
    if (!form.doctorId || !form.date || !form.timeSlot) {
      setRequestMessage("Select doctor, date, and available time slot.");
      return;
    }

    const durationMinutes = Number(form.duration || "30");
    if (!Number.isInteger(durationMinutes) || durationMinutes <= 0) {
      setRequestMessage("Choose a valid appointment duration.");
      return;
    }

    setRequesting(true);
    setRequestMessage(null);
    try {
      const startsAt = new Date(form.timeSlot);
      const endsAt = new Date(startsAt.getTime() + durationMinutes * 60000);

      await caregiverRequestAppointment(activePatientId, {
        doctorId: form.doctorId,
        startsAt: startsAt.toISOString(),
        endsAt: endsAt.toISOString(),
        location: form.location || null,
        notes: form.notes || null,
      });
      setRequestMessage("Appointment requested successfully.");
      setIsModalOpen(false);
      setForm({ doctorId: "", date: "", duration: "30", timeSlot: "", location: "", notes: "" });
      setAvailableSlots([]);
      setAvailabilityDoctor(null);
      // Refresh appointments
      getCaregiverPatientAppointments(activePatientId)
        .then((data) => setAppointments(data.appointments || []))
        .catch(() => {});
    } catch (err) {
      setRequestMessage(err.message || "Failed to request appointment.");
    } finally {
      setRequesting(false);
    }
  };

  const handleReviewReschedule = async (appointmentId, decision) => {
    setRescheduleLoadingId(appointmentId);
    try {
      await reviewAppointmentReschedule(appointmentId, decision);
      // Refresh appointments after decision
      getCaregiverPatientAppointments(activePatientId)
        .then((data) => setAppointments(data.appointments || []))
        .catch(() => {});
    } catch (err) {
      setError(err.message || `Failed to ${decision} reschedule request.`);
    } finally {
      setRescheduleLoadingId("");
    }
  };

  const handleMarkComplete = async (appointmentId) => {
    setCompletionLoadingId(appointmentId);
    try {
      await markAppointmentComplete(appointmentId);
      // Refresh appointments after marking complete
      getCaregiverPatientAppointments(activePatientId)
        .then((data) => setAppointments(data.appointments || []))
        .catch(() => {});
    } catch (err) {
      setError(err.message || "Failed to mark appointment as completed.");
    } finally {
      setCompletionLoadingId("");
    }
  };

  // Organize appointments by status for clearer UI
  const appointmentsByStatus = useMemo(() => {
    const categories = {
      actionNeeded: [], // reschedule_requested from doctor
      upcoming: [],     // scheduled future appointments
      pending: [],      // requested (awaiting approval)
      completed: [],    // completed, denied, cancelled, or past appointments
    };

    appointments.forEach((appt) => {
      if (appt.status === "reschedule_requested" && appt.rescheduleRequestedBy === "doctor") {
        // Doctor-requested reschedules need caregiver action
        categories.actionNeeded.push(appt);
      } else if (appt.status === "scheduled" && new Date(appt.startsAt).getTime() >= Date.now()) {
        // Future scheduled appointments
        categories.upcoming.push(appt);
      } else if (appt.status === "requested") {
        // Pending approval from doctor
        categories.pending.push(appt);
      } else {
        // Everything else goes to completed/archived: completed, denied, cancelled, past scheduled, patient-requested reschedules
        categories.completed.push(appt);
      }
    });

    // Sort each category
    categories.actionNeeded.sort((a, b) => {
      const aTime = a.proposedStartsAt ? new Date(a.proposedStartsAt) : new Date(a.startsAt);
      const bTime = b.proposedStartsAt ? new Date(b.proposedStartsAt) : new Date(b.startsAt);
      return aTime - bTime;
    });
    categories.upcoming.sort((a, b) => new Date(a.startsAt) - new Date(b.startsAt));
    categories.pending.sort((a, b) => new Date(a.startsAt) - new Date(b.startsAt));
    categories.completed.sort((a, b) => new Date(b.startsAt) - new Date(a.startsAt));

    return categories;
  }, [appointments]);

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />

      <main className="mx-auto max-w-6xl px-6 pb-10 pt-28">
        {/* Header */}
        <section className="rounded-[2rem] bg-gradient-to-r from-slate-900 via-cyan-800 to-sky-600 p-8 text-white shadow-xl">
          <p className="text-sm font-semibold uppercase tracking-[0.25em] text-white/75">
            Caregiver Appointments
          </p>
          <h1 className="mt-3 text-4xl font-black">Patient Visit Timeline</h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-white/85">
            Track scheduled, requested, and completed appointments for your active patient context.
          </p>

          <div className="mt-5 max-w-sm">
            <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-white/70">
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
              disabled={linkedPatients.length === 0}
            >
              {linkedPatients.length > 0 ? (
                linkedPatients.map((record) => (
                  <option key={record.patient?.id} value={record.patient?.id || ""}>
                    {patientLabel(record)}
                  </option>
                ))
              ) : (
                <option value="">No linked patients</option>
              )}
            </select>
          </div>
        </section>

        {error && (
          <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {requestMessage && (
          <div className="mt-4 rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-700">
            {requestMessage}
          </div>
        )}

        {loading ? (
          <section className="mt-6 rounded-3xl border border-slate-200 bg-white p-8 text-sm text-slate-500 shadow-sm">
            Loading caregiver appointments...
          </section>
        ) : linkedPatients.length === 0 ? (
          <section className="mt-6 rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
            <h2 className="text-xl font-semibold text-slate-900">No linked patients yet</h2>
            <p className="mt-2 text-sm text-slate-600">
              Accept a patient invitation first to unlock appointment visibility.
            </p>
            <button
              type="button"
              onClick={() => navigate("/caregiverAcceptInvite")}
              className="mt-5 rounded-2xl bg-cyan-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-cyan-600"
            >
              Enter patient invite link
            </button>
          </section>
        ) : (
          <>
            {/* Request button */}
            <div className="mt-6 flex justify-end">
              {canViewAppointments && (
                <button
                  type="button"
                  onClick={() => {
                    setRequestMessage(null);
                    setAvailableSlots([]);
                    setAvailabilityDoctor(null);
                    setForm({ doctorId: "", date: "", duration: "30", timeSlot: "", location: "", notes: "" });
                    setIsModalOpen(true);
                  }}
                  className="rounded-2xl bg-sky-500 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-sky-600"
                >
                  + Request Appointment
                </button>
              )}
            </div>

            {!canViewAppointments && (
              <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
                This patient has not granted appointment visibility. Ask them to enable it from their Care Team settings.
              </div>
            )}

            {canViewAppointments && (
              <>
                {/* SECTION 1: Action Needed - Reschedule requests from doctor */}
                {appointmentsByStatus.actionNeeded.length > 0 && (
                  <section className="mt-8 rounded-3xl border-2 border-violet-300 bg-gradient-to-br from-violet-50 to-violet-100 p-6 shadow-md">
                    <div className="mb-5 flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-violet-500 text-white font-bold">
                        ⚡
                      </div>
                      <div>
                        <h2 className="text-xl font-bold text-violet-900">Action Needed</h2>
                        <p className="text-sm text-violet-700">{appointmentsByStatus.actionNeeded.length} reschedule request{appointmentsByStatus.actionNeeded.length !== 1 ? 's' : ''}</p>
                      </div>
                    </div>
                    <div className="space-y-4">
                      {appointmentsByStatus.actionNeeded.map((appointment) => {
                        const proposed = formatDateTimeParts(appointment.proposedStartsAt);
                        const current = formatDateTimeParts(appointment.startsAt);
                        return (
                          <article key={appointment.id} className="rounded-2xl border-2 border-violet-300 bg-white p-5 shadow-sm">
                            <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                              <div>
                                <p className="text-sm text-slate-600">Current appointment:</p>
                                <p className="font-semibold text-slate-900">{current.date} at {current.time}</p>
                                <p className="mt-2 text-sm text-slate-600">Doctor proposes:</p>
                                <p className="font-bold text-violet-700">{proposed.date} at {proposed.time}</p>
                                <p className="mt-2 text-xs text-slate-500">With {doctorLabel(appointment)}</p>
                              </div>
                              <div className="flex gap-2">
                                <button
                                  type="button"
                                  onClick={() => handleReviewReschedule(appointment.id, "approve")}
                                  disabled={rescheduleLoadingId === appointment.id}
                                  className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-bold text-white hover:bg-emerald-600 disabled:opacity-70 transition"
                                >
                                  ✓ Accept
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleReviewReschedule(appointment.id, "deny")}
                                  disabled={rescheduleLoadingId === appointment.id}
                                  className="rounded-lg bg-rose-500 px-4 py-2 text-sm font-bold text-white hover:bg-rose-600 disabled:opacity-70 transition"
                                >
                                  ✕ Decline
                                </button>
                              </div>
                            </div>
                            {appointment.rescheduleNotes && (
                              <div className="mt-3 rounded-lg bg-violet-100 px-3 py-2 text-sm text-violet-800 border-l-4 border-violet-500">
                                <strong>Doctor's note:</strong> {appointment.rescheduleNotes}
                              </div>
                            )}
                          </article>
                        );
                      })}
                    </div>
                  </section>
                )}

                {/* SECTION 2: Upcoming - Scheduled appointments */}
                {appointmentsByStatus.upcoming.length > 0 && (
                  <section className="mt-8 rounded-3xl border-2 border-emerald-300 bg-gradient-to-br from-emerald-50 to-emerald-100 p-6 shadow-md">
                    <div className="mb-5 flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-500 text-white font-bold">
                        📅
                      </div>
                      <div>
                        <h2 className="text-xl font-bold text-emerald-900">Upcoming</h2>
                        <p className="text-sm text-emerald-700">{appointmentsByStatus.upcoming.length} scheduled appointment{appointmentsByStatus.upcoming.length !== 1 ? 's' : ''}</p>
                      </div>
                    </div>
                    <div className="space-y-3">
                      {appointmentsByStatus.upcoming.map((appointment) => {
                        const dt = formatDateTimeParts(appointment.startsAt);
                        return (
                          <article key={appointment.id} className="rounded-2xl border border-emerald-300 bg-white p-4 shadow-sm">
                            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                              <div>
                                <p className="font-bold text-slate-900">{dt.date} at {dt.time}</p>
                                <p className="text-sm text-slate-600">With {doctorLabel(appointment)}</p>
                                {appointment.location && <p className="text-xs text-slate-500">📍 {appointment.location}</p>}
                              </div>
                              <span className={`rounded-full px-3 py-1 text-xs font-semibold ${statusClass(appointment.status)}`}>
                                {statusLabel(appointment.status)}
                              </span>
                            </div>
                          </article>
                        );
                      })}
                    </div>
                  </section>
                )}

                {/* SECTION 3: Pending - Requests awaiting doctor approval */}
                {appointmentsByStatus.pending.length > 0 && (
                  <section className="mt-8 rounded-3xl border-2 border-amber-300 bg-gradient-to-br from-amber-50 to-amber-100 p-6 shadow-md">
                    <div className="mb-5 flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-500 text-white font-bold">
                        ⏳
                      </div>
                      <div>
                        <h2 className="text-xl font-bold text-amber-900">Pending</h2>
                        <p className="text-sm text-amber-700">{appointmentsByStatus.pending.length} awaiting doctor approval</p>
                      </div>
                    </div>
                    <div className="space-y-3">
                      {appointmentsByStatus.pending.map((appointment) => {
                        const dt = formatDateTimeParts(appointment.startsAt);
                        return (
                          <article key={appointment.id} className="rounded-2xl border border-amber-300 bg-white p-4 shadow-sm">
                            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                              <div>
                                <p className="font-semibold text-slate-900">{dt.date} at {dt.time}</p>
                                <p className="text-sm text-slate-600">Requested with {doctorLabel(appointment)}</p>
                              </div>
                              <span className={`rounded-full px-3 py-1 text-xs font-semibold ${statusClass(appointment.status)}`}>
                                {statusLabel(appointment.status)}
                              </span>
                            </div>
                          </article>
                        );
                      })}
                    </div>
                  </section>
                )}

                {/* SECTION 4: Completed - Done, Denied, Cancelled */}
                {appointmentsByStatus.completed.length > 0 && (
                  <section className="mt-8 rounded-3xl border-2 border-slate-300 bg-gradient-to-br from-slate-50 to-slate-100 p-6 shadow-md">
                    <div className="mb-5 flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-500 text-white font-bold">
                        📋
                      </div>
                      <div>
                        <h2 className="text-xl font-bold text-slate-900">Completed & Archived</h2>
                        <p className="text-sm text-slate-700">{appointmentsByStatus.completed.length} past appointment{appointmentsByStatus.completed.length !== 1 ? 's' : ''}</p>
                      </div>
                    </div>
                    <div className="space-y-3">
                      {appointmentsByStatus.completed.slice(0, 10).map((appointment) => {
                        const dt = formatDateTimeParts(appointment.startsAt);
                        const canMarkComplete = appointment.status !== "completed" && ["scheduled", "requested"].includes(appointment.status);
                        return (
                          <article key={appointment.id} className="rounded-2xl border border-slate-300 bg-white p-4 shadow-sm">
                            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                              <div>
                                <p className="text-sm text-slate-600">{dt.date}</p>
                                <p className="font-medium text-slate-900">{dt.time} • {doctorLabel(appointment)}</p>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className={`rounded-full px-3 py-1 text-xs font-semibold ${statusClass(appointment.status)}`}>
                                  {statusLabel(appointment.status)}
                                </span>
                                {canMarkComplete && (
                                  <button
                                    type="button"
                                    onClick={() => handleMarkComplete(appointment.id)}
                                    disabled={completionLoadingId === appointment.id}
                                    className="rounded-lg bg-sky-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-sky-600 disabled:opacity-70 transition"
                                  >
                                    Mark done
                                  </button>
                                )}
                              </div>
                            </div>
                          </article>
                        );
                      })}
                    </div>
                  </section>
                )}

                {/* Empty state */}
                {appointmentsByStatus.actionNeeded.length === 0 &&
                  appointmentsByStatus.upcoming.length === 0 &&
                  appointmentsByStatus.pending.length === 0 &&
                  appointmentsByStatus.completed.length === 0 && (
                    <section className="mt-8 rounded-3xl border-2 border-dashed border-slate-300 bg-slate-50 p-8 text-center">
                      <p className="text-lg font-semibold text-slate-700">No appointments</p>
                      <p className="mt-1 text-sm text-slate-600">Request your first appointment to get started</p>
                    </section>
                  )}
              </>
            )}
          </>
        )}
      </main>

      {/* Request Appointment Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-xl">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-xl font-semibold text-slate-900">Request Appointment</h2>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 transition"
              >
                ✕
              </button>
            </div>

            <p className="text-sm text-slate-500 mb-5">
              Requesting on behalf of <strong>{patientLabel(activePatientRecord)}</strong>.
              The doctor will review and confirm.
            </p>

            <div className="mb-4 rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-900">
              Select the doctor first, then choose a date to load live slots.
            </div>

            {availabilityDoctor ? (
              <div className="mb-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
                Requesting with: <strong>{availabilityDoctor.displayName || availabilityDoctor.email || "Doctor"}</strong>
              </div>
            ) : null}

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Doctor
                </label>
                <select
                  value={form.doctorId}
                  onChange={(e) => setForm((f) => ({ ...f, doctorId: e.target.value, timeSlot: "" }))}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                >
                  <option value="">Select doctor</option>
                  {doctorOptions.map((doctor) => (
                    <option key={doctor.id} value={doctor.id}>
                      {doctor.displayName || doctor.email || "Doctor"}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Date
                </label>
                <input
                  type="date"
                  value={form.date}
                  onChange={(e) => setForm((f) => ({ ...f, date: e.target.value, timeSlot: "" }))}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Duration
                </label>
                <select
                  value={form.duration}
                  onChange={(e) => setForm((f) => ({ ...f, duration: e.target.value, timeSlot: "" }))}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                >
                  <option value="30">30 minutes</option>
                  <option value="45">45 minutes</option>
                  <option value="60">60 minutes</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Available time slot
                </label>
                <select
                  value={form.timeSlot}
                  onChange={(e) => setForm((f) => ({ ...f, timeSlot: e.target.value }))}
                  disabled={!form.doctorId || !form.date || slotsLoading}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 disabled:bg-slate-50"
                >
                  <option value="">
                    {!form.doctorId
                      ? "Select doctor first"
                      : !form.date
                      ? "Select date first"
                      : slotsLoading
                      ? "Loading slots..."
                      : availableSlots.length === 0
                      ? "No available slots"
                      : "Select slot"}
                  </option>
                  {availableSlots.map((slot) => (
                    <option key={slot.startsAt} value={slot.startsAt}>
                      {formatDateTimeParts(slot.startsAt).time} - {formatDateTimeParts(slot.endsAt).time}
                    </option>
                  ))}
                </select>
                <p className="mt-2 text-xs text-slate-500">
                  Slots come from the doctor&apos;s schedule after breaks, blocked times, and existing bookings are removed.
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Location (optional)
                </label>
                <input
                  type="text"
                  value={form.location}
                  onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))}
                  placeholder="Clinic name or address"
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Notes (optional)
                </label>
                <textarea
                  value={form.notes}
                  onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                  rows={2}
                  placeholder="Reason for visit or any context for the doctor..."
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 resize-none"
                />
              </div>
            </div>

            {requestMessage && (
              <p className="mt-3 text-sm text-red-600">{requestMessage}</p>
            )}

            <div className="flex gap-3 mt-6">
              <button
                type="button"
                onClick={() => {
                  setIsModalOpen(false);
                  setAvailableSlots([]);
                  setAvailabilityDoctor(null);
                }}
                className="flex-1 rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleRequest}
                disabled={requesting}
                className="flex-1 rounded-xl bg-sky-500 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-600 transition disabled:opacity-40"
              >
                {requesting ? "Requesting..." : "Request Appointment"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}