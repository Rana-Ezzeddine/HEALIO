import { useEffect, useState } from "react";
import Navbar from "../components/Navbar";
import { createCareNote, getCareNotes, updateCareNote, getMyPatients } from "../api/caregiver";

const NOTE_TEMPLATES = [
  "Poor sleep last night",
  "Low appetite today",
  "Refused medication",
  "Appeared confused",
  "Mobility issues observed",
  "Good energy today",
  "Complained of pain",
  "Mood seems low",
];

export default function CareNotes() {
  const [patients, setPatients] = useState([]);
  const [patientId, setPatientId] = useState("");
  const [notes, setNotes] = useState([]);
  const [newNote, setNewNote] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [editText, setEditText] = useState("");
  const [message, setMessage] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    getMyPatients().then((data) => {
      const pts = data.patients || [];
      setPatients(pts);
      if (pts.length > 0) setPatientId(pts[0].patient.id);
    });
  }, []);

  useEffect(() => {
    if (!patientId) return;
    setLoading(true);
    getCareNotes(patientId)
      .then((data) => setNotes(data.notes || []))
      .catch(() => setNotes([]))
      .finally(() => setLoading(false));
  }, [patientId]);

  const handleAdd = async () => {
    if (!newNote.trim() || !patientId) return;
    try {
      await createCareNote(patientId, newNote.trim());
      setNewNote("");
      setMessage("Care note saved.");
      const data = await getCareNotes(patientId);
      setNotes(data.notes || []);
    } catch (err) {
      setMessage(err.message || "Failed to save note.");
    }
  };

  const handleUpdate = async (id) => {
    if (!editText.trim()) return;
    try {
      await updateCareNote(id, editText.trim());
      setEditingId(null);
      setEditText("");
      const data = await getCareNotes(patientId);
      setNotes(data.notes || []);
    } catch (err) {
      setMessage(err.message || "Failed to update note.");
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-sky-50 via-white to-indigo-50">
      <Navbar />
      <main className="mx-auto max-w-2xl px-6 pt-28 pb-10">
        <h1 className="text-3xl font-bold text-slate-800 mb-1">Care Notes</h1>
        {/* caregiver notes are distinct from doctor notes */}
        <p className="text-slate-500 mb-8">
          Record practical observations about the patient's day. These are
          caregiver notes — they are separate from doctor notes and clearly
          labeled as caregiver entries.
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

        {/* Add note */}
        <div className="rounded-3xl border border-slate-200 bg-white p-6 mb-6 shadow-sm">
          {/* practical note templates */}
          <p className="text-sm font-medium text-slate-700 mb-2">Quick templates:</p>
          <div className="flex flex-wrap gap-2 mb-4">
            {NOTE_TEMPLATES.map((t) => (
              <button
                key={t}
                onClick={() => setNewNote(t)}
                className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-600 hover:bg-sky-100 hover:text-sky-700 transition"
              >
                {t}
              </button>
            ))}
          </div>
          <textarea
            placeholder="Write a care note..."
            value={newNote}
            onChange={(e) => setNewNote(e.target.value)}
            rows={3}
            className="w-full rounded-xl border border-slate-200 px-4 py-2 text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-sky-500 resize-none"
          />
          <button
            onClick={handleAdd}
            disabled={!newNote.trim() || !patientId}
            className="rounded-xl bg-sky-500 px-6 py-2 text-sm font-semibold text-white hover:bg-sky-600 transition disabled:opacity-40"
          >
            Add Note
          </button>
        </div>

        {/* Notes list */}
        {loading && <p className="text-slate-400 text-sm">Loading notes...</p>}
        {!loading && notes.length === 0 && (
          <div className="rounded-3xl border border-dashed border-slate-200 p-8 text-center text-slate-400 text-sm">
            No care notes yet. Add one above.
          </div>
        )}
        <div className="space-y-3">
          {notes.map((n) => (
            <div key={n.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              {editingId === n.id ? (
                <div>
                  <textarea
                    value={editText}
                    onChange={(e) => setEditText(e.target.value)}
                    rows={2}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm mb-2 focus:outline-none focus:ring-2 focus:ring-sky-500"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleUpdate(n.id)}
                      className="rounded-xl bg-sky-500 px-4 py-1.5 text-xs font-semibold text-white hover:bg-sky-600"
                    >
                      Save
                    </button>
                    <button
                      onClick={() => setEditingId(null)}
                      className="rounded-xl border border-slate-300 px-4 py-1.5 text-xs text-slate-600 hover:bg-slate-50"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-start justify-between gap-3">
                  <div>
                    {/* CaregiverNote.note — exact field */}
                    <p className="text-sm text-slate-700">{n.note}</p>
                    {/* labeled as caregiver note */}
                    <p className="text-xs text-slate-400 mt-1">
                      Caregiver note · {new Date(n.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  <button
                    onClick={() => { setEditingId(n.id); setEditText(n.note); }}
                    className="text-xs text-sky-600 hover:underline whitespace-nowrap"
                  >
                    Edit
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}