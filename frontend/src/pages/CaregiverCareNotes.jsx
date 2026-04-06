import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "../components/Navbar";
import { apiUrl, authHeaders } from "../api/http";
import {
  createCaregiverNote,
  getCaregiverNotesForPatient,
  updateCaregiverNote,
} from "../api/caregiverNotes";
import {
  resolveActiveCaregiverPatientId,
  setActiveCaregiverPatientId,
} from "../utils/caregiverPatientContext";

function patientLabel(record) {
  return record?.patient?.displayName || record?.patient?.email || "Patient";
}

function formatTimestamp(dateLike) {
  if (!dateLike) return "";
  return new Date(dateLike).toLocaleString([], {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function CaregiverCareNotes() {
  const navigate = useNavigate();

  const [linkedPatients, setLinkedPatients] = useState([]);
  const [activePatientId, setActivePatientId] = useState("");
  const [notes, setNotes] = useState([]);
  const [newNote, setNewNote] = useState("");
  const [editingId, setEditingId] = useState("");
  const [editingValue, setEditingValue] = useState("");
  const [loading, setLoading] = useState(true);
  const [notesLoading, setNotesLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [formError, setFormError] = useState("");
  const [success, setSuccess] = useState("");

  async function loadNotes(patientId) {
    if (!patientId) {
      setNotes([]);
      return;
    }

    setNotesLoading(true);
    setError("");
    try {
      const data = await getCaregiverNotesForPatient(patientId);
      setNotes(data.notes || []);
    } catch (err) {
      setError(err.message || "Failed to load care notes.");
      setNotes([]);
    } finally {
      setNotesLoading(false);
    }
  }

  useEffect(() => {
    let cancelled = false;

    async function loadPageData() {
      setLoading(true);
      setError("");
      try {
        const patientsRes = await fetch(`${apiUrl}/api/caregivers/patients`, {
          headers: { "Content-Type": "application/json", ...authHeaders() },
        }).then(async (res) => {
          const data = await res.json().catch(() => ({}));
          if (!res.ok) throw new Error(data.message || "Failed to load linked patients.");
          return data;
        });

        if (cancelled) return;

        const patients = patientsRes.patients || [];
        const resolvedId = resolveActiveCaregiverPatientId(patients);

        setLinkedPatients(patients);
        setActivePatientId(resolvedId);

        if (resolvedId) {
          await loadNotes(resolvedId);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err.message || "Failed to load caregiver care notes.");
          setLinkedPatients([]);
          setActivePatientId("");
          setNotes([]);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadPageData();
    return () => {
      cancelled = true;
    };
  }, []);

  const latestUpdate = useMemo(() => {
    if (notes.length === 0) return "No notes yet";
    return formatTimestamp(notes[0]?.updatedAt || notes[0]?.createdAt);
  }, [notes]);

  async function handlePatientChange(nextId) {
    setSuccess("");
    setFormError("");
    setActivePatientId(nextId);
    setActiveCaregiverPatientId(nextId);
    setEditingId("");
    setEditingValue("");
    await loadNotes(nextId);
  }

  async function handleCreateNote(event) {
    event.preventDefault();
    setFormError("");
    setSuccess("");

    const trimmed = newNote.trim();
    if (!activePatientId) {
      setFormError("Choose a patient before adding a note.");
      return;
    }
    if (!trimmed) {
      setFormError("Write a note before saving.");
      return;
    }

    setSaving(true);
    try {
      await createCaregiverNote({ patientId: activePatientId, note: trimmed });
      setNewNote("");
      setSuccess("Care note saved.");
      await loadNotes(activePatientId);
    } catch (err) {
      setFormError(err.message || "Failed to create note.");
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveEdit(noteId) {
    const trimmed = editingValue.trim();
    if (!trimmed) {
      setFormError("Note cannot be empty.");
      return;
    }

    setSaving(true);
    setFormError("");
    setSuccess("");
    try {
      await updateCaregiverNote(noteId, trimmed);
      setEditingId("");
      setEditingValue("");
      setSuccess("Care note updated.");
      await loadNotes(activePatientId);
    } catch (err) {
      setFormError(err.message || "Failed to update note.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />

      <main className="mx-auto max-w-6xl px-6 pb-10 pt-28">
        <section className="rounded-[2rem] bg-gradient-to-r from-slate-900 via-teal-800 to-emerald-600 p-8 text-white shadow-xl">
          <p className="text-sm font-semibold uppercase tracking-[0.25em] text-white/75">Caregiver Care Notes</p>
          <h1 className="mt-3 text-4xl font-black">Patient Support Journal</h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-white/85">
            Capture observations, reminders, and follow-ups for your active patient context.
          </p>

          <div className="mt-5 max-w-sm">
            <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-white/70">
              Active patient context
            </label>
            <select
              value={activePatientId}
              onChange={(event) => handlePatientChange(event.target.value)}
              className="w-full rounded-xl border border-white/30 bg-white/95 px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-300"
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

        {error ? (
          <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        ) : null}

        {formError ? (
          <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {formError}
          </div>
        ) : null}
        {success ? (
          <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            {success}
          </div>
        ) : null}

        {loading ? (
          <section className="mt-6 rounded-3xl border border-slate-200 bg-white p-8 text-sm text-slate-500 shadow-sm">
            Loading care notes...
          </section>
        ) : linkedPatients.length === 0 ? (
          <section className="mt-6 rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
            <h2 className="text-xl font-semibold text-slate-900">No linked patients yet</h2>
            <p className="mt-2 text-sm text-slate-600">
              Accept an invitation first to create and view care notes.
            </p>
            <button
              type="button"
              onClick={() => navigate("/caregiver-patients")}
              className="mt-5 rounded-2xl bg-emerald-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-600"
            >
              Open patient invitations
            </button>
          </section>
        ) : (
          <>
            <section className="mt-6 grid gap-4 sm:grid-cols-2">
              <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Total notes</p>
                <p className="mt-2 text-3xl font-black text-slate-900">{notes.length}</p>
                <p className="mt-1 text-sm text-slate-500">For active patient</p>
              </div>
              <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Latest update</p>
                <p className="mt-2 text-base font-bold text-slate-900">{latestUpdate}</p>
                <p className="mt-1 text-sm text-slate-500">Most recent edit time</p>
              </div>
            </section>

            <section className="mt-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-xl font-semibold text-slate-900">Add care note</h2>
              <p className="mt-1 text-sm text-slate-500">
                Keep notes objective and focused on support tasks.
              </p>

              <form onSubmit={handleCreateNote} className="mt-4 space-y-3">
                <textarea
                  rows={4}
                  value={newNote}
                  onChange={(event) => setNewNote(event.target.value)}
                  placeholder="Example: Patient reported mild dizziness after afternoon medication. Reminded hydration and flagged for next doctor visit."
                  className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-400"
                />
                <div className="flex items-center justify-between gap-3">
                  <p className="text-xs text-slate-500">{newNote.trim().length} characters</p>
                  <button
                    type="submit"
                    disabled={saving || !activePatientId}
                    className="rounded-2xl bg-emerald-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-65"
                  >
                    {saving ? "Saving..." : "Save note"}
                  </button>
                </div>
              </form>
            </section>

            <section className="mt-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-xl font-semibold text-slate-900">Care note history</h2>
              <p className="mt-1 text-sm text-slate-500">Newest notes appear first.</p>

              <div className="mt-4 space-y-3">
                {notesLoading ? (
                  <p className="text-sm text-slate-500">Loading notes...</p>
                ) : notes.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-slate-200 px-6 py-8 text-center text-sm text-slate-500">
                    No notes yet for this patient.
                  </div>
                ) : (
                  notes.map((note) => {
                    const isEditing = editingId === note.id;

                    return (
                      <article key={note.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                        <div className="flex items-center justify-between gap-3">
                          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                            Updated {formatTimestamp(note.updatedAt || note.createdAt)}
                          </p>
                          {!isEditing ? (
                            <button
                              type="button"
                              onClick={() => {
                                setEditingId(note.id);
                                setEditingValue(note.note || "");
                                setFormError("");
                                setSuccess("");
                              }}
                              className="rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-100"
                            >
                              Edit
                            </button>
                          ) : null}
                        </div>

                        {isEditing ? (
                          <div className="mt-3 space-y-3">
                            <textarea
                              rows={4}
                              value={editingValue}
                              onChange={(event) => setEditingValue(event.target.value)}
                              className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-400"
                            />
                            <div className="flex gap-2">
                              <button
                                type="button"
                                onClick={() => handleSaveEdit(note.id)}
                                disabled={saving}
                                className="rounded-xl bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-65"
                              >
                                {saving ? "Saving..." : "Save changes"}
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingId("");
                                  setEditingValue("");
                                }}
                                disabled={saving}
                                className="rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-65"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        ) : (
                          <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-700">{note.note}</p>
                        )}
                      </article>
                    );
                  })
                )}
              </div>
            </section>
          </>
        )}
      </main>
    </div>
  );
}
