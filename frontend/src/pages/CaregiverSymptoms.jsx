import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import Navbar from "../components/Navbar";
import { Activity, Plus, X, Check, HeartPulse, CalendarDays, Sparkles, ShieldCheck } from "lucide-react";
import {
  getCaregiverPatientSymptoms,
  caregiverLogSymptom,
  getMyPatients,
} from "../api/caregiver";
import {
  resolveActiveCaregiverPatientId,
  setActiveCaregiverPatientId,
} from "../utils/caregiverPatientContext";

const PRESET_SYMPTOMS = ["Headache", "Nausea", "Fever", "Fatigue", "Cough", "Dizziness"];

function getSeverityStyle(severity) {
  if (severity >= 7) return { border: "border-rose-400", badge: "bg-rose-100 text-rose-700", bar: "bg-rose-500", label: "High" };
  if (severity >= 4) return { border: "border-amber-400", badge: "bg-amber-100 text-amber-700", bar: "bg-amber-500", label: "Moderate" };
  return { border: "border-emerald-400", badge: "bg-emerald-100 text-emerald-700", bar: "bg-emerald-500", label: "Mild" };
}

function getLogSource(loggedBy) {
  const source = String(loggedBy || "").trim().toLowerCase();
  if (source === "caregiver") {
    return {
      label: "Caregiver-entered",
      tone: "bg-indigo-100 text-indigo-700 ring-1 ring-indigo-200",
    };
  }

  return {
    label: "Patient-entered",
    tone: "bg-slate-100 text-slate-700 ring-1 ring-slate-200",
  };
}

