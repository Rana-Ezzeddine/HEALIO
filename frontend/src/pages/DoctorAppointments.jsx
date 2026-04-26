import { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import Navbar from "../components/Navbar";
import {
  createAppointment,
  createDoctorAvailability,
  deleteDoctorAvailability,
  getDoctorAvailability,
  getMyAppointments,
  getMyDoctorAvailability,
  reviewAppointmentRequest,
  suggestAppointmentSlot,
  updateAppointmentStatus,
  updateDoctorAvailability,
} from "../api/appointments";
import { apiUrl, authHeaders } from "../api/http";
import { readSafePrefill, writeSafePrefill } from "../utils/safePrefill";

const weekDays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const durationOptions = [15, 30, 45, 60];
const plannerDays = [1, 2, 3, 4, 5, 6];
const plannerStartHour = 0;
const plannerEndHour = 24;
const availabilityPresets = [
  { label: "Morning clinic", startTime: "08:00", endTime: "12:00" },
  { label: "Afternoon clinic", startTime: "13:00", endTime: "17:00" },
  { label: "Full day", startTime: "08:00", endTime: "17:00" },
  { label: "Evening clinic", startTime: "17:00", endTime: "22:00" },
];

function buildPlannerSlots(slotMinutes) {
  return Array.from(
    { length: ((plannerEndHour - plannerStartHour) * 60) / slotMinutes },
    (_, index) => {
      const totalMinutes = plannerStartHour * 60 + index * slotMinutes;
      const hour = String(Math.floor(totalMinutes / 60)).padStart(2, "0");
      const minute = String(totalMinutes % 60).padStart(2, "0");
      return `${hour}:${minute}`;
    }
  );
}

function getPreferredDuration() {
  if (typeof window === "undefined") return "30";
  return localStorage.getItem("doctorPreferredSlotDuration") || "30";
}

function toDateKey(dateLike) {
  const date = new Date(dateLike);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatTime(dateLike) {
  return new Date(dateLike).toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatDateLabel(dateKey) {
  return new Date(`${dateKey}T00:00:00`).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function formatShortDateLabel(dateKey) {
  return new Date(`${dateKey}T00:00:00`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

function statusClass(status) {
  if (status === "requested") return "bg-amber-100 text-amber-700";
  if (status === "scheduled") return "bg-emerald-100 text-emerald-700";
  if (status === "completed") return "bg-sky-100 text-sky-700";
  if (status === "cancelled") return "bg-slate-200 text-slate-700";
  if (status === "denied") return "bg-rose-100 text-rose-700";
  return "bg-slate-100 text-slate-700";
}

function statusLabel(status) {
  if (status === "requested") return "Requested";
  if (status === "scheduled") return "Scheduled";
  if (status === "completed") return "Completed";
  if (status === "cancelled") return "Cancelled";
  if (status === "denied") return "Denied";
  return status || "Unknown";
}

function patientLabel(patientRecord) {
  return patientRecord.profile?.displayName || patientRecord.patient?.displayName || patientRecord.patient?.email || patientRecord.email || "Patient";
}

function isDateOnlyRequest(appointment) {
  if (!appointment || appointment.requestSource !== "patient" || appointment.status !== "requested") return false;
  const start = new Date(appointment.startsAt);
  return start.getHours() === 0 && start.getMinutes() === 0;
}
function MetricCard({ label, value, hint }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
      <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-black text-slate-900">{value}</p>
      <p className="mt-2 text-[11px] text-slate-600">{hint}</p>
    </div>
  );
}
function SoftPill({ label, value, tone = "slate" }) {
  const tones = {
    slate: "bg-slate-100 text-slate-700",
    sky: "bg-sky-100 text-sky-700",
    emerald: "bg-emerald-100 text-emerald-700",
    amber: "bg-amber-100 text-amber-700",
    rose: "bg-rose-100 text-rose-700",
    violet: "bg-violet-100 text-violet-700",
  };
  return <span className={`rounded-full px-3 py-1 text-xs font-semibold ${tones[tone] || tones.slate}`}>{label}: {value}</span>;
}

function availabilityTypeLabel(type) {
  if (type === "workHours") return "Work hours";
  if (type === "break") return "Break";
  if (type === "blocked") return "Blocked";
  return type || "Availability";
}

function availabilityTimingLabel(entry) {
  if (entry.type === "workHours") {
    return `${weekDays[entry.dayOfWeek] || "Day"} • ${entry.startTime.slice(0, 5)} - ${entry.endTime.slice(0, 5)}`;
  }
  return `${entry.specificDate || "Date"} • ${entry.startTime.slice(0, 5)} - ${entry.endTime.slice(0, 5)}`;
}

function toMinutes(timeValue) {
  const [hours, minutes] = String(timeValue || "00:00").split(":").map(Number);
  return (hours || 0) * 60 + (minutes || 0);
}

function plannerKey(dayOfWeek, slotTime) {
  return `${dayOfWeek}-${slotTime}`;
}

function buildPlannerSelection(entries, slots, slotMinutes) {
  const selection = {};
  for (const entry of entries) {
    if (entry.type !== "workHours") continue;
    const start = toMinutes(entry.startTime);
    const end = toMinutes(entry.endTime);
    const day = Number(entry.dayOfWeek);

    for (const slot of slots) {
      const slotStart = toMinutes(slot);
      const slotEnd = slotStart + slotMinutes;
      if (slotStart >= start && slotEnd <= end) {
        selection[plannerKey(day, slot)] = true;
      }
    }
  }
  return selection;
}

function compressPlannerSelection(selection, slots, slotMinutes) {
  return plannerDays.flatMap((dayOfWeek) => {
    const activeSlots = slots.filter((slot) => selection[plannerKey(dayOfWeek, slot)]);
    if (!activeSlots.length) return [];

    const ranges = [];
    let rangeStart = activeSlots[0];
    let previous = activeSlots[0];

    for (let index = 1; index < activeSlots.length; index += 1) {
      const current = activeSlots[index];
      if (toMinutes(current) !== toMinutes(previous) + slotMinutes) {
        ranges.push({
          dayOfWeek,
          startTime: rangeStart,
          endTime: previous,
        });
        rangeStart = current;
      }
      previous = current;
    }

    ranges.push({
      dayOfWeek,
      startTime: rangeStart,
      endTime: previous,
    });

    return ranges.map((range) => {
      const endMinutes = toMinutes(range.endTime) + slotMinutes;
      const endHour = String(Math.floor(endMinutes / 60)).padStart(2, "0");
      const endMinute = String(endMinutes % 60).padStart(2, "0");
      return {
        dayOfWeek: range.dayOfWeek,
        startTime: range.startTime,
        endTime: `${endHour}:${endMinute}`,
      };
    });
  });
}

async function fetchAssignedPatients() {
  const response = await fetch(`${apiUrl}/api/doctors/assigned-patients`, {
    headers: { ...authHeaders() },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.message || "Failed to load assigned patients");
  }
  return data;
}

export default function DoctorAppointments() {
  const location = useLocation();
  const doctorAppointmentsPrefill = readSafePrefill("doctor-appointments", {
    duration: getPreferredDuration(),
    location: "",
    notes: "",
    suggestNote: "",
    availabilityType: "break",
    availabilityReason: "",
    availabilityStart: "09:00",
    availabilityEnd: "17:00",
  });
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [assignedPatients, setAssignedPatients] = useState([]);
  const [selectedDateKey, setSelectedDateKey] = useState(toDateKey(new Date()));
  const [visibleMonth, setVisibleMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [createLoading, setCreateLoading] = useState(false);
  const [createError, setCreateError] = useState("");
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [availableSlots, setAvailableSlots] = useState([]);
  const [statusLoadingId, setStatusLoadingId] = useState("");
  const [decisionNotes, setDecisionNotes] = useState({});
  const [suggestOpenId, setSuggestOpenId] = useState("");
  const [suggestLoadingId, setSuggestLoadingId] = useState("");
  const [suggestSlotsLoading, setSuggestSlotsLoading] = useState(false);
  const [suggestSlots, setSuggestSlots] = useState([]);
  const [suggestForm, setSuggestForm] = useState({
    appointmentId: "",
    date: "",
    duration: doctorAppointmentsPrefill.duration || getPreferredDuration(),
    timeSlot: "",
    note: doctorAppointmentsPrefill.suggestNote || "",
  });
  const [availabilityEntries, setAvailabilityEntries] = useState([]);
  const [preferredDuration, setPreferredDuration] = useState(doctorAppointmentsPrefill.duration || getPreferredDuration());
  const [availabilityLoading, setAvailabilityLoading] = useState(true);
  const [availabilityError, setAvailabilityError] = useState("");
  const [availabilitySaving, setAvailabilitySaving] = useState(false);
  const [plannerSaving, setPlannerSaving] = useState(false);
  const [plannerSelection, setPlannerSelection] = useState({});
  const [editingAvailabilityId, setEditingAvailabilityId] = useState("");
  const [availabilityForm, setAvailabilityForm] = useState({
    type: doctorAppointmentsPrefill.availabilityType || "break",
    dayOfWeek: "1",
    selectedWeekdays: ["1"],
    specificDate: "",
    startTime: doctorAppointmentsPrefill.availabilityStart || "09:00",
    endTime: doctorAppointmentsPrefill.availabilityEnd || "17:00",
    reason: doctorAppointmentsPrefill.availabilityReason || "",
  });
  const [form, setForm] = useState({
    patientId: "",
    date: "",
    timeSlot: "",
    duration: doctorAppointmentsPrefill.duration || getPreferredDuration(),
    location: doctorAppointmentsPrefill.location || "",
    notes: doctorAppointmentsPrefill.notes || "",
  });

  const patientNameById = useMemo(() => {
    const map = new Map();
    for (const record of assignedPatients) {
      const patient = record.patient || record;
      map.set(patient.id, patientLabel(record));
    }
    return map;
  }, [assignedPatients]);

  async function loadPageData() {
    setLoading(true);
    setAvailabilityLoading(true);
    setError("");
    setSuccessMessage("");
    setAvailabilityError("");

    const [appointmentsResult, patientsResult, availabilityResult] = await Promise.allSettled([
      getMyAppointments(),
      fetchAssignedPatients(),
      getMyDoctorAvailability(),
    ]);

    if (appointmentsResult.status === "fulfilled") {
      setAppointments(appointmentsResult.value.appointments || []);
    } else {
      setAppointments([]);
      setError(appointmentsResult.reason?.message || "Failed to load appointments.");
    }

    if (patientsResult.status === "fulfilled") {
      setAssignedPatients(patientsResult.value.patients || []);
    } else {
      setAssignedPatients([]);
      setError((current) => current || patientsResult.reason?.message || "Failed to load assigned patients.");
    }

    if (availabilityResult.status === "fulfilled") {
      setAvailabilityEntries(availabilityResult.value.availabilities || []);
    } else {
      setAvailabilityEntries([]);
      setAvailabilityError(availabilityResult.reason?.message || "Failed to load availability.");
    }

    setLoading(false);
    setAvailabilityLoading(false);
  }

  useEffect(() => {
    loadPageData();
  }, []);

  useEffect(() => {
    writeSafePrefill("doctor-appointments", {
      duration: preferredDuration,
      location: form.location.trim(),
      notes: form.notes.trim(),
      suggestNote: suggestForm.note.trim(),
      availabilityType: availabilityForm.type,
      availabilityReason: availabilityForm.reason.trim(),
      availabilityStart: availabilityForm.startTime,
      availabilityEnd: availabilityForm.endTime,
    });
  }, [
    availabilityForm.endTime,
    availabilityForm.reason,
    availabilityForm.startTime,
    availabilityForm.type,
    form.location,
    form.notes,
    preferredDuration,
    suggestForm.note,
  ]);

  useEffect(() => {
    if (location.hash !== "#schedule-patient") return;
    const scheduleSection = document.getElementById("schedule-patient");
    if (!scheduleSection) return;
    window.requestAnimationFrame(() => {
      scheduleSection.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }, [location.hash, loading]);

  useEffect(() => {
    let cancelled = false;

    async function loadAvailability() {
      if (!form.date) {
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
          setAvailableSlots([]);
          setCreateError(err.message || "Failed to load availability.");
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
  }, [form.date, form.duration]);

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
    let cancelled = false;

    async function loadSuggestedSlots() {
      if (!suggestOpenId || !suggestForm.date) {
        setSuggestSlots([]);
        return;
      }

      const durationMinutes = Number(suggestForm.duration || getPreferredDuration());
      if (!Number.isInteger(durationMinutes) || durationMinutes <= 0) {
        setSuggestSlots([]);
        return;
      }

      try {
        setSuggestSlotsLoading(true);
        const dayStart = new Date(`${suggestForm.date}T00:00:00`);
        const dayEnd = new Date(dayStart);
        dayEnd.setDate(dayEnd.getDate() + 1);

        const data = await getDoctorAvailability({
          from: dayStart.toISOString(),
          to: dayEnd.toISOString(),
          slotMinutes: durationMinutes,
        });

        if (!cancelled) {
          const now = Date.now();
          setSuggestSlots((data.slots || []).filter((slot) => new Date(slot.startsAt).getTime() > now));
        }
      } catch (err) {
        if (!cancelled) {
          setSuggestSlots([]);
          setError((current) => current || err.message || "Failed to load suggested slots.");
        }
      } finally {
        if (!cancelled) {
          setSuggestSlotsLoading(false);
        }
      }
    }

    loadSuggestedSlots();
    return () => {
      cancelled = true;
    };
  }, [suggestOpenId, suggestForm.date, suggestForm.duration]);

  useEffect(() => {
    if (!suggestOpenId) return;

    if (!suggestSlots.length) {
      if (suggestForm.timeSlot) {
        setSuggestForm((current) => ({ ...current, timeSlot: "" }));
      }
      return;
    }

    const hasSelectedSlot = suggestSlots.some((slot) => slot.startsAt === suggestForm.timeSlot);
    if (!hasSelectedSlot) {
      setSuggestForm((current) => ({ ...current, timeSlot: suggestSlots[0].startsAt }));
    }
  }, [suggestOpenId, suggestSlots, suggestForm.timeSlot]);

  const requestedAppointments = useMemo(() => {
    return appointments
      .filter((appointment) => appointment.status === "requested" && appointment.requestSource !== "doctor")
      .sort((left, right) => new Date(left.startsAt) - new Date(right.startsAt));
  }, [appointments]);

  const scheduledCount = useMemo(
    () => appointments.filter((appointment) => appointment.status === "scheduled").length,
    [appointments]
  );

  const completedCount = useMemo(
    () => appointments.filter((appointment) => appointment.status === "completed").length,
    [appointments]
  );

  const cancelledCount = useMemo(
    () => appointments.filter((appointment) => appointment.status === "cancelled").length,
    [appointments]
  );

  const selectedAppointments = useMemo(() => {
    return appointments
      .filter((appointment) => toDateKey(appointment.startsAt) === selectedDateKey)
      .sort((left, right) => new Date(left.startsAt) - new Date(right.startsAt));
  }, [appointments, selectedDateKey]);

  const appointmentCountsByDate = useMemo(() => {
    return appointments.reduce((accumulator, appointment) => {
      const dateKey = toDateKey(appointment.startsAt);
      accumulator[dateKey] = (accumulator[dateKey] || 0) + 1;
      return accumulator;
    }, {});
  }, [appointments]);
  const selectedDayAppointmentCount = appointmentCountsByDate[selectedDateKey] || 0;

  const availabilityByType = useMemo(() => ({
    workHours: availabilityEntries.filter((entry) => entry.type === "workHours"),
    breaks: availabilityEntries.filter((entry) => entry.type === "break"),
    blocked: availabilityEntries.filter((entry) => entry.type === "blocked"),
  }), [availabilityEntries]);

  const groupedWorkHours = useMemo(() => {
    const grouped = new Map();

    for (const entry of availabilityByType.workHours) {
      const dayIndex = Number(entry.dayOfWeek);
      const dayLabel = weekDays[dayIndex] || "Day";
      const current = grouped.get(dayLabel) || [];
      current.push(`${entry.startTime.slice(0, 5)}-${entry.endTime.slice(0, 5)}`);
      grouped.set(dayLabel, current);
    }

    return Array.from(grouped.entries()).map(([dayLabel, ranges]) => ({
      dayLabel,
      ranges,
    }));
  }, [availabilityByType.workHours]);

  const plannerSlotMinutes = useMemo(() => Number(preferredDuration || "30"), [preferredDuration]);
  const plannerSlots = useMemo(() => buildPlannerSlots(plannerSlotMinutes), [plannerSlotMinutes]);

  useEffect(() => {
    setPlannerSelection(buildPlannerSelection(availabilityEntries, plannerSlots, plannerSlotMinutes));
  }, [availabilityEntries, plannerSlots, plannerSlotMinutes]);

  const monthDays = useMemo(() => {
    const year = visibleMonth.getFullYear();
    const month = visibleMonth.getMonth();
    const firstDayIndex = new Date(year, month, 1).getDay();
    const startDate = new Date(year, month, 1 - firstDayIndex);

    return Array.from({ length: 42 }, (_, index) => {
      const date = new Date(startDate);
      date.setDate(startDate.getDate() + index);

      return {
        date,
        dateKey: toDateKey(date),
        inCurrentMonth: date.getMonth() === month,
      };
    });
  }, [visibleMonth]);

  async function handleScheduleAppointment(event) {
    event.preventDefault();
    setCreateError("");
    setSuccessMessage("");

    if (!form.patientId || !form.timeSlot) {
      setCreateError("Select a patient and an available time slot.");
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
        duration: preferredDuration,
        location: form.location,
        notes: form.notes,
      });
      setAvailableSlots([]);
      await loadPageData();
      setSelectedDateKey(toDateKey(startsAt));
      setVisibleMonth(new Date(startsAt.getFullYear(), startsAt.getMonth(), 1));
      setSuccessMessage("Appointment request sent to the patient.");
    } catch (err) {
      setCreateError(err.message || "Failed to send appointment request.");
    } finally {
      setCreateLoading(false);
    }
  }

  async function handleStatusChange(appointmentId, status) {
    try {
      setSuccessMessage("");
      setStatusLoadingId(appointmentId);
      await updateAppointmentStatus(appointmentId, status);
      await loadPageData();
      setSuccessMessage(`Appointment marked as ${statusLabel(status).toLowerCase()}.`);
    } catch (err) {
      setError(err.message || "Failed to update appointment status.");
    } finally {
      setStatusLoadingId("");
    }
  }

  async function handleReviewRequest(appointmentId, status) {
    try {
      setSuccessMessage("");
      setStatusLoadingId(appointmentId);
      await reviewAppointmentRequest(appointmentId, status, decisionNotes[appointmentId] || "");
      setDecisionNotes((current) => ({ ...current, [appointmentId]: "" }));
      await loadPageData();
      setSuccessMessage(
        status === "scheduled"
          ? "Request approved and appointment scheduled."
          : "Request denied successfully."
      );
    } catch (err) {
      setError(err.message || "Failed to review appointment request.");
    } finally {
      setStatusLoadingId("");
    }
  }

  function openSuggestSlot(appointment) {
    const defaultDate = toDateKey(appointment.startsAt);
    setSuggestOpenId(appointment.id);
    setSuggestForm({
      appointmentId: appointment.id,
      date: defaultDate,
      duration: String(Math.round((new Date(appointment.endsAt) - new Date(appointment.startsAt)) / 60000) || Number(getPreferredDuration())),
      timeSlot: "",
      note: decisionNotes[appointment.id] || doctorAppointmentsPrefill.suggestNote || "",
    });
    setError("");
  }

  function closeSuggestSlot() {
    setSuggestOpenId("");
    setSuggestSlots([]);
    setSuggestSlotsLoading(false);
  }

  async function handleSuggestSlot(appointment) {
    if (!suggestForm.timeSlot) {
      setError("Select an alternative slot before sending the suggestion.");
      return;
    }

    try {
      setSuccessMessage("");
      setSuggestLoadingId(appointment.id);
      const startsAt = new Date(suggestForm.timeSlot);
      const durationMinutes = Number(suggestForm.duration || getPreferredDuration());
      const endsAt = new Date(startsAt.getTime() + durationMinutes * 60 * 1000);
      await suggestAppointmentSlot(appointment.id, {
        startsAt: startsAt.toISOString(),
        endsAt: endsAt.toISOString(),
        notes: suggestForm.note,
      });
      setDecisionNotes((current) => ({ ...current, [appointment.id]: suggestForm.note }));
      closeSuggestSlot();
      await loadPageData();
      setSuccessMessage("Alternative slot suggested successfully.");
    } catch (err) {
      setError(err.message || "Failed to suggest another slot.");
    } finally {
      setSuggestLoadingId("");
    }
  }

  function changeMonth(direction) {
    setVisibleMonth(
      (previousMonth) => new Date(previousMonth.getFullYear(), previousMonth.getMonth() + direction, 1)
    );
  }

  function resetAvailabilityForm() {
    setAvailabilityForm({
      type: doctorAppointmentsPrefill.availabilityType || "break",
      dayOfWeek: "1",
      selectedWeekdays: [],
      specificDate: "",
      startTime: doctorAppointmentsPrefill.availabilityStart || "09:00",
      endTime: doctorAppointmentsPrefill.availabilityEnd || "17:00",
      reason: doctorAppointmentsPrefill.availabilityReason || "",
    });
    setEditingAvailabilityId("");
  }

  function handlePreferredDurationChange(value) {
    setPreferredDuration(value);
    localStorage.setItem("doctorPreferredSlotDuration", value);
    setForm((current) => ({ ...current, duration: value, timeSlot: "" }));
  }

  function startEditAvailability(entry) {
    setEditingAvailabilityId(entry.id);
    setAvailabilityForm({
      type: entry.type,
      dayOfWeek: entry.dayOfWeek !== null && entry.dayOfWeek !== undefined ? String(entry.dayOfWeek) : "1",
      selectedWeekdays:
        entry.dayOfWeek !== null && entry.dayOfWeek !== undefined ? [String(entry.dayOfWeek)] : [],
      specificDate: entry.specificDate || "",
      startTime: entry.startTime?.slice(0, 5) || "09:00",
      endTime: entry.endTime?.slice(0, 5) || "17:00",
      reason: entry.reason || "",
    });
    setAvailabilityError("");
  }

  async function handleSubmitAvailability(event) {
    event.preventDefault();
    setAvailabilityError("");
    setSuccessMessage("");

    if (availabilityForm.endTime <= availabilityForm.startTime) {
      setAvailabilityError("End time must be after start time.");
      return;
    }

    if (availabilityForm.type === "workHours" && (availabilityForm.selectedWeekdays || []).length === 0) {
      setAvailabilityError("Select at least one weekday for work hours.");
      return;
    }

    if ((availabilityForm.type === "break" || availabilityForm.type === "blocked") && !availabilityForm.specificDate) {
      setAvailabilityError("Select a date for breaks or blocked time.");
      return;
    }

    const basePayload = {
      type: availabilityForm.type,
      specificDate: availabilityForm.type === "workHours" ? null : availabilityForm.specificDate,
      startTime: availabilityForm.startTime,
      endTime: availabilityForm.endTime,
      reason: availabilityForm.reason,
    };

    try {
      setAvailabilitySaving(true);
      if (editingAvailabilityId) {
        await updateDoctorAvailability(editingAvailabilityId, {
          ...basePayload,
          dayOfWeek:
            availabilityForm.type === "workHours"
              ? Number((availabilityForm.selectedWeekdays || [availabilityForm.dayOfWeek])[0])
              : null,
        });
      } else {
        if (availabilityForm.type === "workHours") {
          const weekdays = availabilityForm.selectedWeekdays || [];
          await Promise.all(
            weekdays.map((weekday) =>
              createDoctorAvailability({
                ...basePayload,
                dayOfWeek: Number(weekday),
              })
            )
          );
        } else {
          await createDoctorAvailability({
            ...basePayload,
            dayOfWeek: null,
          });
        }
      }
      resetAvailabilityForm();
      await loadPageData();
      setSuccessMessage(editingAvailabilityId ? "Availability updated." : "Availability saved.");
    } catch (err) {
      setAvailabilityError(err.message || "Failed to save availability.");
    } finally {
      setAvailabilitySaving(false);
    }
  }

  async function handleDeleteAvailability(id) {
    try {
      setSuccessMessage("");
      setAvailabilitySaving(true);
      setAvailabilityError("");
      await deleteDoctorAvailability(id);
      if (editingAvailabilityId === id) {
        resetAvailabilityForm();
      }
      await loadPageData();
      setSuccessMessage("Availability entry removed.");
    } catch (err) {
      setAvailabilityError(err.message || "Failed to delete availability.");
    } finally {
      setAvailabilitySaving(false);
    }
  }

  async function handleSaveWeeklyPlanner() {
    const ranges = compressPlannerSelection(plannerSelection, plannerSlots, plannerSlotMinutes);

    if (!ranges.length) {
      setAvailabilityError("Choose at least one weekly slot before saving.");
      return;
    }

    try {
      setSuccessMessage("");
      setPlannerSaving(true);
      setAvailabilityError("");
      const existingWorkHours = availabilityByType.workHours || [];

      await Promise.all(existingWorkHours.map((entry) => deleteDoctorAvailability(entry.id)));
      await Promise.all(
        ranges.map((range) =>
          createDoctorAvailability({
            type: "workHours",
            dayOfWeek: range.dayOfWeek,
            specificDate: null,
            startTime: range.startTime,
            endTime: range.endTime,
            reason: "Saved from weekly planner",
          })
        )
      );
      await loadPageData();
      setSuccessMessage("Weekly planner saved successfully.");
    } catch (err) {
      setAvailabilityError(err.message || "Failed to save weekly planner.");
    } finally {
      setPlannerSaving(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />

      <main className="mx-auto max-w-6xl px-6 pb-8 pt-28">
        <section className="mb-6 rounded-[2rem] bg-gradient-to-r from-slate-900 via-sky-800 to-cyan-600 p-6 text-white shadow-xl">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.25em] text-white/75">Doctor Appointments</p>
              <h1 className="mt-2 text-3xl font-black">Scheduling and Requests</h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-white/85">
                Review requests, schedule patients, and shape availability from one page.
              </p>
              <div className="mt-4">
                <Link
                  to="/doctor-calendar"
                  className="inline-flex rounded-xl bg-white px-4 py-2 text-sm font-semibold text-slate-900 transition hover:bg-slate-100"
                >
                  Open calendar page
                </Link>
              </div>
            </div>
            <div className="grid gap-2 sm:grid-cols-2 xl:w-[360px]">
              <MetricCard label="Requests" value={requestedAppointments.length} hint="Awaiting review" />
              <MetricCard label="Scheduled" value={scheduledCount} hint="Confirmed visits" />
              <MetricCard label="Completed" value={completedCount} hint="Closed visits" />
              <MetricCard label="Cancelled" value={cancelledCount} hint="Dropped or denied" />
            </div>
          </div>
        </section>

        {error && (
          <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {successMessage && (
          <div className="mb-6 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            {successMessage}
          </div>
        )}

        <section className="mb-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-4">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold text-slate-800">Patient Requests</h2>
                <p className="mt-1 text-sm text-slate-500">
                  Review the requested slot, patient note, location, and your internal review note before approving, denying, or suggesting another time.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <SoftPill label="Pending" value={requestedAppointments.length} tone="amber" />
                <SoftPill label="Patients" value={assignedPatients.length} tone="sky" />
              </div>
            </div>
          </div>

          <div className="space-y-4">
            {loading ? (
              <div className="rounded-2xl border border-dashed border-slate-200 p-6 text-center text-sm text-slate-500">
                Loading requests...
              </div>
            ) : requestedAppointments.length > 0 ? (
              requestedAppointments.map((appointment) => {
                const patientName =
                  patientNameById.get(appointment.patient?.id || appointment.patientId) ||
                  appointment.patient?.email ||
                  "Patient";
                const requestedDuration = Math.round((new Date(appointment.endsAt) - new Date(appointment.startsAt)) / 60000);
                const isSuggesting = suggestOpenId === appointment.id;
                const needsDoctorSlotChoice = isDateOnlyRequest(appointment);

                return (
                  <div key={appointment.id} className="rounded-3xl border border-slate-200 bg-white/90 p-5 shadow-sm">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-lg font-semibold text-slate-900">{patientName}</h3>
                          <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-700">Requested</span>
                        </div>
                        <p className="mt-2 text-sm text-slate-500">
                          {needsDoctorSlotChoice
                            ? `Preferred day: ${formatDateLabel(toDateKey(appointment.startsAt))} • ${requestedDuration} minutes • doctor must choose slot`
                            : `Requested slot: ${formatDateLabel(toDateKey(appointment.startsAt))} at ${formatTime(appointment.startsAt)}${appointment.endsAt ? ` for ${requestedDuration} minutes` : ""}`}
                        </p>
                        <div className="mt-3 flex flex-wrap gap-2">
                          <SoftPill label="Duration" value={`${requestedDuration} min`} tone="sky" />
                          <SoftPill label="Day" value={formatDateLabel(toDateKey(appointment.startsAt))} tone="slate" />
                        </div>
                      </div>
                      <div className="rounded-2xl bg-white px-4 py-3 text-sm text-slate-600 shadow-sm">
                        <p><span className="font-semibold text-slate-900">Location:</span> {appointment.location || "Not specified"}</p>
                        <p className="mt-1"><span className="font-semibold text-slate-900">Appointment ID:</span> {appointment.id.slice(0, 8)}</p>
                      </div>
                    </div>

                    <div className="mt-4 grid gap-4 lg:grid-cols-2">
                      <div className="rounded-2xl bg-slate-50 p-4">
                        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Patient note</p>
                        <p className="mt-2 text-sm text-slate-700">{appointment.notes || "No note provided by the patient."}</p>
                      </div>
                      <div className="rounded-2xl bg-slate-50 p-4">
                        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Doctor review note</p>
                        <textarea
                          value={decisionNotes[appointment.id] || ""}
                          onChange={(event) =>
                            setDecisionNotes((current) => ({
                              ...current,
                              [appointment.id]: event.target.value,
                            }))
                          }
                          placeholder="Add context for your decision or a message for the patient"
                          rows={3}
                          className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                        />
                      </div>
                    </div>

                    <div className="mt-4 flex flex-wrap gap-2">
                      <button
                        type="button"
                        disabled={needsDoctorSlotChoice || statusLoadingId === appointment.id || suggestLoadingId === appointment.id}
                        onClick={() => handleReviewRequest(appointment.id, "scheduled")}
                        className="rounded-xl bg-emerald-500 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-600 disabled:opacity-70"
                      >
                        {needsDoctorSlotChoice ? "Choose slot first" : "Approve requested slot"}
                      </button>
                      <button
                        type="button"
                        disabled={statusLoadingId === appointment.id || suggestLoadingId === appointment.id}
                        onClick={() => handleReviewRequest(appointment.id, "denied")}
                        className="rounded-xl bg-rose-500 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-600 disabled:opacity-70"
                      >
                        Deny request
                      </button>
                      <button
                        type="button"
                        disabled={statusLoadingId === appointment.id || suggestLoadingId === appointment.id}
                        onClick={() => (isSuggesting ? closeSuggestSlot() : openSuggestSlot(appointment))}
                        className="rounded-xl border border-sky-300 bg-white px-4 py-2 text-sm font-semibold text-sky-700 hover:bg-sky-50 disabled:opacity-70"
                      >
                        {isSuggesting ? "Close suggestion" : needsDoctorSlotChoice ? "Choose slot" : "Suggest another slot"}
                      </button>
                    </div>

                    {isSuggesting ? (
                      <div className="mt-4 rounded-2xl border border-sky-200 bg-sky-50/60 p-4">
                        <div className="mb-3">
                          <h4 className="text-sm font-semibold text-slate-900">Suggest another slot</h4>
                          <p className="mt-1 text-xs text-slate-500">
                            {needsDoctorSlotChoice
                              ? "Pick the actual appointment slot for this patient request. After sending it, you can approve the request."
                              : "Pick a new date, duration, and available time. The appointment stays in requested state, but its requested slot updates to your suggestion."}
                          </p>
                        </div>

                        <div className="grid gap-3 md:grid-cols-4">
                          <input
                            type="date"
                            value={suggestForm.date}
                            onChange={(event) => setSuggestForm((current) => ({ ...current, date: event.target.value, timeSlot: "" }))}
                            className="rounded-xl border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                          />
                          <select
                            value={suggestForm.duration}
                            onChange={(event) => setSuggestForm((current) => ({ ...current, duration: event.target.value, timeSlot: "" }))}
                            className="rounded-xl border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                          >
                            {durationOptions.map((minutes) => (
                              <option key={minutes} value={String(minutes)}>{minutes} minutes</option>
                            ))}
                          </select>
                          <select
                            value={suggestForm.timeSlot}
                            onChange={(event) => setSuggestForm((current) => ({ ...current, timeSlot: event.target.value }))}
                            disabled={!suggestForm.date || suggestSlotsLoading}
                            className="rounded-xl border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 md:col-span-2"
                          >
                            <option value="">
                              {!suggestForm.date
                                ? "Select date first"
                                : suggestSlotsLoading
                                ? "Loading suggested slots..."
                                : suggestSlots.length === 0
                                ? "No available slots"
                                : "Select suggested slot"}
                            </option>
                            {suggestSlots.map((slot) => (
                              <option key={slot.startsAt} value={slot.startsAt}>
                                {formatTime(slot.startsAt)} - {formatTime(slot.endsAt)}
                              </option>
                            ))}
                          </select>
                        </div>

                        <textarea
                          value={suggestForm.note}
                          onChange={(event) => setSuggestForm((current) => ({ ...current, note: event.target.value }))}
                          rows={3}
                          placeholder="Optional note to explain why you are suggesting another slot"
                          className="mt-3 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                        />

                        <div className="mt-3 flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => handleSuggestSlot(appointment)}
                            disabled={suggestLoadingId === appointment.id || !suggestForm.timeSlot}
                            className="rounded-xl bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-700 disabled:opacity-70"
                          >
                            {suggestLoadingId === appointment.id ? "Sending..." : "Send suggested slot"}
                          </button>
                          <button
                            type="button"
                            onClick={closeSuggestSlot}
                            className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : null}
                  </div>
                );
              })
            ) : (
              <div className="rounded-2xl border border-dashed border-slate-200 p-6 text-center text-sm text-slate-500">
                No pending requests. Check back later or use the request form below to propose an appointment to an assigned patient.
              </div>
            )}
          </div>
        </section>

        <section id="schedule-patient" className="mb-6 rounded-3xl bg-gradient-to-br from-white to-cyan-50 p-6 shadow">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="text-xl font-semibold text-slate-800 mb-1">Request For Assigned Patient</h2>
              <p className="text-sm text-slate-500 mb-4">
                Send an appointment request to an assigned patient using your live availability.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <SoftPill label="Selected day" value={form.date || "Not set"} tone="sky" />
              <SoftPill label="Slots" value={availableSlots.length} tone="emerald" />
            </div>
          </div>

          <form onSubmit={handleScheduleAppointment} className="grid grid-cols-1 md:grid-cols-6 gap-3">
            <select
              value={form.patientId}
              onChange={(event) => setForm((current) => ({ ...current, patientId: event.target.value }))}
              className="rounded-xl border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
              required
            >
              <option value="">Select patient</option>
              {assignedPatients.map((record) => {
                const patient = record.patient || record;
                return (
                  <option key={patient.id} value={patient.id}>
                    {patientLabel(record)}
                  </option>
                );
              })}
            </select>

            <input
              type="date"
              value={form.date}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  date: event.target.value,
                  timeSlot: "",
                }))
              }
              className="rounded-xl border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
              required
            />

            <select
              value={form.duration}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  duration: event.target.value,
                  timeSlot: "",
                }))
              }
              className="rounded-xl border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
              required
            >
              {durationOptions.map((minutes) => (
                <option key={minutes} value={String(minutes)}>{minutes} minutes</option>
              ))}
            </select>

            <select
              value={form.timeSlot}
              onChange={(event) => setForm((current) => ({ ...current, timeSlot: event.target.value }))}
              className="rounded-xl border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
              required
              disabled={!form.date || slotsLoading}
            >
              <option value="">
                {!form.date
                  ? "Select date first"
                  : slotsLoading
                  ? "Loading slots..."
                  : availableSlots.length === 0
                  ? "No available slots"
                  : "Select slot"}
              </option>
              {availableSlots.map((slot) => (
                <option key={slot.startsAt} value={slot.startsAt}>
                  {formatTime(slot.startsAt)} - {formatTime(slot.endsAt)}
                </option>
              ))}
            </select>

            <input
              type="text"
              placeholder="Location"
              value={form.location}
              onChange={(event) => setForm((current) => ({ ...current, location: event.target.value }))}
              className="rounded-xl border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
            />

            <button
              type="submit"
              disabled={createLoading || assignedPatients.length === 0}
              className="rounded-xl bg-sky-500 px-4 py-2 text-sm font-medium text-white hover:bg-sky-600 transition disabled:opacity-70"
            >
              {createLoading ? "Sending..." : "Send Request"}
            </button>

            <textarea
              value={form.notes}
              onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))}
              className="md:col-span-6 rounded-xl border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
              rows={3}
              placeholder="Notes for the visit"
            />
          </form>

          {assignedPatients.length === 0 && (
            <p className="mt-3 text-sm text-amber-700">
              No active patient assignments were found for this doctor account. Approve a patient link request first, then return here to schedule directly.
            </p>
          )}

          {createError && (
            <div className="mt-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {createError}
            </div>
          )}
        </section>

        <section className="mb-6 rounded-3xl bg-gradient-to-br from-white to-sky-50 p-6 shadow">
          <div className="flex items-start justify-between gap-4 mb-4">
            <div>
              <h2 className="text-xl font-semibold text-slate-800 mb-1">Availability Management</h2>
              <p className="text-sm text-slate-500">
                Manage the working-time blocks that power patient appointment requests and doctor-side scheduling.
              </p>
            </div>
            {editingAvailabilityId ? (
              <button
                type="button"
                onClick={resetAvailabilityForm}
                className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition"
              >
                Cancel edit
              </button>
            ) : null}
          </div>

          <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h3 className="text-lg font-semibold text-slate-900">Weekly availability planner</h3>
                <p className="mt-1 text-sm text-slate-500">
                  Paint only the exact booking windows you want open. The grid follows your appointment duration rule.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <SoftPill label="Weekly blocks" value={availabilityByType.workHours.length} tone="sky" />
                <SoftPill label="Breaks" value={availabilityByType.breaks.length} tone="amber" />
                <SoftPill label="Blocked" value={availabilityByType.blocked.length} tone="rose" />
              </div>
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-3">
              <div className="rounded-2xl bg-white/90 p-4 shadow-sm">
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">Planner</p>
                <p className="mt-2 text-2xl font-black text-slate-900">{availabilityByType.workHours.length}</p>
                <p className="mt-2 text-sm text-slate-500">Saved weekly bookable ranges</p>
              </div>
              <div className="rounded-2xl bg-white/90 p-4 shadow-sm">
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">Slot size</p>
                <p className="mt-2 text-2xl font-black text-slate-900">{plannerSlotMinutes} min</p>
                <p className="mt-2 text-sm text-slate-500">Driven by duration rule</p>
              </div>
              <div className="rounded-2xl bg-white/90 p-4 shadow-sm">
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">Exceptions</p>
                <p className="mt-2 text-2xl font-black text-slate-900">{availabilityByType.breaks.length + availabilityByType.blocked.length}</p>
                <p className="mt-2 text-sm text-slate-500">Breaks and blocked dates</p>
              </div>
            </div>

            <div className="mt-5 flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-slate-900">Quick fill presets</p>
                <p className="mt-1 text-xs text-slate-500">Use these to paint the grid faster, then refine manually.</p>
              </div>
              <div className="flex flex-wrap gap-2">
                {availabilityPresets.map((preset) => (
                  <button
                    key={preset.label}
                    type="button"
                    onClick={() =>
                      setPlannerSelection((current) => {
                        const next = { ...current };
                        const start = toMinutes(preset.startTime);
                        const end = toMinutes(preset.endTime);
                        for (const day of plannerDays) {
                          for (const slot of plannerSlots) {
                            const slotStart = toMinutes(slot);
                            const slotEnd = slotStart + plannerSlotMinutes;
                            const key = plannerKey(day, slot);
                            if (slotStart >= start && slotEnd <= end) {
                              next[key] = true;
                            }
                          }
                        }
                        return next;
                      })
                    }
                    className="rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-100"
                  >
                    {preset.label}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setPlannerSelection({})}
                  className="rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-rose-700 transition hover:bg-rose-50"
                >
                  Clear
                </button>
              </div>
            </div>

            <div className="mt-5 overflow-x-auto rounded-[1.75rem] border border-slate-200 bg-white p-4 shadow-inner shadow-slate-100/70">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-slate-900">24-hour availability canvas</p>
                  <p className="mt-1 text-xs text-slate-500">
                    The planner spans the full day, so you can open only the exact windows you want bookable.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <SoftPill label="Starts" value={`${String(plannerStartHour).padStart(2, "0")}:00`} tone="slate" />
                  <SoftPill label="Ends" value={`${String(plannerEndHour).padStart(2, "0")}:00`} tone="violet" />
                </div>
              </div>

              <div className="min-w-[1320px]">
                <div className="grid gap-2" style={{ gridTemplateColumns: `120px repeat(${plannerSlots.length}, minmax(24px, 1fr))` }}>
                  <div />
                  {plannerSlots.map((slot, index) => (
                    <div key={slot} className="text-center text-[10px] font-semibold text-slate-400">
                      {index % 2 === 0 ? slot : ""}
                    </div>
                  ))}
                </div>

                <div className="mt-2 space-y-2">
                  {plannerDays.map((day) => (
                    <div
                      key={day}
                      className="grid gap-2 items-center"
                      style={{ gridTemplateColumns: `120px repeat(${plannerSlots.length}, minmax(24px, 1fr))` }}
                    >
                      <div className="rounded-2xl bg-slate-50 px-3 py-3 text-sm font-semibold text-slate-800">
                        {weekDays[day]}
                      </div>
                      {plannerSlots.map((slot) => {
                        const key = plannerKey(day, slot);
                        const active = Boolean(plannerSelection[key]);
                        return (
                          <button
                            key={key}
                            type="button"
                            onClick={() =>
                              setPlannerSelection((current) => ({
                                ...current,
                                [key]: !current[key],
                              }))
                            }
                            className={`h-8 rounded-xl border transition ${
                              active
                                ? "border-sky-400 bg-gradient-to-br from-sky-400 to-cyan-400 shadow-sm shadow-sky-200/80"
                                : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
                            }`}
                            title={`${weekDays[day]} ${slot}`}
                          />
                        );
                      })}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-slate-500">
                Breaks and blocked dates can still be added below for exceptions. Current slot size: {plannerSlotMinutes} minutes.
              </p>
              <button
                type="button"
                onClick={handleSaveWeeklyPlanner}
                disabled={plannerSaving}
                className="rounded-xl bg-sky-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-sky-600 disabled:opacity-70"
              >
                {plannerSaving ? "Saving planner..." : "Save weekly availability"}
              </button>
            </div>
          </div>

          <form onSubmit={handleSubmitAvailability} className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-6">
            <select
              value={availabilityForm.type}
              onChange={(event) =>
                setAvailabilityForm((current) => ({
                  ...current,
                  type: event.target.value,
                  selectedWeekdays:
                    event.target.value === "workHours"
                      ? current.selectedWeekdays?.length
                        ? current.selectedWeekdays
                        : [current.dayOfWeek || "1"]
                      : [],
                  specificDate: event.target.value === "workHours" ? "" : current.specificDate,
                }))
              }
              className="rounded-xl border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
            >
              <option value="break">Break</option>
              <option value="blocked">Blocked date</option>
            </select>

            <input
              type="date"
              value={availabilityForm.specificDate}
              onChange={(event) => setAvailabilityForm((current) => ({ ...current, specificDate: event.target.value }))}
              className="rounded-xl border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
              required
            />

            <input
              type="time"
              value={availabilityForm.startTime}
              onChange={(event) => setAvailabilityForm((current) => ({ ...current, startTime: event.target.value }))}
              className="rounded-xl border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
              required
            />

            <input
              type="time"
              value={availabilityForm.endTime}
              onChange={(event) => setAvailabilityForm((current) => ({ ...current, endTime: event.target.value }))}
              className="rounded-xl border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
              required
            />

            <input
              type="text"
              placeholder="Reason (optional)"
              value={availabilityForm.reason}
              onChange={(event) => setAvailabilityForm((current) => ({ ...current, reason: event.target.value }))}
              className="rounded-xl border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 md:col-span-2"
            />

            <button
              type="submit"
              disabled={availabilitySaving}
              className="rounded-xl bg-sky-500 px-4 py-2 text-sm font-medium text-white hover:bg-sky-600 transition disabled:opacity-70"
            >
              {availabilitySaving ? "Saving..." : editingAvailabilityId ? "Update entry" : "Add entry"}
            </button>
          </form>

          <div className="mt-3 rounded-2xl border border-sky-100 bg-sky-50 px-4 py-3 text-sm text-sky-800">
            Use the visual planner for weekly bookable hours. Use the form below only for one-off breaks and blocked dates.
          </div>

          {availabilityError && (
            <div className="mt-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {availabilityError}
            </div>
          )}

          <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-sm font-semibold text-slate-900">Appointment duration rule</p>
                <p className="text-xs text-slate-500">Doctor-side scheduling now defaults to your preferred visit length.</p>
              </div>
              <select
                value={preferredDuration}
                onChange={(event) => handlePreferredDurationChange(event.target.value)}
                className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
              >
                {durationOptions.map((minutes) => (
                  <option key={minutes} value={String(minutes)}>{minutes} minutes</option>
                ))}
              </select>
            </div>
          </div>

          <div className="mt-5 grid gap-4 lg:grid-cols-3">
            {[
              { key: "workHours", title: "Work days & hours", empty: "No weekly work-hour blocks yet. Use the planner above, then save weekly availability to open booking slots." },
              { key: "breaks", title: "Breaks", empty: "No break windows defined yet. Add a break entry above if you need to protect time inside your workday." },
              { key: "blocked", title: "Blocked dates", empty: "No blocked dates defined yet. Add a blocked date above when you need to close a full day or one-off window." },
            ].map((section) => (
              <div key={section.key} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <h3 className="text-sm font-semibold text-slate-900">{section.title}</h3>
                <div className="mt-3 space-y-3">
                  {availabilityLoading ? (
                    <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-4 text-sm text-slate-500">
                      Loading...
                    </div>
                  ) : section.key === "workHours" && groupedWorkHours.length > 0 ? (
                    <div className="space-y-2">
                      {groupedWorkHours.map((group) => (
                        <div key={group.dayLabel} className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="text-sm font-semibold text-slate-900">{group.dayLabel}</p>
                              <p className="mt-1 text-sm text-slate-600">{group.ranges.join("  •  ")}</p>
                            </div>
                            <span className="rounded-full bg-sky-50 px-3 py-1 text-[11px] font-semibold text-sky-700">
                              Edit in planner
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : availabilityByType[section.key].length > 0 ? (
                    availabilityByType[section.key].map((entry) => (
                      <div key={entry.id} className="rounded-2xl border border-slate-200 bg-white p-4">
                        <p className="text-sm font-semibold text-slate-900">{availabilityTimingLabel(entry)}</p>
                        {entry.reason ? <p className="mt-1 text-xs text-slate-500">{entry.reason}</p> : null}
                        <div className="mt-3 flex gap-2">
                          {entry.type === "workHours" ? (
                            <span className="rounded-lg bg-sky-50 px-3 py-1.5 text-xs font-semibold text-sky-700">
                              Edit in planner
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => startEditAvailability(entry)}
                              className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                            >
                              Edit
                            </button>
                          )}
                          <button
                            type="button"
                            disabled={availabilitySaving}
                            onClick={() => handleDeleteAvailability(entry.id)}
                            className="rounded-lg bg-rose-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-rose-600 disabled:opacity-70"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-4 text-sm text-slate-500">
                      {section.empty}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>

      </main>
    </div>
  );
}
