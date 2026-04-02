import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import Navbar from "../components/Navbar";
import { Pill } from "lucide-react";
import {
  getCaregiverPatientMedications,
  logMedicationSupportAction,
  getMedicationAdherenceHistory,
  getMyPatients,
} from "../api/caregiver";

const SUPPORT_ACTIONS = ["assisted", "missed", "refused"];

function ActionBadge({ action }) {
  const styles = {
    assisted: "bg-emerald-100 text-emerald-700",
    missed: "bg-amber-100 text-amber-700",
    refused: "bg-red-100 text-red-700",
  };
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${styles[action] ?? "bg-slate-100 text-slate-600"}`}>
      {action}
    </span>
  );
}

export default function CaregiverMedications() {
  const [searchParams] = useSearchParams();
  const [patients, setPatients] = useState([]);
  const [patientId, setPatientId] = useState(searchParams.get("patientId") || "");
  const [medications, setMedications] = useState([]);
  const [permission, setPermission] = useState(false);
  const [loading, setLoading] = useState(false);
  const [actionNote, setActionNote] = useState({});
  const [message, setMessage] = useState(null);
  const [historyMap, setHistoryMap] = useState({});

  useEffect(() => {
    getMyPatients().then((data) => {
      const pts = data.patients || [];
      setPatients(pts);
      if (!patientId && pts.length > 0) {
        setPatientId(pts[0].patient.id);
      }
      if (patientId) {
        const entry = pts.find((p) => p.patient.id === patientId);
        setPermission(entry?.permissions?.canViewMedications ?? false);
      }
    });
  }, []);

  useEffect(() => {
    if (!patientId) return;
    setLoading(true);
    const entry = patients.find((p) => p.patient.id === patientId);
    setPermission(entry?.permissions?.canViewMedications ?? false);

    getCaregiverPatientMedications(patientId)
      .then((data) => setMedications(data.medications || []))
      .catch(() => setMedications([]))
      .finally(() => setLoading(false));
  }, [patientId]);

  const handleSupportAction = async (medicationId, action) => {
    try {
      const note = actionNote[medicationId] || "";
      await logMedicationSupportAction(medicationId, action, note);
      setMessage(`Logged: ${action}`);
      const hist = await getMedicationAdherenceHistory(medicationId);
      setHistoryMap((prev) => ({
        ...prev,
        [medicationId]: hist.adherenceHistory || [],
      }));
      setActionNote((prev) => ({ ...prev, [medicationId]: "" }));
    } catch (err) {
      setMessage(err.message || "Failed to log action.");
    }
  };

  const loadHistory = async (medicationId) => {
    if (historyMap[medicationId]) return;
    const hist = await getMedicationAdherenceHistory(medicationId).catch(() => ({ adherenceHistory: [] }));
    setHistoryMap((prev) => ({ ...prev, [medicationId]: hist.adherenceHistory || [] }));
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-sky-50 via-white to-indigo-50">
      <Navbar />
      <main className="mx-auto max-w-4xl px-6 pt-28 pb-10">
        <div className="flex items-center gap-3 mb-1">
          <Pill className="text-sky-500" size={24} />
          <h1 className="text-3xl font-bold text-slate-800">Medications</h1>
        </div>

        {/*explain viewing vs assisting mode */}
        <p className="text-slate-500 mb-6">
          {permission
            ? "You can view and log medication support actions for this patient."
            : "You are in view-only mode. Medication support actions require patient permission."}
        </p>

        {/* Patient selector */}
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

        {message && (
          <div className="mb-4 rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-700">
            {message}
          </div>
        )}

        {!permission && (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700 mb-6">
            You do not have permission to view medications for this patient.
          </div>
        )}

        {loading && <p className="text-slate-400 text-sm">Loading medications...</p>}

        {permission && !loading && medications.length === 0 && (
          <div className="rounded-3xl border border-dashed border-slate-200 p-10 text-center text-slate-400 text-sm">
            No medications found for this patient.
          </div>
        )}

        {permission && medications.map((med) => (
          <div key={med.id} className="rounded-3xl border border-slate-200 bg-white p-6 mb-4 shadow-sm">
            <div className="flex items-start justify-between gap-4 mb-3">
              <div>
                <h3 className="text-lg font-semibold text-slate-800">{med.name}</h3>
                <p className="text-sm text-slate-500">
                  {med.dosage} · {med.frequency}
                  {med.prescribedBy ? ` · Prescribed by ${med.prescribedBy}` : ""}
                </p>
                {med.notes && (
                  <p className="text-sm text-slate-400 mt-1">{med.notes}</p>
                )}
              </div>
            </div>

            {/*support actions: assisted, missed, refused */}
            <div className="border-t border-slate-100 pt-4">
              <p className="text-xs font-medium text-slate-500 mb-2">
                Log support action:
              </p>
              <div className="flex flex-wrap gap-2 mb-2">
                {SUPPORT_ACTIONS.map((action) => (
                  <button
                    key={action}
                    onClick={() => handleSupportAction(med.id, action)}
                    className="rounded-xl border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition capitalize"
                  >
                    {action}
                  </button>
                ))}
              </div>
              <input
                type="text"
                placeholder="Optional note for this action..."
                value={actionNote[med.id] || ""}
                onChange={(e) =>
                  setActionNote((prev) => ({ ...prev, [med.id]: e.target.value }))
                }
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-sky-500"
              />
            </div>

            {/* Adherence history */}
            <div className="mt-3">
              <button
                onClick={() => loadHistory(med.id)}
                className="text-xs text-sky-600 hover:underline"
              >
                {historyMap[med.id] ? "History loaded" : "View support history"}
              </button>
              {historyMap[med.id] && historyMap[med.id].length > 0 && (
                <div className="mt-2 space-y-1">
                  {historyMap[med.id].slice(-3).reverse().map((h, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs text-slate-500">
                      <ActionBadge action={h.action} />
                      {/*  always show loggedBy */}
                      <span>by {h.loggedBy}</span>
                      <span>·</span>
                      <span>{new Date(h.loggedAt).toLocaleDateString()}</span>
                      {h.note && <span>· {h.note}</span>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
      </main>
    </div>
  );
}