export default function CaregiverSymptoms() {
  const [searchParams] = useSearchParams();
  const [patients, setPatients] = useState([]);
  const [patientId, setPatientId] = useState(searchParams.get("patientId") || "");
  const [symptoms, setSymptoms] = useState([]);
  const [permission, setPermission] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [symptomName, setSymptomName] = useState("");
  const [customSymptom, setCustomSymptom] = useState("");
  const [severity, setSeverity] = useState(null);
  const [notes, setNotes] = useState("");
  const [error, setError] = useState(null);

  const todayLabel = useMemo(
    () =>
      new Date().toLocaleDateString(undefined, {
        weekday: "long",
        month: "long",
        day: "numeric",
      }),
    []
  );

  const averageSeverity =
    symptoms.length > 0
      ? (symptoms.reduce((sum, item) => sum + Number(item.severity || 0), 0) / symptoms.length).toFixed(1)
      : "-";

  const caregiverLoggedCount = symptoms.filter(
    (item) => String(item.loggedBy || "").toLowerCase() === "caregiver"
  ).length;

  const intenseCount = symptoms.filter((item) => Number(item.severity || 0) >= 7).length;

  useEffect(() => {
    getMyPatients().then((data) => {
      const pts = data.patients || [];
      setPatients(pts);

      const fromQuery = searchParams.get("patientId") || "";
      const resolvedId =
        fromQuery && pts.some((entry) => entry?.patient?.id === fromQuery)
          ? fromQuery
          : resolveActiveCaregiverPatientId(pts);

      setPatientId(resolvedId);
      setActiveCaregiverPatientId(resolvedId);
    });
  }, []);

  useEffect(() => {
    if (!patientId) return;
    const entry = patients.find((p) => p.patient.id === patientId);
    setPermission(entry?.permissions?.canViewSymptoms ?? false);
    loadSymptoms();
  }, [patientId, patients]);

  const loadSymptoms = () => {
    if (!patientId) return;
    setLoading(true);
    getCaregiverPatientSymptoms(patientId)
      .then((data) => setSymptoms(data.symptoms || []))
      .catch(() => setSymptoms([]))
      .finally(() => setLoading(false));
  };

  const handleSave = async () => {
    const name = symptomName === "__custom__" ? customSymptom.trim() : symptomName;
    if (!name) { setError("Please select or enter a symptom."); return; }
    if (severity === null) { setError("Please select severity."); return; }
    setError(null);
    try {
      await caregiverLogSymptom(patientId, name, severity, notes);
      setIsModalOpen(false);
      setSymptomName("");
      setCustomSymptom("");
      setSeverity(null);
      setNotes("");
      loadSymptoms();
    } catch (err) {
      setError(err.message || "Failed to log symptom.");
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-gradient-to-br from-cyan-50 via-white to-indigo-50">
      <div className="pointer-events-none absolute -left-20 -top-24 h-80 w-80 rounded-full bg-cyan-200/35 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-24 -right-20 h-96 w-96 rounded-full bg-indigo-200/35 blur-3xl" />
      <Navbar />
      <main className="relative mx-auto max-w-5xl px-6 pb-10 pt-28">
        <header className="mb-6 rounded-3xl border border-white/80 bg-white/75 p-6 shadow-sm backdrop-blur-sm">
          <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="inline-flex items-center gap-2 rounded-full bg-cyan-100 px-3 py-1 text-sm font-medium text-cyan-700">
                <ShieldCheck size={16} /> Caregiver symptom review
              </p>
              <h1 className="mt-3 text-4xl font-black text-slate-900">Observed Symptoms</h1>
              <p className="mt-1 text-slate-600">
                Review patient patterns and log caregiver observations with clear source labels.
              </p>
            </div>
            <div className="min-w-[220px] rounded-2xl border border-slate-100 bg-white/90 p-4">
              <p className="text-xs uppercase tracking-wide text-slate-500">Today</p>
              <p className="mt-1 flex items-center gap-2 font-semibold text-slate-800">
                <CalendarDays size={16} className="text-cyan-600" />
                {todayLabel}
              </p>
            </div>
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-3">
            {permission && (
              <button
                onClick={() => setIsModalOpen(true)}
                className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-b from-cyan-500 to-blue-500 px-5 py-2.5 text-sm font-semibold text-white shadow-md transition hover:scale-[1.02]"
              >
                <Plus size={16} /> Log Observation
              </button>
            )}
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
              {permission ? "Access granted for symptom review" : "Symptom access restricted"}
            </span>
          </div>
        </header>

        <div className="mb-6 grid grid-cols-1 gap-3 md:grid-cols-3">
          <div className="rounded-2xl border border-white/80 bg-white/85 p-4 shadow-sm">
            <p className="text-xs uppercase tracking-wide text-slate-500">Entries</p>
            <p className="mt-1 text-2xl font-bold text-slate-900">{symptoms.length}</p>
          </div>
          <div className="rounded-2xl border border-white/80 bg-white/85 p-4 shadow-sm">
            <p className="text-xs uppercase tracking-wide text-slate-500">Avg severity</p>
            <p className="mt-1 text-2xl font-bold text-slate-900">{averageSeverity}</p>
          </div>
          <div className="rounded-2xl border border-white/80 bg-white/85 p-4 shadow-sm">
            <p className="text-xs uppercase tracking-wide text-slate-500">Caregiver-entered</p>
            <p className="mt-1 text-2xl font-bold text-slate-900">{caregiverLoggedCount}</p>
          </div>
        </div>

        <div className="mb-6 rounded-2xl border border-cyan-100 bg-cyan-50/60 px-4 py-3 text-sm text-cyan-800">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="inline-flex items-center gap-2 font-medium">
              <Sparkles size={14} /> Symptom history for this patient with clear source attribution.
            </p>
            <span className="rounded-full bg-white/80 px-3 py-1 text-xs font-semibold text-cyan-700">
              High-severity entries: {intenseCount}
            </span>
          </div>
        </div>

        {patients.length > 1 && (
          <div className="mb-6">
            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Patient context</p>
            <div className="relative max-w-sm overflow-hidden rounded-full border border-slate-200 bg-white shadow-sm">
              <select
                value={patientId}
                onChange={(e) => {
                  const nextId = e.target.value;
                  setPatientId(nextId);
                  setActiveCaregiverPatientId(nextId);
                }}
                className="w-full appearance-none bg-transparent px-5 py-3 pr-12 text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-cyan-500"
              >
                {patients.map((e) => (
                  <option key={e.patient.id} value={e.patient.id}>
                    {e.patient.displayName || e.patient.email}
                  </option>
                ))}
              </select>
              <span className="pointer-events-none absolute inset-y-0 right-4 flex items-center text-slate-400">▾</span>
            </div>
          </div>
        )}

        {!permission && (
          <div className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
            You do not have permission to view symptoms for this patient.
          </div>
        )}

        {loading && (
          <div className="rounded-3xl border border-dashed border-cyan-200 bg-white/80 p-10 text-center text-sm text-slate-500">
            Loading symptom history...
          </div>
        )}

        {permission && !loading && symptoms.length === 0 && (
          <div className="rounded-3xl border border-dashed border-slate-200 bg-white/80 p-10 text-center">
            <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-cyan-100 text-cyan-700">
              <HeartPulse size={24} />
            </div>
            <p className="font-medium text-slate-700">No symptoms logged yet for this patient.</p>
            <p className="mt-1 text-sm text-slate-500">Once observations are recorded, they will appear in this timeline.</p>
          </div>
        )}

        <div className="flex flex-col gap-4">
          {permission && symptoms.map((s) => {
            const style = getSeverityStyle(s.severity ?? 0);
            const source = getLogSource(s.loggedBy);
            return (
              <div
                key={s.id}
                className={`rounded-2xl border-l-4 ${style.border} bg-white/90 p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm text-slate-400">
                      {new Date(s.loggedAt).toLocaleDateString(undefined, {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </p>
                    <p className="text-xl font-semibold text-slate-900">{s.name}</p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <span className={`rounded-full px-3 py-1 text-xs font-semibold ${style.badge}`}>
                      {style.label}
                    </span>
                    <span className={`rounded-full px-3 py-1 text-xs font-semibold ${source.tone}`}>
                      {source.label}
                    </span>
                  </div>
                </div>
                <div className="mt-3 flex items-center justify-between text-sm text-slate-600">
                  <span className="inline-flex items-center gap-1">
                    <Activity size={14} /> Severity
                  </span>
                  <span className="font-semibold text-slate-800">{s.severity} / 10</span>
                </div>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
                  <div
                    className={`h-full ${style.bar}`}
                    style={{ width: `${Math.max(0, Math.min(100, (s.severity ?? 0) * 10))}%` }}
                  />
                </div>
                {s.notes && (
                  <p className="mt-3 rounded-lg bg-slate-50 p-3 text-sm text-slate-600">
                    {s.notes}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </main>

      {/* log observation modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-lg">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xl font-semibold text-slate-900">Log Symptom Observation</h2>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X size={24} />
              </button>
            </div>

            <div className="mb-4">
              <p className="text-sm font-medium text-slate-700 mb-2">Choose symptom</p>
              <div className="flex flex-wrap gap-2">
                {PRESET_SYMPTOMS.map((s) => (
                  <button
                    key={s}
                    onClick={() => setSymptomName(s)}
                    className={`rounded-full px-4 py-2 text-sm transition ${
                      symptomName === s ? "bg-sky-500 text-white" : "bg-sky-50 text-sky-700 hover:bg-sky-100"
                    }`}
                  >
                    {s}
                  </button>
                ))}
                {/* custom symptom support */}
                <button
                  onClick={() => setSymptomName("__custom__")}
                  className={`rounded-full px-4 py-2 text-sm transition ${
                    symptomName === "__custom__" ? "bg-indigo-500 text-white" : "bg-indigo-50 text-indigo-700 hover:bg-indigo-100"
                  }`}
                >
                  Custom symptom
                </button>
              </div>
              {symptomName === "__custom__" && (
                <input
                  type="text"
                  value={customSymptom}
                  onChange={(e) => setCustomSymptom(e.target.value)}
                  placeholder="Type symptom name"
                  className="mt-3 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
              )}
            </div>

            <div className="mb-4">
              <p className="text-sm font-medium text-slate-700 mb-2">Rate severity (1–10)</p>
              <div className="flex flex-wrap gap-2">
                {[...Array(10).keys()].map((i) => {
                  const level = i + 1;
                  return (
                    <button
                      key={level}
                      onClick={() => setSeverity(level)}
                      className={`rounded-full px-3 py-1 text-sm transition ${
                        severity === level ? "bg-orange-500 text-white" : "bg-orange-50 text-orange-700 hover:bg-orange-100"
                      }`}
                    >
                      {level}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="mb-4">
              <p className="text-sm font-medium text-slate-700 mb-2">Notes (optional)</p>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                placeholder="Describe the observation..."
                className="w-full rounded-xl bg-slate-100 p-3 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
              />
            </div>

            {error && <p className="mb-3 text-sm text-red-600">{error}</p>}

            <div className="flex gap-3">
              <button
                onClick={() => setIsModalOpen(false)}
                className="flex-1 rounded-xl border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-sky-500 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-600"
              >
                <Check size={16} /> Save Observation
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}