import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import Navbar from "../components/Navbar";
import { Activity, Plus, X, Check } from "lucide-react";
import {
  getCaregiverPatientSymptoms,
  caregiverLogSymptom,
  getMyPatients,
} from "../api/caregiver";

const PRESET_SYMPTOMS = ["Headache", "Nausea", "Fever", "Fatigue", "Cough", "Dizziness"];

function getSeverityStyle(severity) {
  if (severity >= 7) return { border: "border-rose-400", badge: "bg-rose-100 text-rose-700", bar: "bg-rose-500", label: "High" };
  if (severity >= 4) return { border: "border-amber-400", badge: "bg-amber-100 text-amber-700", bar: "bg-amber-500", label: "Moderate" };
  return { border: "border-emerald-400", badge: "bg-emerald-100 text-emerald-700", bar: "bg-emerald-500", label: "Mild" };
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

  useEffect(() => {
    getMyPatients().then((data) => {
      const pts = data.patients || [];
      setPatients(pts);
      if (!patientId && pts.length > 0) setPatientId(pts[0].patient.id);
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
    <div className="min-h-screen bg-gradient-to-br from-sky-50 via-white to-indigo-50">
      <Navbar />
      <main className="mx-auto max-w-4xl px-6 pt-28 pb-10">
        <div className="flex items-center justify-between mb-1">
          <h1 className="text-3xl font-bold text-slate-800">Symptoms</h1>
          {permission && (
            <button
              onClick={() => setIsModalOpen(true)}
              className="inline-flex items-center gap-2 rounded-2xl bg-sky-500 px-5 py-2 text-sm font-semibold text-white hover:bg-sky-600 transition"
            >
              <Plus size={16} /> Log Observation
            </button>
          )}
        </div>

        {/*explain who logged each symptom */}
        <p className="text-slate-500 mb-6">
          Symptom history for this patient. Each entry shows who logged it —
          patient or caregiver.
        </p>

        {patients.length > 1 && (
          <select
            value={patientId}
            onChange={(e) => setPatientId(e.target.value)}
            className="mb-6 rounded-xl border border-slate-300 px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
          >
            {patients.map((e) => (
              <option key={e.patient.id} value={e.patient.id}>
                {e.patient.email}
              </option>
            ))}
          </select>
        )}

        {!permission && (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700 mb-6">
            You do not have permission to view symptoms for this patient.
          </div>
        )}

        {loading && <p className="text-slate-400 text-sm">Loading symptoms...</p>}

        {permission && !loading && symptoms.length === 0 && (
          <div className="rounded-3xl border border-dashed border-slate-200 p-10 text-center text-slate-400 text-sm">
            No symptoms logged yet for this patient.
          </div>
        )}

        <div className="flex flex-col gap-4">
          {permission && symptoms.map((s) => {
            const style = getSeverityStyle(s.severity ?? 0);
            return (
              <div
                key={s.id}
                className={`rounded-2xl border-l-4 ${style.border} bg-white p-5 shadow-sm`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm text-slate-400">
                      {new Date(s.loggedAt).toLocaleDateString()}
                    </p>
                    <p className="text-lg font-semibold text-slate-900">{s.name}</p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <span className={`rounded-full px-3 py-1 text-xs font-semibold ${style.badge}`}>
                      {style.label}
                    </span>
                    {/* show who logged */}
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      s.loggedBy === "caregiver"
                        ? "bg-indigo-100 text-indigo-700"
                        : "bg-slate-100 text-slate-600"
                    }`}>
                      Logged by {s.loggedBy === "caregiver" ? "caregiver" : "patient"}
                    </span>
                  </div>
                </div>
                <div className="mt-3 flex items-center justify-between text-sm text-slate-600">
                  <span className="inline-flex items-center gap-1">
                    <Activity size={14} /> Severity
                  </span>
                  <span className="font-semibold">{s.severity} / 10</span>
                </div>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
                  <div
                    className={`h-full ${style.bar}`}
                    style={{ width: `${(s.severity ?? 0) * 10}%` }}
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