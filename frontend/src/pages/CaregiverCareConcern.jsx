import { useEffect, useState } from "react";
import Navbar from "../components/Navbar";
import { sendCareConcern, getMyPatients } from "../api/caregiver";

export default function CaregiverCareConcern() {
  const [patients, setPatients] = useState([]);
  const [patientId, setPatientId] = useState("");
  const [permission, setPermission] = useState(false);
  const [concern, setConcern] = useState("");
  const [context, setContext] = useState("");
  const [message, setMessage] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    getMyPatients().then((data) => {
      const pts = data.patients || [];
      setPatients(pts);
      if (pts.length > 0) {
        setPatientId(pts[0].patient.id);
        setPermission(pts[0].permissions?.canMessageDoctor ?? false);
      }
    });
  }, []);

  const handlePatientChange = (id) => {
    setPatientId(id);
    const entry = patients.find((p) => p.patient.id === id);
    setPermission(entry?.permissions?.canMessageDoctor ?? false);
  };

  const handleSend = async () => {
    if (!concern.trim()) { setMessage("Please enter your concern."); return; }
    setLoading(true);
    try {
      await sendCareConcern(patientId, concern.trim(), context.trim());
      setMessage("Your care concern has been sent to the doctor.");
      setConcern("");
      setContext("");
    } catch (err) {
      setMessage(err.message || "Failed to send care concern.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-sky-50 via-white to-indigo-50">
      <Navbar />
      <main className="mx-auto max-w-2xl px-6 pt-28 pb-10">
        <h1 className="text-3xl font-bold text-slate-800 mb-1">Care Concerns</h1>
        {/* 6.11.c — contextual, tied to patient and permissions */}
        <p className="text-slate-500 mb-8">
          Send a structured care concern to the patient's doctor. This is
          tied to the patient's record and sent only when the patient has
          granted you messaging permission.
        </p>

        {patients.length > 1 && (
          <select
            value={patientId}
            onChange={(e) => handlePatientChange(e.target.value)}
            className="mb-6 rounded-xl border border-slate-300 px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
          >
            {patients.map((e) => (
              <option key={e.patient.id} value={e.patient.id}>
                {e.patient.email}
              </option>
            ))}
          </select>
        )}

        {/* non-clinical guardrails */}
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700 mb-6">
          <strong>Remember:</strong> Care concerns are for practical observations
          only. Do not attempt to diagnose, prescribe, or recommend treatment
          changes. The doctor will review your concern and respond.
        </div>

        {/* canMessageDoctor — exact permission field */}
        {!permission && (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 mb-6">
            You do not have permission to message this patient's doctor. Ask
            the patient to grant messaging permission from their Care Team settings.
          </div>
        )}

        {message && (
          <div className="mb-4 rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-700">
            {message}
          </div>
        )}

        {permission && (
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="mb-4">
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Your concern
              </label>
              <textarea
                value={concern}
                onChange={(e) => setConcern(e.target.value)}
                rows={4}
                placeholder="Describe your care concern clearly and factually..."
                className="w-full rounded-xl border border-slate-300 px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 resize-none"
              />
            </div>
            <div className="mb-6">
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Context (optional)
              </label>
              <input
                type="text"
                value={context}
                onChange={(e) => setContext(e.target.value)}
                placeholder="e.g. Related to medication, symptom name, appointment..."
                className="w-full rounded-xl border border-slate-300 px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
              />
            </div>
            <button
              onClick={handleSend}
              disabled={loading || !concern.trim()}
              className="w-full rounded-xl bg-sky-500 py-2 text-sm font-semibold text-white hover:bg-sky-600 transition disabled:opacity-40"
            >
              {loading ? "Sending..." : "Send Care Concern to Doctor"}
            </button>
          </div>
        )}
      </main>
    </div>
  );
}