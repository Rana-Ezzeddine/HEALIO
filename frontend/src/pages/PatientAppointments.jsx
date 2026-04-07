import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "../components/Navbar";
import {
  createAppointmentRequest,
  getPatientDoctorAvailability,
  getMyAppointments,
  getRequestableDoctors,
  updateAppointmentStatus,
} from "../api/appointments";
import { readSafePrefill, writeSafePrefill } from "../utils/safePrefill";

function formatDateTimeParts(dateLike) {
  const date = new Date(dateLike);
  return {
    date: date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
    time: date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }),
  };
}

function statusLabel(status) {
  if (status === "requested") return "Requested";
  if (status === "scheduled") return "Upcoming";
  if (status === "completed") return "Completed";
  if (status === "cancelled") return "Cancelled";
  if (status === "denied") return "Denied";
  return status || "Unknown";
}

function statusClass(status) {
  if (status === "requested") return "bg-amber-100 text-amber-700";
  if (status === "scheduled") return "bg-emerald-100 text-emerald-700";
  if (status === "completed") return "bg-sky-100 text-sky-700";
  if (status === "cancelled") return "bg-slate-200 text-slate-700";
  if (status === "denied") return "bg-rose-100 text-rose-700";
  return "bg-slate-100 text-slate-700";
}

function doctorDisplayName(appointment) {
  return appointment.doctor?.displayName || appointment.doctor?.email || "Doctor";
}

