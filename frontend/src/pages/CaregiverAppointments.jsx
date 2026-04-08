
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "../components/Navbar";
import { apiUrl, authHeaders } from "../api/http";
import { caregiverRequestAppointment, getCaregiverPatientAppointments } from "../api/caregiver";
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

function statusLabel(status) {
  if (status === "requested") return "Requested";
  if (status === "scheduled") return "Scheduled";
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

export default function CaregiverAppointments() {
  const navigate = useNavigate();

  const [linkedPatients, setLinkedPatients] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [activePatientId, setActivePatientId] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Request appointment modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [form, setForm] = useState({ startsAt: "", endsAt: "", location: "", notes: "" });
  const [requestMessage, setRequestMessage] = useState(null);
  const [requesting, setRequesting] = useState(false);

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

  // Load patient's appointments when activePatientId changes
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

  const activePatientRecord = useMemo(
    () => linkedPatients.find((r) => r.patient?.id === activePatientId) || null,
    [activePatientId, linkedPatients]
  );

  const canViewAppointments = Boolean(activePatientRecord?.permissions?.canViewAppointments);

  const upcomingAppointments = useMemo(
    () =>
      appointments
        .filter((a) => new Date(a.startsAt).getTime() >= Date.now())
        .sort((a, b) => new Date(a.startsAt) - new Date(b.startsAt)),
    [appointments]
  );

  const pastAppointments = useMemo(
    () =>
      appointments
        .filter((a) => new Date(a.startsAt).getTime() < Date.now())
        .sort((a, b) => new Date(b.startsAt) - new Date(a.startsAt)),
    [appointments]
  );

  const handleRequest = async () => {
    if (!form.startsAt || !form.endsAt) {
      setRequestMessage("Start and end times are required.");
      return;
    }
    if (new Date(form.startsAt) >= new Date(form.endsAt)) {
      setRequestMessage("End time must be after start time.");
      return;
    }
    setRequesting(true);
    setRequestMessage(null);
    try {
      await caregiverRequestAppointment(activePatientId, {
        startsAt: new Date(form.startsAt).toISOString(),
        endsAt: new Date(form.endsAt).toISOString(),
        location: form.location || null,
        notes: form.notes || null,
      });
      setRequestMessage("Appointment requested successfully.");
      setIsModalOpen(false);
      setForm({ startsAt: "", endsAt: "", location: "", notes: "" });
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
          <div className="mt-4 rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sk