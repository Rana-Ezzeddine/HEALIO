// frontend/src/pages/medication.jsx
// Changes: drug autocomplete via OpenFDA, doctor dropdown from linked doctors

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Navbar from "../components/Navbar";
import { Clock, Pill, Plus, Search, X } from "lucide-react";
import { apiUrl, authHeaders } from "../api/http";
import { getMedicationFilterOptions, searchAndFilterMedications } from "../api/search";
import { getMyDoctors } from "../api/links";
import {
  formatDoseTime,
  getNextMedicationDose,
  getScheduleTimes,
  isActiveMedication,
} from "../utils/medicationSchedule";

// ─── helpers (unchanged) ─────────────────────────────────────────────────────

const DOSAGE_UNITS = ["mg", "mcg", "g", "mL", "tablet(s)", "capsule(s)", "drop(s)", "unit(s)", "puff(s)"];
const FREQUENCY_OPTIONS = ["Once daily", "Twice daily", "Three times daily", "Every 8 hours", "Weekly", "As needed", "Custom"];

function parseScheduleInput(times) {
  return {
    times: Array.isArray(times)
      ? times.map((item) => String(item || "").trim()).filter(Boolean)
      : [],
  };
}

function getSuggestedTimesForFrequency(frequency) {
  if (frequency === "Twice daily") return ["08:00", "20:00"];
  if (frequency === "Three times daily") return ["08:00", "14:00", "20:00"];
  if (frequency === "Every 8 hours") return ["06:00", "14:00", "22:00"];
  if (frequency === "Once daily") return ["08:00"];
  return [];
}

function parseDosageParts(value) {
  const trimmed = String(value || "").trim();
  const match = trimmed.match(/^(\d+(?:\.\d+)?)\s*(.+)$/);
  if (!match) {
    return { doseAmount: "", doseUnit: "mg" };
  }

  const [, doseAmount, rawUnit] = match;
  const doseUnit = DOSAGE_UNITS.includes(rawUnit) ? rawUnit : "mg";
  return { doseAmount, doseUnit };
}

function formatScheduleInput(scheduleJson, frequency) {
  const times = getScheduleTimes({ scheduleJson, frequency });
  return times.join(", ");
}

function getMedicationWarnings(medication) {
  const warnings = [];
  if (!medication.endDate) return warnings;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const endDate = new Date(`${medication.endDate}T00:00:00`);
  const diffDays = Math.ceil((endDate - today) / (1000 * 60 * 60 * 24));
  if (diffDays < 0) warnings.push("Medication end date already passed.");
  else if (diffDays <= 3) warnings.push(`Ends in ${diffDays} day${diffDays === 1 ? "" : "s"}.`);
  else if (diffDays <= 7) warnings.push(`End date coming up in ${diffDays} days.`);
  return warnings;
}

function getLatestAdherenceStatus(medication) {
  const entry = Array.isArray(medication.adherenceHistory)
    ? medication.adherenceHistory.find((item) => item && typeof item === "object")
    : null;
  return entry?.status || null;
}

function formatAdherenceLabel(status) {
  if (status === "taken") return "Taken";
  if (status === "missed") return "Missed";
  if (status === "skipped") return "Skipped";
  if (status === "delayed") return "Delayed";
  return status || "Unknown";
}

function getAdherenceTone(status) {
  if (status === "taken") return "bg-emerald-100 text-emerald-700";
  if (status === "missed") return "bg-rose-100 text-rose-700";
  if (status === "skipped") return "bg-amber-100 text-amber-700";
  if (status === "delayed") return "bg-indigo-100 text-indigo-700";
  return "bg-slate-100 text-slate-700";
}

function getNextDoseForMedication(medication) {
  return getNextMedicationDose([medication]);
}

function getDoseKey(dateLike) {
  const parsed = new Date(dateLike);
  if (Number.isNaN(parsed.getTime())) return "";
  parsed.setSeconds(0, 0);
  return parsed.toISOString();
}

function hasLoggedDose(medication, doseAt) {
  const doseKey = getDoseKey(doseAt);
  return (Array.isArray(medication.adherenceHistory) ? medication.adherenceHistory : [])
    .filter((entry) => entry && typeof entry === "object")
    .some((entry) => getDoseKey(entry.scheduledFor) === doseKey);
}

function buildDoseCandidate(baseDate, timeString) {
  const [hourString, minuteString] = String(timeString || "").split(":");
  const hour = Number(hourString);
  const minute = Number(minuteString);
  if (!Number.isInteger(hour) || !Number.isInteger(minute)) return null;
  const candidate = new Date(baseDate);
  candidate.setHours(hour, minute, 0, 0);
  return candidate;
}

function formatRecordedDateTime(value) {
  const parsed = value ? new Date(value) : null;
  if (!parsed || Number.isNaN(parsed.getTime())) return "Time unavailable";
  return parsed.toLocaleString();
}

