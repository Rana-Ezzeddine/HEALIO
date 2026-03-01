import React, { useEffect, useMemo, useState } from 'react';
import Navbar from "../components/Navbar";
import { X, Check, Sparkles, Activity, CalendarDays, Plus, HeartPulse } from 'lucide-react';
import { apiUrl, authHeaders } from "../api/http";

export default function Symptoms() {
  const [logs, setLogs] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [error, setError] = useState("");

  const [currentSymptom, setCurrentSymptom] = useState(null);
  const [currentSeverity, setCurrentSeverity] = useState(null);
  const [currentNotes, setCurrentNotes] = useState("");

  const symptomsList = [
    "Headache",
    "Nausea",
    "Fever",
    "Fatigue",
    "Cough",
    "Dizziness",
  ];

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
    logs.length > 0
      ? (logs.reduce((sum, log) => sum + (log.severity ?? 0), 0) / logs.length).toFixed(1)
      : null;

  const intenseDays = logs.filter((log) => (log.severity ?? 0) >= 7).length;

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${apiUrl}/api/symptoms`, {
          headers: { "Content-Type": "application/json", ...authHeaders() },
        });

        const data = await res.json().catch(() => ([]));
        if (!res.ok) {
          setError(data?.message || "Failed to load symptoms.");
          return;
        }

        const normalized = Array.isArray(data)
          ? data.map((item) => ({
              id: item.id,
              date: item.loggedAt,
              symptom: item.name,
              severity: item.severity,
              notes: item.notes,
            }))
          : [];
        setLogs(normalized);
      } catch (err) {
        setError("Failed to load symptoms.");
      }
    })();
  }, []);

  async function handleSave() {
    if (!currentSymptom) {
      alert("Please select symptom.");
      return;
    }
    if (currentSeverity === null) {
      alert("Please select severity.");
      return;
    }

    try {
      const payload = {
        symptom: currentSymptom,
        severity: currentSeverity,
        notes: currentNotes,
      };

      const res = await fetch(`${apiUrl}/api/symptoms`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify(payload),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(data?.message || "Failed to save symptom.");
        return;
      }

      const newLog = {
        id: data.id,
        date: data.loggedAt,
        symptom: data.name,
        severity: data.severity,
        notes: data.notes,
      };
      setLogs([newLog, ...logs]);
      setError("");
    } catch (err) {
      alert("Failed to save symptom.");
      return;
    }

    // reset modal
    setCurrentSymptom(null);
    setCurrentSeverity(null);
    setCurrentNotes("");
    setIsModalOpen(false);
  }

  function openModal() {
    setIsModalOpen(true);
  }

  function closeModal() {
    setIsModalOpen(false);
  }

  function getSeverityStyle(severity) {
    if (severity >= 7) {
      return {
        border: "border-rose-400",
        badge: "bg-rose-100 text-rose-700",
        bar: "bg-rose-500",
        label: "High",
      };
    }

    if (severity >= 4) {
      return {
        border: "border-amber-400",
        badge: "bg-amber-100 text-amber-700",
        bar: "bg-amber-500",
        label: "Moderate",
      };
    }

    return {
      border: "border-emerald-400",
      badge: "bg-emerald-100 text-emerald-700",
      bar: "bg-emerald-500",
      label: "Mild",
    };
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-gradient-to-br from-sky-50 via-indigo-50 to-cyan-50 p-6">
      <div className="pointer-events-none absolute -top-24 -left-16 h-72 w-72 rounded-full bg-sky-200/35 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-24 -right-16 h-80 w-80 rounded-full bg-indigo-200/35 blur-3xl" />
      <Navbar />

      <div className="relative pt-24 max-w-4xl mx-auto">
        <header className="mb-8 rounded-3xl border border-white/80 bg-white/75 p-6 backdrop-blur-sm shadow-sm">
          <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="inline-flex items-center gap-2 rounded-full bg-sky-100 px-3 py-1 text-sm font-medium text-sky-700">
                <Sparkles size={16} /> Daily wellness tracker
              </p>
              <h1 className="mt-3 text-4xl text-slate-900 font-black">Health Log</h1>
              <p className="text-slate-600 mt-1">Capture symptoms, track trends, and stay ahead of your health.</p>
            </div>
            <div className="rounded-2xl bg-white/90 border border-slate-100 p-4 min-w-[220px]">
              <p className="text-xs uppercase tracking-wide text-slate-500">Today</p>
              <p className="mt-1 flex items-center gap-2 text-slate-800 font-semibold">
                <CalendarDays size={16} className="text-sky-600" />
                {todayLabel}
              </p>
            </div>
          </div>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-6">
          <div className="rounded-2xl bg-white/85 border border-white/80 p-4 shadow-sm">
            <p className="text-xs uppercase tracking-wide text-slate-500">Entries</p>
            <p className="mt-1 text-2xl font-bold text-slate-900">{logs.length}</p>
          </div>
          <div className="rounded-2xl bg-white/85 border border-white/80 p-4 shadow-sm">
            <p className="text-xs uppercase tracking-wide text-slate-500">Avg severity</p>
            <p className="mt-1 text-2xl font-bold text-slate-900">{averageSeverity ?? "-"}</p>
          </div>
          <div className="rounded-2xl bg-white/85 border border-white/80 p-4 shadow-sm">
            <p className="text-xs uppercase tracking-wide text-slate-500">Intense days</p>
            <p className="mt-1 text-2xl font-bold text-slate-900">{intenseDays}</p>
          </div>
        </div>

        <div className="text-center mb-7">
          <button
            onClick={openModal}
            className="inline-flex items-center gap-2 bg-gradient-to-b from-sky-500 to-blue-500 hover:from-sky-600 hover:to-blue-600 text-white font-semibold px-6 py-3 rounded-2xl shadow-md transition hover:scale-[1.02]"
          >
            <Plus size={18} /> Log Symptom
          </button>
        </div>

        <h2 className="text-lg font-semibold text-slate-700 mb-3">Recent Logs</h2>
        {error ? <p className="mb-3 text-sm text-red-600">{error}</p> : null}
        <div className="flex flex-col gap-4">
          {logs.length === 0 && (
            <div className="mt-8 rounded-3xl border border-dashed border-sky-200 bg-white/80 p-10 text-center">
              <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-sky-100 text-sky-700">
                <HeartPulse size={24} />
              </div>
              <p className="text-slate-700 font-medium">No symptoms logged yet</p>
              <p className="text-slate-500 text-sm mt-1">Your wellness timeline will appear here after your first entry.</p>
            </div>
          )}

          {logs.map((log) => {
            const style = getSeverityStyle(log.severity ?? 0);

            return (
              <div
                key={log.id}
                className={`rounded-2xl border-l-4 ${style.border} bg-white/90 p-5 shadow-sm transition hover:shadow-md hover:-translate-y-0.5`}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-sm text-slate-400">{log.date}</p>
                    <p className="font-semibold text-xl text-slate-900">{log.symptom}</p>
                  </div>
                  <span className={`rounded-full px-3 py-1 text-xs font-semibold ${style.badge}`}>
                    {style.label}
                  </span>
                </div>

                <div className="mt-3 flex items-center justify-between text-sm text-slate-600">
                  <span className="inline-flex items-center gap-1">
                    <Activity size={15} /> Severity
                  </span>
                  <span className="font-semibold text-slate-800">{log.severity ?? "-"} / 10</span>
                </div>

                <div className="mt-2 h-2 w-full rounded-full bg-slate-100 overflow-hidden">
                  <div
                    className={`h-full ${style.bar} transition-all`}
                    style={{ width: `${Math.max(0, Math.min(100, (log.severity ?? 0) * 10))}%` }}
                  />
                </div>

                {log.notes && (
                  <p className="text-slate-600 text-sm mt-3 rounded-lg bg-slate-50 p-3">
                    {log.notes}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl border border-white/80 shadow-lg max-w-md w-full p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold text-slate-900">Log Symptom</h2>
              <button onClick={closeModal} className="text-slate-400 hover:text-slate-600 transition-colors">
                <X size={24} />
              </button>
            </div>

            <div className="mb-4">
              <h3 className="font-medium text-slate-700 mb-2">Choose symptom</h3>
              <div className="flex flex-wrap gap-2">
                {symptomsList.map((symptom) => (
                  <button
                    key={symptom}
                    onClick={() => setCurrentSymptom(symptom)}
                    className={`px-4 py-2 rounded-full transition ${
                      currentSymptom === symptom
                        ? "bg-sky-500 text-white shadow-sm"
                        : "bg-sky-50 text-sky-700 hover:bg-sky-100"
                    }`}
                  >
                    {symptom}
                  </button>
                ))}
              </div>
            </div>

            <div className="mb-4">
              <h3 className="font-medium text-slate-700 mb-2">Rate severity (0-10)</h3>
              <div className="flex flex-wrap gap-2">
                {[...Array(11).keys()].map((level) => (
                  <button
                    key={level}
                    onClick={() => setCurrentSeverity(level)}
                    className={`px-3 py-1 rounded-full transition ${
                      currentSeverity === level
                        ? "bg-orange-500 text-white shadow-sm"
                        : "bg-orange-50 text-orange-700 hover:bg-orange-100"
                    }`}
                  >
                    {level}
                  </button>
                ))}
              </div>
            </div>

            <div className="mb-4">
              <h3 className="font-medium text-slate-700 mb-2">Notes (optional)</h3>
              <textarea
                value={currentNotes}
                onChange={(e) => setCurrentNotes(e.target.value)}
                rows={3}
                className="w-full p-3 bg-slate-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500"
                placeholder="Describe how you're feeling..."
              />
            </div>

            <div className="flex gap-3 mt-4">
              <button
                onClick={closeModal}
                className="flex-1 px-4 py-2 border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                className="flex-1 px-4 py-2 bg-sky-500 text-white rounded-lg hover:bg-sky-600 transition flex items-center justify-center gap-2"
              >
                <Check size={18} /> Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
