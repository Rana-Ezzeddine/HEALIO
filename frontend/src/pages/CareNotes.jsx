
import { useEffect, useState } from "react";
import Navbar from "../components/Navbar";
import { apiUrl, authHeaders } from "../api/http";

export default function CareNotes() {
  const [notes, setNotes] = useState([]);
  const [newNote, setNewNote] = useState("");
  const [patientId, setPatientId] = useState("");
  const [patients, setPatients] = useState([]);
  const [message, setMessage] = useState(null);

  useEffect(() => {
    // Get linked patients first
    fetch(`${apiUrl}/api/caregiver/patients`, { headers: { ...authHeaders() } })
      .then((r) => r.json())
      .then((data) => {
        const pts = data.patients || [];
        setPatients(pts);
        if (pts.length > 0) setPatientId(pts[0].patient.id);
      });
  }, []);

  useEffect(() => {
    if (!patientId) return;
    fetch(`${apiUrl}/api/caregiver-notes/${patientId}`, {
      headers: { ...authHeaders() },
    })
      .then((r) => r.json())
      .then((data) => setNotes(data.notes || []));
  }, [patientId]);

  const handleAdd = async () => {
    if (!newNote.trim() || !patientId) return;
    const res = await fetch(`${apiUrl}/api/caregiver-notes`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify({ patientId, note: newNote.trim() }),
    });
    if (res.ok) {
      setNewNote("");
      setMessage("Care note saved.");
      const updated = await fetch(`${apiUrl}/api/caregiver-notes/${patientId}`, {
        headers: { ...authHeaders() },
      }).then((r) => r.json());
      setNotes(updated.notes || []);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />
      <main className="pt-28 max-w-2xl mx-auto px-6 py-8">
        <h1 className="text-3xl font-bold text-slate-800 mb-1">Care Notes</h1>
        <p className="text-slate-500 mb-8">
          Record practical observations — poor sleep, low appetite, refusal,
          confusion, or mobility issues. These are caregiver notes, separate
          from doctor notes.
        </p>

        {patients.length > 1 && (
          <select
            value={patientId}
            onChange={(e) => setPatientId(e.target.value)}
            className="mb-4 border border-slate-200 rounded-xl px-4 py-2 text-sm"
          >
            {patients.map((e) => (
              <option key={e.patient.id} value={e.patient.id}>
                {e.patient.email}
              </option>
            ))}
          </select>
        )}

        {message && (
          <p className="mb-4 text-sm text-sky-600">{message}</p>
        )}

        <div className="bg-white rounded-3xl shadow p-6 mb-6">
          <textarea
            placeholder="Write a care note..."
            value={newNote}
            onChange={(e) => setNewNote(e.target.value)}
            rows={3}
            className="w-full border border-slate-200 rounded-xl px-4 py-2 text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-sky-400 resize-none"
          />
          <button
            onClick={handleAdd}
            className="rounded-xl bg-sky-500 px-6 py-2 text-sm font-semibold text-white hover:bg-sky-600 transition"
          >
            Add Note
          </button>
        </div>

        <div className="space-y-3">
          {notes.map((n) => (
            <div key={n.id} className="bg-white rounded-2xl shadow p-4">
              <p className="text-sm text-slate-700">{n.note || n.content}</p>
              <p className="text-xs text-slate-400 mt-2">
                Caregiver note · {new Date(n.createdAt).toLocaleDateString()}
              </p>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}