function getActionableDose(medication, now = new Date()) {
  if (!isActiveMedication(medication, now)) return null;
  const scheduleTimes = getScheduleTimes(medication);
  const leadMinutes = medication.reminderLeadMinutes ?? 30;
  const candidates = [];
  for (let dayOffset = 0; dayOffset <= 1; dayOffset += 1) {
    const baseDate = new Date(now);
    baseDate.setDate(baseDate.getDate() + dayOffset);
    for (const time of scheduleTimes) {
      const candidate = buildDoseCandidate(baseDate, time);
      if (!candidate) continue;
      const windowStart = candidate.getTime() - leadMinutes * 60 * 1000;
      const windowEnd = candidate.getTime() + 2 * 60 * 60 * 1000;
      if (now.getTime() < windowStart || now.getTime() > windowEnd) continue;
      if (hasLoggedDose(medication, candidate)) continue;
      candidates.push(candidate);
    }
  }
  candidates.sort((a, b) => a - b);
  return candidates[0] || null;
}

function getMedicationHistoryEntries(medication) {
  return (Array.isArray(medication.adherenceHistory) ? medication.adherenceHistory : [])
    .filter((entry) => entry && typeof entry === "object")
    .map((entry, index) => ({
      key: `${medication.id}-${entry.recordedAt || entry.scheduledFor || index}-${entry.status}`,
      ...entry,
    }))
    .sort(
      (a, b) =>
        new Date(b.recordedAt || b.scheduledFor) - new Date(a.recordedAt || a.scheduledFor)
    )
    .slice(0, 10);
}

// ─── NEW: OpenFDA drug search ─────────────────────────────────────────────────

async function searchOpenFDA(query) {
  if (!query || query.trim().length < 2) return [];
  try {
    const encoded = encodeURIComponent(query.trim());
    const url = `https://api.fda.gov/drug/label.json?search=openfda.brand_name:"${encoded}"+openfda.generic_name:"${encoded}"&limit=8`;
    const res = await fetch(url);
    if (!res.ok) return [];
    const data = await res.json();
    const results = [];
    const seen = new Set();

    for (const result of data.results || []) {
      const brandNames = result.openfda?.brand_name || [];
      const genericNames = result.openfda?.generic_name || [];
      const dosageForms = result.openfda?.dosage_form || [];
      const routes = result.openfda?.route || [];

      // Extract dosage strength from description fields
      const dosageAndAdmin = result.dosage_and_administration?.[0] || "";
      const description = result.description?.[0] || "";

      // Try to find a dosage pattern like "500 mg" or "10 mg/5 mL"
      const dosageMatch =
        dosageAndAdmin.match(/\d+(?:\.\d+)?\s*(?:mg|mcg|g|mL|mg\/mL|mg\/5mL|%)/i) ||
        description.match(/\d+(?:\.\d+)?\s*(?:mg|mcg|g|mL|mg\/mL|mg\/5mL|%)/i);

      const dosage = dosageMatch ? dosageMatch[0] : dosageForms[0] || "";

      // Map FDA frequency language to readable form
      const rawFreq = result.dosage_and_administration?.[0] || "";
      let frequency = "Once daily";
      if (/twice daily|two times/i.test(rawFreq)) frequency = "Twice daily";
      else if (/three times|3 times/i.test(rawFreq)) frequency = "Three times daily";
      else if (/every 4 hours/i.test(rawFreq)) frequency = "Every 4 hours";
      else if (/every 6 hours/i.test(rawFreq)) frequency = "Every 6 hours";
      else if (/every 8 hours/i.test(rawFreq)) frequency = "Every 8 hours";
      else if (/every 12 hours/i.test(rawFreq)) frequency = "Every 12 hours";
      else if (/as needed|prn/i.test(rawFreq)) frequency = "As needed";
      else if (/weekly/i.test(rawFreq)) frequency = "Once weekly";

      const route = routes[0] || "";

      for (const name of [...brandNames, ...genericNames]) {
        const key = name.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        results.push({
          name,
          dosage: dosage || "See label",
          frequency,
          route,
          form: dosageForms[0] || "",
        });
        if (results.length >= 8) break;
      }
      if (results.length >= 8) break;
    }
    return results;
  } catch {
    return [];
  }
}

// ─── NEW: Drug autocomplete component ────────────────────────────────────────