export default function PatientAppointments() {
  const navigate = useNavigate();
  const patientAppointmentsPrefill = readSafePrefill("patient-appointments", {
    doctorId: "",
    duration: "30",
    location: "",
    notes: "",
  });
  const [appointments, setAppointments] = useState([]);
  const [requestableDoctors, setRequestableDoctors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [requestError, setRequestError] = useState("");
  const [requestInfo, setRequestInfo] = useState("");
  const [requestLoading, setRequestLoading] = useState(false);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [availableSlots, setAvailableSlots] = useState([]);
  const [form, setForm] = useState({
    doctorId: patientAppointmentsPrefill.doctorId || "",
    date: "",
    timeSlot: "",
    duration: patientAppointmentsPrefill.duration || "30",
    location: patientAppointmentsPrefill.location || "",
    notes: patientAppointmentsPrefill.notes || "",
  });

  useEffect(() => {
    writeSafePrefill("patient-appointments", {
      doctorId: form.doctorId,
      duration: form.duration,
      location: form.location.trim(),
      notes: form.notes.trim(),
    });
  }, [form.doctorId, form.duration, form.location, form.notes]);

  async function loadAppointmentsPage() {
    setLoading(true);
    setError("");

    try {
      const [appointmentsData, doctorsData] = await Promise.all([
        getMyAppointments(),
        getRequestableDoctors(),
      ]);

      setAppointments(appointmentsData.appointments || []);
      setRequestableDoctors(doctorsData.doctors || []);
    } catch (err) {
      setError(err.message || "Failed to load appointments.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAppointmentsPage();
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadAvailability() {
      if (!form.doctorId || !form.date) {
        setAvailableSlots([]);
        return;
      }

      try {
        setSlotsLoading(true);
        setRequestError("");
        setRequestInfo("");

        const dayStart = new Date(`${form.date}T00:00:00`);
        const dayEnd = new Date(dayStart);
        dayEnd.setDate(dayEnd.getDate() + 1);

        const data = await getPatientDoctorAvailability({
          doctorId: form.doctorId,
          from: dayStart.toISOString(),
          to: dayEnd.toISOString(),
          slotMinutes: Number(form.duration || "30"),
        });

        if (!cancelled) {
          const now = Date.now();
          setAvailableSlots((data.slots || []).filter((slot) => new Date(slot.startsAt).getTime() > now));
        }
      } catch (err) {
        if (!cancelled) {
          setAvailableSlots([]);
          setRequestError(err.message || "Failed to load doctor availability.");
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
  }, [form.date, form.doctorId, form.duration]);

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

  const requestedCount = useMemo(
    () => appointments.filter((appointment) => appointment.status === "requested").length,
    [appointments]
  );

  const upcomingCount = useMemo(
    () => appointments.filter((appointment) => appointment.status === "scheduled").length,
    [appointments]
  );

  const deniedCount = useMemo(
    () => appointments.filter((appointment) => appointment.status === "denied").length,
    [appointments]
  );
  const selectedDoctor = requestableDoctors.find((doctor) => doctor.id === form.doctorId) || null;
  const selectedSlotParts = form.timeSlot ? formatDateTimeParts(form.timeSlot) : null;

  async function handlePatientDecision(appointmentId, status) {
    try {
      setError("");
      setRequestError("");
      await updateAppointmentStatus(appointmentId, status);
      await loadAppointmentsPage();
      setRequestInfo(
        status === "scheduled"
          ? "Appointment request accepted."
          : status === "denied"
            ? "Appointment request declined."
            : "Appointment updated."
      );
    } catch (err) {
      setError(err.message || "Failed to update appointment.");
    }
  }

  async function handleRequestAppointment(event) {
    event.preventDefault();
    setRequestError("");
    setRequestInfo("");

    if (!form.doctorId || !form.date || !form.timeSlot) {
      setRequestError("Select doctor, date, and an available time slot.");
      return;
    }

    const startsAt = new Date(form.timeSlot);
    if (Number.isNaN(startsAt.getTime())) {
      setRequestError("Invalid requested slot.");
      return;
    }

    const durationMinutes = Number(form.duration || "30");
    const endsAt = new Date(startsAt.getTime() + durationMinutes * 60 * 1000);

    const isAvailable = availableSlots.some((slot) => {
      return (
        new Date(slot.startsAt).getTime() === startsAt.getTime() &&
        new Date(slot.endsAt).getTime() === endsAt.getTime()
      );
    });
    if (!isAvailable) {
      setRequestError("Selected slot is no longer available.");
      return;
    }

    try {
      setRequestLoading(true);
      setRequestInfo("Re-checking slot availability before sending your request...");

      const dayStart = new Date(`${form.date}T00:00:00`);
      const dayEnd = new Date(dayStart);
      dayEnd.setDate(dayEnd.getDate() + 1);
      const refreshedAvailability = await getPatientDoctorAvailability({
        doctorId: form.doctorId,
        from: dayStart.toISOString(),
        to: dayEnd.toISOString(),
        slotMinutes: durationMinutes,
      });

      const refreshedSlots = refreshedAvailability.slots || [];
      const stillAvailable = refreshedSlots.some((slot) => {
        return (
          new Date(slot.startsAt).getTime() === startsAt.getTime() &&
          new Date(slot.endsAt).getTime() === endsAt.getTime()
        );
      });

      if (!stillAvailable) {
        setAvailableSlots(refreshedSlots.filter((slot) => new Date(slot.startsAt).getTime() > Date.now()));
        setForm((current) => ({ ...current, timeSlot: "" }));
        setRequestInfo("");
        setRequestError("That slot was taken or changed during confirmation. Please choose another available time.");
        return;
      }

      await createAppointmentRequest({
        doctorId: form.doctorId,
        startsAt: startsAt.toISOString(),
        endsAt: endsAt.toISOString(),
        location: form.location,
        notes: form.notes,
      });

      setForm((current) => ({
        ...current,
        doctorId: "",
        date: "",
        timeSlot: "",
        duration: "30",
        location: "",
        notes: "",
      }));
      setRequestInfo("Appointment request submitted after a final slot re-check.");
      await loadAppointmentsPage();
    } catch (err) {
      setRequestInfo("");
      setRequestError(err.message || "Failed to submit appointment request.");
    } finally {
      setRequestLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />

      <main className="pt-28 max-w-6xl mx-auto px-6 py-8">
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl text-slate-800 font-bold">Appointments</h1>
            <p className="text-slate-500 mt-1">
              Request a visit with one of your assigned doctors and track the decision in real time.
            </p>
          </div>
          <div className="flex gap-3">
            <div className="rounded-2xl bg-white border border-slate-200 px-4 py-3 text-right">
              <p className="text-xs text-slate-500">Requested</p>
              <p className="text-2xl font-bold text-slate-800">{requestedCount}</p>
            </div>
            <div className="rounded-2xl bg-white border border-slate-200 px-4 py-3 text-right">
              <p className="text-xs text-slate-500">Upcoming</p>
              <p className="text-2xl font-bold text-slate-800">{upcomingCount}</p>
            </div>
            <div className="rounded-2xl bg-white border border-slate-200 px-4 py-3 text-right">
              <p className="text-xs text-slate-500">Denied</p>
              <p className="text-2xl font-bold text-slate-800">{deniedCount}</p>
            </div>
          </div>
        </div>

        <section className="bg-white rounded-3xl shadow p-6 mb-6">
          <div className="flex items-center justify-between gap-4 mb-4">
            <div>
              <h2 className="text-xl font-semibold text-slate-800">Request Appointment</h2>
              <p className="text-sm text-slate-500 mt-1">
                This creates a backend appointment request for doctor review.
              </p>
            </div>
            <button
              type="button"
              onClick={() => navigate("/patientMessages")}
              className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition"
            >
              Open updates & communication
            </button>
          </div>

          <div className="mb-4 rounded-2xl border border-sky-200 bg-sky-50 p-4 text-sm text-sky-900">
            <p className="font-semibold">Why only linked doctors appear here</p>
            <p className="mt-1">
              Appointment requests are limited to doctors already linked to your patient account. That restriction keeps scheduling, treatment context, and secure communication tied to an active doctor-patient relationship.
            </p>
            {requestableDoctors.length === 0 ? (
              <p className="mt-2">
                No linked doctors are available yet. Open your care team page first, connect a doctor, then return here to request a visit.
              </p>
            ) : (
              <p className="mt-2">
                You currently have {requestableDoctors.length} linked doctor{requestableDoctors.length === 1 ? "" : "s"} available for requests.
              </p>
            )}
          </div>

          <form onSubmit={handleRequestAppointment} className="grid grid-cols-1 md:grid-cols-6 gap-3">
            <select
              value={form.doctorId}
              onChange={(event) => setForm((current) => ({ ...current, doctorId: event.target.value }))}
              className="rounded-xl border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
              required
            >
              <option value="">Select doctor</option>
              {requestableDoctors.map((doctor) => (
                <option key={doctor.id} value={doctor.id}>
                  {doctor.displayName}
                </option>
              ))}
            </select>

            <input
              type="date"
              value={form.date}
              onChange={(event) =>
                setForm((current) => ({ ...current, date: event.target.value, timeSlot: "" }))
              }
              className="rounded-xl border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
              required
            />

            <select
              value={form.duration}
              onChange={(event) =>
                setForm((current) => ({ ...current, duration: event.target.value, timeSlot: "" }))
              }
              className="rounded-xl border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
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
              className="rounded-xl border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
              required
              disabled={!form.date || !form.doctorId || slotsLoading}
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

            <div className="md:col-span-6 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
              Available slots come from the doctor&apos;s configured schedule, then the system removes break periods, blocked times, and bookings that already occupy the same window.
            </div>

            <input
              type="text"
              placeholder="Location"
              value={form.location}
              onChange={(event) => setForm((current) => ({ ...current, location: event.target.value }))}
              className="rounded-xl border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
            />

            <button
              type="submit"
              disabled={requestLoading || requestableDoctors.length === 0}
              className="rounded-xl bg-sky-500 px-4 py-2 text-sm font-medium text-white hover:bg-sky-600 transition disabled:opacity-70"
            >
              {requestLoading ? "Sending..." : "Send Request"}
            </button>

            <textarea
              value={form.notes}
              onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))}
              className="md:col-span-6 rounded-xl border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
              rows={3}
              placeholder="Reason or note for the doctor"
            />
          </form>

          {selectedDoctor && selectedSlotParts ? (
            <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
              <p className="font-semibold">Confirmation preview</p>
              <p className="mt-1">
                You are requesting {selectedDoctor.displayName} on {selectedSlotParts.date} at {selectedSlotParts.time} for {form.duration} minutes.
              </p>
              <p className="mt-2">
                When you submit, the system re-checks the slot one more time before creating the request.
              </p>
            </div>
          ) : null}

          {requestableDoctors.length === 0 && (
            <p className="mt-3 text-sm text-amber-700">
              No linked doctors found for this patient account. Use care team management first.
            </p>
          )}

          {requestableDoctors.length > 0 && (
            <div className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              Appointment slots are shared live. If another booking or request reaches the same slot first, that option can disappear before you confirm your request.
            </div>
          )}

          {requestError && (
            <div className="mt-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {requestError}
            </div>
          )}
          {requestInfo && !requestError && (
            <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
              {requestInfo}
            </div>
          )}
        </section>

        <section className="bg-white rounded-3xl shadow p-6">
          <div className="flex items-center justify-between gap-4 mb-4">
            <h2 className="text-xl font-semibold text-slate-800">My Appointments</h2>
            <button
              type="button"
              onClick={loadAppointmentsPage}
              className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition"
            >
              Refresh
            </button>
          </div>

          {error && (
            <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="min-h-full text-sm text-left w-full">
              <thead className="text-slate-500 border-b">
                <tr>
                  <th className="py-3 px-4">Doctor</th>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Time</th>
                  <th className="py-3 px-4">Location</th>
                  <th className="py-3 px-4">Notes</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr>
                    <td colSpan={7} className="py-6 px-4 text-center text-slate-500">
                      Loading appointments...
                    </td>
                  </tr>
                ) : appointments.length > 0 ? (
                  appointments.map((appointment) => {
                    const parts = formatDateTimeParts(appointment.startsAt);

                    return (
                      <tr key={appointment.id} className="hover:bg-slate-50">
                        <td className="py-3 px-4 text-slate-800 font-medium">
                          {doctorDisplayName(appointment)}
                        </td>
                        <td className="py-3 px-4 text-slate-700">{parts.date}</td>
                        <td className="py-3 px-4 text-slate-700">{parts.time}</td>
                        <td className="py-3 px-4 text-slate-600">{appointment.location || "-"}</td>
                        <td className="py-3 px-4 text-slate-600">{appointment.notes || "-"}</td>
                        <td className="py-3 px-4">
                          <span className={`px-2 py-1 text-xs rounded-full ${statusClass(appointment.status)}`}>
                            {statusLabel(appointment.status)}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          {appointment.status === "requested" && appointment.requestSource === "doctor" ? (
                            <div className="flex flex-wrap gap-2">
                              <button
                                type="button"
                                onClick={() => handlePatientDecision(appointment.id, "scheduled")}
                                className="rounded-lg bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-600"
                              >
                                Accept
                              </button>
                              <button
                                type="button"
                                onClick={() => handlePatientDecision(appointment.id, "denied")}
                                className="rounded-lg bg-rose-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-rose-600"
                              >
                                Decline
                              </button>
                            </div>
                          ) : (
                            <span className="text-slate-400">-</span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={7} className="py-6 px-4 text-center text-slate-500">
                      No appointments found. Send your first request above after selecting a linked doctor.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </div>
  );
}