function DrugAutocomplete({ value, onChange, onSelect, disabled }) {
  const [suggestions, setSuggestions] = useState([]);
  const [isOpen, setIsOpen] = useState(false);
  const [searching, setSearching] = useState(false);
  const debounceRef = useRef(null);
  const wrapperRef = useRef(null);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleInputChange = (e) => {
    const val = e.target.value;
    onChange(val);

    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (val.trim().length < 2) {
      setSuggestions([]);
      setIsOpen(false);
      return;
    }

    setSearching(true);
    debounceRef.current = setTimeout(async () => {
      const results = await searchOpenFDA(val);
      setSuggestions(results);
      setIsOpen(results.length > 0);
      setSearching(false);
    }, 400);
  };

  const handleSelect = (drug) => {
    onChange(drug.name);
    onSelect(drug);
    setSuggestions([]);
    setIsOpen(false);
  };

  return (
    <div ref={wrapperRef} className="relative">
      <div className="relative">
        <input
          type="text"
          value={value}
          onChange={handleInputChange}
          disabled={disabled}
          placeholder="Start typing a medicine name..."
          required
          className="w-full rounded-lg border border-slate-300 px-3 py-2 pr-8 focus:outline-none focus:ring-2 focus:ring-sky-500"
        />
        {searching && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400">
            Searching...
          </span>
        )}
      </div>

      {isOpen && suggestions.length > 0 && (
        <ul className="absolute z-50 mt-1 w-full rounded-xl border border-slate-200 bg-white shadow-lg overflow-hidden">
          {suggestions.map((drug, i) => (
            <li
              key={`${drug.name}-${i}`}
              onMouseDown={() => handleSelect(drug)}
              className="cursor-pointer px-4 py-3 hover:bg-sky-50 border-b border-slate-100 last:border-0"
            >
              <p className="font-medium text-slate-800 text-sm">{drug.name}</p>
              <p className="text-xs text-slate-500 mt-0.5">
                {[drug.dosage, drug.frequency, drug.form].filter(Boolean).join(" · ")}
              </p>
            </li>
          ))}
          <li className="px-4 py-2 text-xs text-slate-400 bg-slate-50">
            Data from OpenFDA · Review before saving
          </li>
        </ul>
      )}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function MedicationManager() {
  const [medications, setMedications] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingMed, setEditingMed] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [doctorFilter, setDoctorFilter] = useState("");
  const [frequencyFilter, setFrequencyFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [sortBy, setSortBy] = useState("createdAt");
  const [sortOrder, setSortOrder] = useState("DESC");
  const [filterOptions, setFilterOptions] = useState({ doctors: [], frequencies: [] });
  const [error, setError] = useState("");
  const [expandedHistoryMedicationId, setExpandedHistoryMedicationId] = useState("");

  // NEW: linked doctors list for the dropdown
  const [linkedDoctors, setLinkedDoctors] = useState([]);

  const [formData, setFormData] = useState({
    name: "",
    doseAmount: "",
    doseUnit: "mg",
    frequency: "Once daily",
    prescribedBy: "",
    startDate: "",
    endDate: "",
    notes: "",
    scheduleTimes: [],
    reminderEnabled: true,
    reminderLeadMinutes: 30,
  });

  // NEW: track whether dosage/frequency were auto-filled
  const [autoFilled, setAutoFilled] = useState(false);

  const fetchMedicationFilterOptions = useCallback(async () => {
    try {
      const data = await getMedicationFilterOptions();
      setFilterOptions({
        doctors: Array.isArray(data.doctors) ? data.doctors : [],
        frequencies: Array.isArray(data.frequencies) ? data.frequencies : [],
      });
    } catch (loadError) {
      console.error(loadError);
    }
  }, []);

  const fetchMedications = useCallback(async () => {
    try {
      const data = await searchAndFilterMedications({
        q: searchTerm,
        prescribedBy: doctorFilter,
        frequency: frequencyFilter,
        status: statusFilter,
        sortBy,
        sortOrder,
      });
      setMedications(Array.isArray(data.medications) ? data.medications : []);
      setError("");
    } catch (loadError) {
      console.error(loadError);
      setMedications([]);
      setError(loadError.message || "Failed to load medications.");
    }
  }, [doctorFilter, frequencyFilter, searchTerm, sortBy, sortOrder, statusFilter]);

  useEffect(() => {
    fetchMedicationFilterOptions();
  }, [fetchMedicationFilterOptions]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => fetchMedications(), 250);
    return () => window.clearTimeout(timeoutId);
  }, [fetchMedications]);

  // NEW: load linked doctors on mount
  // getMyDoctors() → { doctors: [{ status, doctor: { id, email, firstName, lastName, displayName } }] }
  useEffect(() => {
    getMyDoctors()
      .then((data) => {
        // Only show active doctor assignments
        // DoctorPatientAssignment.status exact value: 'active'
        const active = (data.doctors || []).filter((d) => d.status === "active");
        setLinkedDoctors(active);
      })
      .catch(() => setLinkedDoctors([]));
  }, []);

  const medicationList = useMemo(
    () =>
      Array.isArray(medications)
        ? medications.filter((item) => item && typeof item === "object")
        : [],
    [medications]
  );

  function openModal(medication = null) {
    setAutoFilled(false);
    if (medication) {
      setEditingMed(medication);
      const dosageParts = parseDosageParts(medication.dosage);
      setFormData({
        name: medication.name || "",
        doseAmount: dosageParts.doseAmount,
        doseUnit: dosageParts.doseUnit,
        frequency: medication.frequency || "Once daily",
        prescribedBy: medication.prescribedBy || "",
        startDate: medication.startDate || "",
        endDate: medication.endDate || "",
        notes: medication.notes || "",
        scheduleTimes: getScheduleTimes({ scheduleJson: medication.scheduleJson, frequency: medication.frequency }),
        reminderEnabled: medication.reminderEnabled !== false,
        reminderLeadMinutes: medication.reminderLeadMinutes ?? 30,
      });
    } else {
      setEditingMed(null);
      setFormData({
        name: "",
        doseAmount: "",
        doseUnit: "mg",
        frequency: "Once daily",
        prescribedBy: "",
        startDate: "",
        endDate: "",
        notes: "",
        scheduleTimes: [],
        reminderEnabled: true,
        reminderLeadMinutes: 30,
      });
    }
    setIsModalOpen(true);
  }

  function closeModal() {
    setIsModalOpen(false);
    setEditingMed(null);
    setAutoFilled(false);
  }

  // NEW: called when patient selects a drug from autocomplete
  function handleDrugSelect(drug) {
    const dosageParts = parseDosageParts(drug.dosage);
    setFormData((current) => ({
      ...current,
      name: drug.name,
      doseAmount: dosageParts.doseAmount || current.doseAmount,
      doseUnit: dosageParts.doseUnit || current.doseUnit,
      frequency: drug.frequency || current.frequency,
    }));
    setAutoFilled(true);
  }

  async function handleSubmit(event) {
    event.preventDefault();
    const dosage = `${String(formData.doseAmount || "").trim()} ${String(formData.doseUnit || "").trim()}`.trim();
    const payload = {
      name: formData.name,
      dosage,
      frequency: formData.frequency,
      // prescribedBy is now a doctor's display name from the dropdown
      prescribedBy: formData.prescribedBy,
      startDate: formData.startDate,
      endDate: formData.endDate,
      notes: formData.notes,
      scheduleJson: parseScheduleInput(formData.scheduleTimes),
      reminderEnabled: Boolean(formData.reminderEnabled),
      reminderLeadMinutes: Number(formData.reminderLeadMinutes || 0),
      adherenceHistory: editingMed?.adherenceHistory || [],
    };

    try {
      const response = await fetch(
        `${apiUrl}/api/medications${editingMed ? `/${editingMed.id}` : ""}`,
        {
          method: editingMed ? "PUT" : "POST",
          headers: { "Content-Type": "application/json", ...authHeaders() },
          body: JSON.stringify(payload),
        }
      );
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data?.error || data?.message || "Failed to save medication.");
      }
      closeModal();
      await fetchMedicationFilterOptions();
      await fetchMedications();
    } catch (saveError) {
      alert(saveError.message || "Failed to save medication.");
    }
  }

  function updateMedicationTime(index, value) {
    setFormData((current) => ({
      ...current,
      scheduleTimes: current.scheduleTimes.map((time, timeIndex) => (timeIndex === index ? value : time)),
    }));
  }

  function addMedicationTime() {
    setFormData((current) => ({
      ...current,
      scheduleTimes: [...current.scheduleTimes, ""],
    }));
  }

  function removeMedicationTime(index) {
    setFormData((current) => ({
      ...current,
      scheduleTimes: current.scheduleTimes.filter((_, timeIndex) => timeIndex !== index),
    }));
  }

  async function deleteMedication(id) {
    if (!window.confirm("Are you sure you want to delete this medication?")) return;
    try {
      const response = await fetch(`${apiUrl}/api/medications/${id}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json", ...authHeaders() },
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data?.error || data?.message || "Failed to delete medication.");
      }
      await fetchMedicationFilterOptions();
      await fetchMedications();
    } catch (deleteError) {
      alert(deleteError.message || "Failed to delete medication.");
    }
  }

  async function logAdherence(medication, status) {
    const actionableDose = getActionableDose(medication, new Date());
    if (!actionableDose) {
      alert("No dose to log right now.");
      return;
    }
    try {
      const response = await fetch(`${apiUrl}/api/medications/${medication.id}/adherence`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({
          status,
          scheduledFor: actionableDose.toISOString(),
          delayMinutes: status === "delayed" ? 30 : undefined,
          notes: "",
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data?.error || data?.message || "Failed to save adherence status.");
      }
      await fetchMedications();
    } catch (adherenceError) {
      alert(adherenceError.message || "Failed to save adherence status.");
    }
  }

  const nextDose = useMemo(() => getNextMedicationDose(medicationList), [medicationList]);
  const nextDoseText = nextDose
    ? `${nextDose.medication?.name || "Medication"} at ${formatDoseTime(nextDose.at)}`
    : "No upcoming doses";

  const dueSoon = useMemo(() => {
    const now = new Date();
    return medicationList
      .filter((medication) => isActiveMedication(medication, now))
      .map((medication) => ({ medication, dose: getActionableDose(medication, now) }))
      .filter((item) => item.dose)
      .slice(0, 3);
  }, [medicationList]);

  const warnings = useMemo(
    () =>
      medicationList
        .flatMap((medication) =>
          getMedicationWarnings(medication).map((warning) => ({ medication, warning }))
        )
        .slice(0, 5),
    [medicationList]
  );

  // Build doctor display name for the dropdown
  // Uses exact response shape from getMyDoctors() → doctor.controller.js getMyDoctors
  function doctorDisplayName(d) {
    return (
      d.doctor?.displayName ||
      [d.doctor?.firstName, d.doctor?.lastName].filter(Boolean).join(" ") ||
      d.doctor?.email ||
      "Unknown Doctor"
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-sky-50 via-white to-indigo-50 p-6">
      <Navbar />

      <div className="mx-auto max-w-6xl pt-20">
        {/* ── Header section (unchanged) ── */}
        <section className="rounded-[2rem] bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="flex items-center gap-3">
                <Pill className="text-sky-500" size={24} />
                <h1 className="text-3xl font-bold text-slate-900">Medication Management</h1>
              </div>
              <p className="mt-2 text-sm text-slate-600">
                Track medications, log doses, and keep reminders and end-date warnings visible.
              </p>
            </div>
            <button
              onClick={() => openModal()}
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-sky-500 px-4 py-3 font-medium text-white shadow-md transition hover:bg-sky-600"
            >
              <Plus size={20} />
              Add Medication
            </button>
          </div>

          <div className="mt-5 grid gap-4 lg:grid-cols-3">
            <div className="rounded-3xl bg-sky-50 p-5">
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-indigo-100">
                  <Clock className="text-indigo-600" />
                </div>
                <div>
                  <p className="text-sm text-slate-600">Next Dose</p>
                  <p className="text-lg font-semibold text-slate-900">{nextDoseText}</p>
                </div>
              </div>
            </div>
            <div className="rounded-3xl bg-amber-50 p-5">
              <p className="text-sm text-slate-600">Reminders due soon</p>
              <p className="mt-1 text-2xl font-bold text-slate-900">{dueSoon.length}</p>
              <p className="mt-2 text-sm text-slate-600">Visible from each medication schedule.</p>
            </div>
            <div className="rounded-3xl bg-rose-50 p-5">
              <p className="text-sm text-slate-600">End-date warnings</p>
              <p className="mt-1 text-2xl font-bold text-slate-900">{warnings.length}</p>
              <p className="mt-2 text-sm text-slate-600">
                Shown within 7 days of the medication end date.
              </p>
            </div>
          </div>
        </section>

        {/* ── Reminders + warnings (unchanged) ── */}
        <section className="mt-6 grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="rounded-3xl bg-white p-6 shadow-sm">
            <h2 className="text-xl font-semibold text-slate-900">Visible reminders</h2>
            <div className="mt-4 space-y-3">
              {dueSoon.length > 0 ? (
                dueSoon.map(({ medication, dose }) => (
                  <div
                    key={medication.id}
                    className="rounded-2xl border border-amber-200 bg-amber-50 p-4"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold text-slate-900">{medication.name}</p>
                        <p className="mt-1 text-sm text-slate-600">
                          Reminder {medication.reminderLeadMinutes ?? 30} min before{" "}
                          {formatDoseTime(dose.at)}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => logAdherence(medication, "taken")}
                        className="rounded-xl bg-emerald-500 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-600 transition"
                      >
                        Mark taken
                      </button>
                    </div>
                  </div>
                ))
              ) : (
                <p className="rounded-2xl border border-dashed border-slate-200 p-4 text-sm text-slate-500">
                  No reminders due soon.
                </p>
              )}
            </div>
          </div>

          <div className="rounded-3xl bg-white p-6 shadow-sm">
            <h2 className="text-xl font-semibold text-slate-900">End-date warnings</h2>
            <div className="mt-4 space-y-3">
              {warnings.length > 0 ? (
                warnings.map(({ medication, warning }) => (
                  <div
                    key={`${medication.id}-${warning}`}
                    className="rounded-2xl border border-rose-200 bg-rose-50 p-4"
                  >
                    <p className="font-semibold text-slate-900">{medication.name}</p>
                    <p className="mt-1 text-sm text-slate-600">{warning}</p>
                    <button
                      type="button"
                      onClick={() => openModal(medication)}
                      className="mt-3 rounded-xl border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-white transition"
                    >
                      Review medication
                    </button>
                  </div>
                ))
              ) : (
                <p className="rounded-2xl border border-dashed border-slate-200 p-4 text-sm text-slate-500">
                  No end-date warnings right now.
                </p>
              )}
            </div>
          </div>
        </section>

        {/* ── Filters + medication list (unchanged) ── */}
        <section className="mt-6 rounded-3xl bg-white p-6 shadow-sm">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-5">
            <div className="relative md:col-span-2">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                <Search className="text-slate-400" size={20} />
              </div>
              <input
                type="text"
                placeholder="Search medications by name or doctor..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full rounded-2xl border border-slate-300 py-2.5 pl-10 pr-4 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-sky-500"
              />
            </div>
            <select
              value={doctorFilter}
              onChange={(e) => setDoctorFilter(e.target.value)}
              className="rounded-2xl border border-slate-300 px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-sky-500"
            >
              <option value="">All Doctors</option>
              {filterOptions.doctors.map((doctor) => (
                <option key={doctor} value={doctor}>
                  {doctor}
                </option>
              ))}
            </select>
            <select
              value={frequencyFilter}
              onChange={(e) => setFrequencyFilter(e.target.value)}
              className="rounded-2xl border border-slate-300 px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-sky-500"
            >
              <option value="">All Frequencies</option>
              {filterOptions.frequencies.map((frequency) => (
                <option key={frequency} value={frequency}>
                  {frequency}
                </option>
              ))}
            </select>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="rounded-2xl border border-slate-300 px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-sky-500"
            >
              <option value="">All Statuses</option>
              <option value="active">Active</option>
              <option value="past">Past</option>
            </select>
          </div>

          <div className="mt-3 flex flex-wrap gap-3">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="rounded-2xl border border-slate-300 px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-sky-500"
            >
              <option value="createdAt">Sort by Added Date</option>
              <option value="name">Sort by Name</option>
              <option value="startDate">Sort by Start Date</option>
              <option value="endDate">Sort by End Date</option>
            </select>
            <select
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value)}
              className="rounded-2xl border border-slate-300 px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-sky-500"
            >
              <option value="DESC">Newest First</option>
              <option value="ASC">Oldest First</option>
            </select>
            <button
              type="button"
              onClick={() => {
                setSearchTerm("");
                setDoctorFilter("");
                setFrequencyFilter("");
                setStatusFilter("");
                setSortBy("createdAt");
                setSortOrder("DESC");
              }}
              className="rounded-2xl border border-slate-300 px-4 py-2.5 text-slate-700 transition hover:bg-slate-50"
            >
              Reset Filters
            </button>
          </div>

          {error ? <p className="mt-4 text-sm text-red-600">{error}</p> : null}

          <div className="mt-6 grid gap-4">
            {medicationList.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-slate-200 p-10 text-center text-slate-500">
                No medications found.
              </div>
            ) : (
              medicationList.map((medication) => {
                const latestStatus = getLatestAdherenceStatus(medication);
                const nextMedicationDose = getNextDoseForMedication(medication);
                const medicationWarnings = getMedicationWarnings(medication);
                const actionableDose = getActionableDose(medication);

                return (
                  <div key={medication.id} className="rounded-3xl border border-slate-200 p-5">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-xl font-semibold text-slate-900">
                            {medication.name}
                          </h3>
                          <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-600">
                            {medication.dosage}
                          </span>
                          {latestStatus ? (
                            <span
                              className={`rounded-full px-2 py-1 text-xs font-semibold ${getAdherenceTone(latestStatus)}`}
                            >
                              Last dose: {formatAdherenceLabel(latestStatus)}
                            </span>
                          ) : null}
                        </div>
                        <p className="mt-2 text-sm text-slate-600">
                          {medication.frequency}
                          {medication.prescribedBy
                            ? ` | Prescribed by ${medication.prescribedBy}`
                            : ""}
                        </p>
                        <p className="mt-1 text-sm text-slate-500">
                          Schedule:{" "}
                          {formatScheduleInput(medication.scheduleJson, medication.frequency)}
                        </p>
                        <p className="mt-1 text-sm text-slate-500">
                          Reminder:{" "}
                          {medication.reminderEnabled === false
                            ? "Off"
                            : `${medication.reminderLeadMinutes ?? 30} minutes before dose`}
                        </p>
                        {nextMedicationDose ? (
                          <p className="mt-1 text-sm font-medium text-sky-700">
                            Next dose at {formatDoseTime(nextMedicationDose.at)}
                          </p>
                        ) : null}
                        {medication.notes ? (
                          <p className="mt-3 text-sm text-slate-600">{medication.notes}</p>
                        ) : null}
                        {medicationWarnings.length > 0 ? (
                          <div className="mt-3 flex flex-wrap gap-2">
                            {medicationWarnings.map((warning) => (
                              <span
                                key={warning}
                                className="rounded-full bg-rose-100 px-3 py-1 text-xs font-semibold text-rose-700"
                              >
                                {warning}
                              </span>
                            ))}
                          </div>
                        ) : null}
                        {actionableDose ? (
                          <p className="mt-3 text-sm font-medium text-emerald-700">
                            Dose ready to log now.
                          </p>
                        ) : null}
                      </div>

                      <div className="flex flex-wrap gap-2">
                        {actionableDose
                          ? ["taken", "missed", "skipped", "delayed"].map((statusValue) => (
                              <button
                                key={statusValue}
                                type="button"
                                onClick={() => logAdherence(medication, statusValue)}
                                className={`rounded-xl px-3 py-2 text-xs font-semibold transition ${getAdherenceTone(statusValue)}`}
                              >
                                Mark {formatAdherenceLabel(statusValue)}
                              </button>
                            ))
                          : null}
                        <button
                          type="button"
                          onClick={() => openModal(medication)}
                          className="rounded-xl bg-sky-500 px-3 py-2 text-xs font-semibold text-white hover:bg-sky-600 transition"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => deleteMedication(medication.id)}
                          className="rounded-xl bg-red-50 px-3 py-2 text-xs font-semibold text-red-700 hover:bg-red-100 transition"
                        >
                          Delete
                        </button>
                      </div>
                    </div>

                    {getMedicationHistoryEntries(medication).length > 0 ? (
                      <div className="mt-4 rounded-2xl bg-slate-50 p-4">
                        <div className="flex items-center justify-between gap-3">
                          <h4 className="text-sm font-semibold text-slate-900">
                            Recent adherence
                          </h4>
                          {getMedicationHistoryEntries(medication).length > 3 ? (
                            <button
                              type="button"
                              onClick={() =>
                                setExpandedHistoryMedicationId((current) =>
                                  current === medication.id ? "" : medication.id
                                )
                              }
                              className="text-xs font-semibold text-sky-700 transition hover:text-sky-800"
                            >
                              {expandedHistoryMedicationId === medication.id
                                ? "Show less"
                                : "See all"}
                            </button>
                          ) : null}
                        </div>
                        <div className="mt-3 space-y-2">
                          {getMedicationHistoryEntries(medication)
                            .slice(
                              0,
                              expandedHistoryMedicationId === medication.id ? 10 : 3
                            )
                            .map((entry) => (
                              <div
                                key={entry.key}
                                className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2"
                              >
                                <div>
                                  <p className="text-sm font-medium text-slate-900">
                                    {formatRecordedDateTime(
                                      entry.scheduledFor || entry.recordedAt
                                    )}
                                  </p>
                                  {entry.delayMinutes != null ? (
                                    <p className="text-xs text-slate-500">
                                      Delay: {entry.delayMinutes} min
                                    </p>
                                  ) : null}
                                </div>
                                <span
                                  className={`rounded-full px-3 py-1 text-xs font-semibold ${getAdherenceTone(entry.status)}`}
                                >
                                  {formatAdherenceLabel(entry.status)}
                                </span>
                              </div>
                            ))}
                        </div>
                      </div>
                    ) : null}
                  </div>
                );
              })
            )}
          </div>
        </section>

        {/* ── Modal — only this section changed ── */}
        {isModalOpen ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
            <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-3xl bg-white shadow-lg">
              <div className="sticky top-0 flex items-center justify-between border-b border-slate-200 bg-white p-6">
                <h2 className="text-xl font-semibold text-slate-900">
                  {editingMed ? "Edit Medication" : "Add New Medication"}
                </h2>
                <button
                  onClick={closeModal}
                  className="text-slate-400 transition hover:text-slate-600"
                >
                  <X size={24} />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="p-6">
                <div className="grid grid-cols-1 gap-5 md:grid-cols-2">

                  {/* ── Medication name — NOW autocomplete ── */}
                  <div className="md:col-span-2">
                    <label className="mb-1.5 block text-sm font-medium text-slate-700">
                      Medication Name
                    </label>
                    <p className="mb-1.5 text-xs text-slate-500">
                      Start typing to search the drug database. Select a result to
                      auto-fill dosage and frequency.
                    </p>
                    <DrugAutocomplete
                      value={formData.name}
                      onChange={(val) =>
                        setFormData((current) => ({ ...current, name: val }))
                      }
                      onSelect={handleDrugSelect}
                      disabled={Boolean(editingMed)}
                    />
                    {editingMed && (
                      <p className="mt-1 text-xs text-slate-400">
                        Drug name cannot be changed when editing. Delete and re-add if needed.
                      </p>
                    )}
                  </div>

                  {/* ── Dosage — auto-filled, still editable ── */}
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-slate-700">
                      Dosage
                      {autoFilled && (
                        <span className="ml-2 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-normal text-emerald-700">
                          Auto-filled · review
                        </span>
                      )}
                    </label>
                    <p className="mb-1.5 text-xs text-slate-500">
                      Structured dose amount and unit, matching doctor-side medication entry.
                    </p>
                    <div className="grid grid-cols-[minmax(0,1fr)_140px] gap-2">
                      <input
                        type="number"
                        min="0"
                        step="0.1"
                        value={formData.doseAmount}
                        onChange={(event) => setFormData((current) => ({ ...current, doseAmount: event.target.value }))}
                        required
                        className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-sky-500"
                      />
                      <select
                        value={formData.doseUnit}
                        onChange={(event) => setFormData((current) => ({ ...current, doseUnit: event.target.value }))}
                        className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-sky-500"
                      >
                        {DOSAGE_UNITS.map((unit) => (
                          <option key={unit} value={unit}>
                            {unit}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* ── Frequency — auto-filled, still editable ── */}
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-slate-700">
                      Frequency
                      {autoFilled && (
                        <span className="ml-2 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-normal text-emerald-700">
                          Auto-filled · review
                        </span>
                      )}
                    </label>
                    <p className="mb-1.5 text-xs text-slate-500">
                      Choose a scheduling pattern instead of entering free text.
                    </p>
                    <select
                      value={formData.frequency}
                      onChange={(event) => {
                        const frequency = event.target.value;
                        const suggestedTimes = getSuggestedTimesForFrequency(frequency);
                        setFormData((current) => ({
                          ...current,
                          frequency,
                          scheduleTimes:
                            current.scheduleTimes.length === 0
                              ? current.scheduleTimes
                              : current.scheduleTimes.every((time) => ["08:00", "20:00", "14:00", "06:00", "22:00"].includes(time))
                                ? suggestedTimes
                                : current.scheduleTimes,
                        }));
                      }}
                      required
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-sky-500"
                    >
                      {FREQUENCY_OPTIONS.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* ── Prescribed By — NOW a dropdown of linked doctors ── */}
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-slate-700">
                      Prescribed By
                    </label>
                    {linkedDoctors.length > 0 ? (
                      <>
                        <p className="mb-1.5 text-xs text-slate-500">
                          Select the doctor who prescribed this medication.
                        </p>
                        <select
                          value={formData.prescribedBy}
                          onChange={(e) =>
                            setFormData((current) => ({
                              ...current,
                              prescribedBy: e.target.value,
                            }))
                          }
                          className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-sky-500"
                        >
                          <option value="">Select a doctor (optional)</option>
                          {linkedDoctors.map((d) => (
                            <option key={d.doctor?.id} value={doctorDisplayName(d)}>
                              {doctorDisplayName(d)}
                            </option>
                          ))}
                          <option value="Self / OTC">Self / Over the counter</option>
                        </select>
                      </>
                    ) : (
                      <>
                        <p className="mb-1.5 text-xs text-slate-500">
                          No linked doctors found. Link a doctor from your Care Team first,
                          or type the name manually.
                        </p>
                        <input
                          type="text"
                          value={formData.prescribedBy}
                          onChange={(e) =>
                            setFormData((current) => ({
                              ...current,
                              prescribedBy: e.target.value,
                            }))
                          }
                          placeholder="Doctor's name (optional)"
                          className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-sky-500"
                        />
                      </>
                    )}
                  </div>

                  {/* ── Schedule times (unchanged) ── */}
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-slate-700">
                      Schedule times
                    </label>
                    <p className="mb-1.5 text-xs text-slate-500">
                      Add one or more dosing times in HH:MM format.
                    </p>
                    <div className="space-y-2">
                      {formData.scheduleTimes.map((time, index) => (
                        <div key={`${index}-${time}`} className="flex items-center gap-2">
                          <input
                            type="time"
                            value={time}
                            onChange={(event) => updateMedicationTime(index, event.target.value)}
                            className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-sky-500"
                          />
                          <button
                            type="button"
                            onClick={() => removeMedicationTime(index)}
                            className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
                          >
                            Remove
                          </button>
                        </div>
                      ))}
                      {formData.scheduleTimes.length === 0 ? (
                        <p className="text-xs text-slate-500">No dosing times set.</p>
                      ) : null}
                      <button
                        type="button"
                        onClick={addMedicationTime}
                        className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
                      >
                        Add time
                      </button>
                    </div>
                  </div>

                  {/* ── Start / End dates (unchanged) ── */}
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-slate-700">
                      Start Date
                    </label>
                    <input
                      type="date"
                      value={formData.startDate || ""}
                      onChange={(e) =>
                        setFormData((current) => ({ ...current, startDate: e.target.value }))
                      }
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-sky-500"
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-slate-700">
                      End Date
                    </label>
                    <input
                      type="date"
                      value={formData.endDate || ""}
                      onChange={(e) =>
                        setFormData((current) => ({ ...current, endDate: e.target.value }))
                      }
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-sky-500"
                    />
                  </div>

                  {/* ── Reminder settings (unchanged) ── */}
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-slate-700">
                      Reminder lead minutes
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={formData.reminderLeadMinutes}
                      onChange={(e) =>
                        setFormData((current) => ({
                          ...current,
                          reminderLeadMinutes: e.target.value,
                        }))
                      }
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-sky-500"
                    />
                  </div>
                  <label className="flex items-center gap-2 rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-700">
                    <input
                      type="checkbox"
                      checked={Boolean(formData.reminderEnabled)}
                      onChange={(e) =>
                        setFormData((current) => ({
                          ...current,
                          reminderEnabled: e.target.checked,
                        }))
                      }
                    />
                    Enable medication reminders
                  </label>

                  {/* ── Notes (unchanged) ── */}
                  <div className="md:col-span-2">
                    <label className="mb-1.5 block text-sm font-medium text-slate-700">
                      Notes
                    </label>
                    <textarea
                      value={formData.notes}
                      onChange={(e) =>
                        setFormData((current) => ({ ...current, notes: e.target.value }))
                      }
                      rows={3}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-sky-500"
                      placeholder="Additional instructions or reminders"
                    />
                  </div>
                </div>

                <div className="mt-6 flex gap-3 border-t border-slate-200 pt-6">
                  <button
                    type="button"
                    onClick={closeModal}
                    className="flex-1 rounded-lg border border-slate-300 px-4 py-2.5 font-medium text-slate-700 transition hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 rounded-lg bg-sky-600 px-4 py-2.5 font-medium text-white transition hover:bg-sky-700"
                  >
                    {editingMed ? "Update Medication" : "Add Medication"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
