import { useCallback, useEffect, useMemo, useState } from "react";
import Navbar from "../components/Navbar";
import { Activity, CalendarDays, Check, Filter, HeartPulse, Plus, Sparkles, Trash2, X } from "lucide-react";
import { createSymptom, deleteSymptom, filterSymptoms, getSymptoms } from "../api/symptoms";

const PRESET_SYMPTOMS = ["Headache", "Nausea", "Fever", "Fatigue", "Cough", "Dizziness"];

function formatLoggedDate(value) {
  return new Date(value).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
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

function getLogSource(log) {
  const rawSource = String(log.loggedBy || "").trim().toLowerCase();

  if (rawSource === "caregiver") {
    return {
      key: "caregiver",
      label: "Caregiver-entered",
      tone: "bg-indigo-100 text-indigo-700 ring-1 ring-indigo-200",
    };
  }

  return {
    key: "patient",
    label: "Patient-entered",
    tone: "bg-slate-100 text-slate-700 ring-1 ring-slate-200",
  };
}

export default function Symptoms() {
  const [logs, setLogs] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [currentSymptom, setCurrentSymptom] = useState("");
  const [customSymptom, setCustomSymptom] = useState("");
  const [currentSeverity, setCurrentSeverity] = useState(null);
  const [currentNotes, setCurrentNotes] = useState("");
  const [currentDate, setCurrentDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [filters, setFilters] = useState({
    symptomName: "",
    severityBands: [],
    startDate: "",
    endDate: "",
    sortOrder: "DESC",
  });

  const todayLabel = useMemo(
    () =>
      new Date().toLocaleDateString(undefined, {
        weekday: "long",
        month: "long",
        day: "numeric",
      }),
    []
  );

  const loadSymptoms = useCallback(async (nextFilters) => {
    setLoading(true);
    try {
      const hasAdvancedFilters = Boolean(
        nextFilters.symptomName || nextFilters.startDate || nextFilters.endDate
      );
      const data = hasAdvancedFilters
        ? await filterSymptoms({
            symptomName: nextFilters.symptomName,
            startDate: nextFilters.startDate,
            endDate: nextFilters.endDate,
            sortBy: "loggedAt",
            sortOrder: nextFilters.sortOrder,
            limit: 100,
            offset: 0,
          })
        : await getSymptoms();

      const source = Array.isArray(data) ? data : data.symptoms || [];
      let nextLogs = source.map((item) => ({
          id: item.id,
          date: item.loggedAt,
          symptom: item.name,
          severity: item.severity,
          notes: item.notes,
          loggedBy: item.loggedBy,
        }));

      if (Array.isArray(nextFilters.severityBands) && nextFilters.severityBands.length > 0) {
        nextLogs = nextLogs.filter((item) => {
          const severity = item.severity ?? 0;
          return nextFilters.severityBands.some((band) => {
            if (band === "mild") return severity <= 3;
            if (band === "moderate") return severity >= 4 && severity <= 6;
            if (band === "high") return severity >= 7;
            return false;
          });
        });
      }

      nextLogs.sort((left, right) =>
        nextFilters.sortOrder === "ASC"
          ? new Date(left.date) - new Date(right.date)
          : new Date(right.date) - new Date(left.date)
      );

      setLogs(nextLogs);
      setError("");
    } catch (loadError) {
      setError(loadError.message || "Failed to load symptoms.");
      setLogs([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSymptoms(filters);
  }, [filters, loadSymptoms]);

  const averageSeverity =
    logs.length > 0
      ? (logs.reduce((sum, log) => sum + (log.severity ?? 0), 0) / logs.length).toFixed(1)
      : null;

  const intenseDays = logs.filter((log) => (log.severity ?? 0) >= 7).length;

  const trendItems = useMemo(() => {
    const grouped = new Map();
    logs
      .slice()
      .sort((left, right) => new Date(left.date) - new Date(right.date))
      .forEach((log) => {
        const key = new Date(log.date).toISOString().slice(0, 10);
        const current = grouped.get(key) || { count: 0, totalSeverity: 0 };
        grouped.set(key, {
          count: current.count + 1,
          totalSeverity: current.totalSeverity + (log.severity || 0),
        });
      });

    return Array.from(grouped.entries()).slice(-7).map(([date, value]) => ({
      date,
      count: value.count,
      averageSeverity: Math.round((value.totalSeverity / value.count) * 10) / 10,
    }));
  }, [logs]);

  const topSymptoms = useMemo(() => {
    const counts = {};
    logs.forEach((log) => {
      counts[log.symptom] = (counts[log.symptom] || 0) + 1;
    });
    return Object.entries(counts)
      .sort((left, right) => right[1] - left[1])
      .slice(0, 4);
  }, [logs]);
  const customSymptomSuggestions = useMemo(() => {
    const presetSet = new Set(PRESET_SYMPTOMS.map((item) => item.toLowerCase()));
    return Array.from(
      new Set(
        logs
          .map((log) => log.symptom)
          .filter((symptom) => symptom && !presetSet.has(symptom.toLowerCase()))
      )
    ).slice(0, 6);
  }, [logs]);
  const severityDistribution = useMemo(() => {
    const buckets = { mild: 0, moderate: 0, high: 0 };
    logs.forEach((log) => {
      if ((log.severity ?? 0) >= 7) buckets.high += 1;
      else if ((log.severity ?? 0) >= 4) buckets.moderate += 1;
      else buckets.mild += 1;
    });
    return buckets;
  }, [logs]);
  const trendInsight = useMemo(() => {
    if (trendItems.length < 2) return "Add more symptom history to unlock stronger trend insight.";

    const latest = trendItems[trendItems.length - 1];
    const previous = trendItems[trendItems.length - 2];
    if (latest.averageSeverity > previous.averageSeverity) {
      return "Average severity is rising compared with the previous tracked day.";
    }
    if (latest.averageSeverity < previous.averageSeverity) {
      return "Average severity is easing compared with the previous tracked day.";
    }
    return "Average severity is steady across the latest tracked days.";
  }, [trendItems]);

  async function handleSave() {
    const selectedSymptom = currentSymptom === "__custom__" ? customSymptom.trim() : currentSymptom;
    if (!selectedSymptom) {
      alert("Please select or enter a symptom.");
      return;
    }
    if (currentSeverity === null) {
      alert("Please select severity.");
      return;
    }

    try {
      const data = await createSymptom({
        symptom: selectedSymptom,
        severity: currentSeverity,
        notes: currentNotes,
        date: currentDate,
      });

      setLogs((current) => [
        {
          id: data.id,
          date: data.loggedAt,
          symptom: data.name,
          severity: data.severity,
          notes: data.notes,
          loggedBy: data.loggedBy,
        },
        ...current,
      ]);
      setError("");
      setCurrentSymptom("");
      setCustomSymptom("");
      setCurrentSeverity(null);
      setCurrentNotes("");
      setCurrentDate(new Date().toISOString().slice(0, 10));
      setIsModalOpen(false);
    } catch (saveError) {
      alert(saveError.message || "Failed to save symptom.");
    }
  }

  async function handleDelete(logId) {
    if (!window.confirm("Delete this symptom log?")) return;

    try {
      await deleteSymptom(logId);
      setLogs((current) => current.filter((item) => item.id !== logId));
    } catch (deleteError) {
      alert(deleteError.message || "Failed to delete symptom.");
    }
  }

  function toggleSeverityBand(band) {
    setFilters((current) => ({
      ...current,
      severityBands: current.severityBands.includes(band)
        ? current.severityBands.filter((item) => item !== band)
        : [...current.severityBands, band],
    }));
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-gradient-to-br from-sky-50 via-indigo-50 to-cyan-50 p-6">
      <div className="pointer-events-none absolute -left-16 -top-24 h-72 w-72 rounded-full bg-sky-200/35 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-24 -right-16 h-80 w-80 rounded-full bg-indigo-200/35 blur-3xl" />
      <Navbar />

      <div className="relative mx-auto max-w-6xl pt-24">
        <header className="mb-8 rounded-3xl border border-white/80 bg-white/75 p-6 shadow-sm backdrop-blur-sm">
          <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="inline-flex items-center gap-2 rounded-full bg-sky-100 px-3 py-1 text-sm font-medium text-sky-700">
                <Sparkles size={16} /> Symptom tracking
              </p>
              <h1 className="mt-3 text-4xl font-black text-slate-900">Health Log</h1>
              <p className="mt-1 text-slate-600">
                Capture custom symptoms, filter your history, and follow trend changes over time.
              </p>
            </div>
            <div className="min-w-[220px] rounded-2xl border border-slate-100 bg-white/90 p-4">
              <p className="text-xs uppercase tracking-wide text-slate-500">Today</p>
              <p className="mt-1 flex items-center gap-2 font-semibold text-slate-800">
                <CalendarDays size={16} className="text-sky-600" />
                {todayLabel}
              </p>
            </div>
          </div>
        </header>

        <div className="mb-6 grid grid-cols-1 gap-3 md:grid-cols-3">
          <div className="rounded-2xl border border-white/80 bg-white/85 p-4 shadow-sm">
            <p className="text-xs uppercase tracking-wide text-slate-500">Entries</p>
            <p className="mt-1 text-2xl font-bold text-slate-900">{logs.length}</p>
          </div>
          <div className="rounded-2xl border border-white/80 bg-white/85 p-4 shadow-sm">
            <p className="text-xs uppercase tracking-wide text-slate-500">Avg severity</p>
            <p className="mt-1 text-2xl font-bold text-slate-900">{averageSeverity ?? "-"}</p>
          </div>
          <div className="rounded-2xl border border-white/80 bg-white/85 p-4 shadow-sm">
            <p className="text-xs uppercase tracking-wide text-slate-500">Intense days</p>
            <p className="mt-1 text-2xl font-bold text-slate-900">{intenseDays}</p>
          </div>
        </div>

        <div className="mb-6 grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
          <section className="rounded-3xl bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-semibold text-slate-900">Stronger filtering</h2>
                <p className="mt-1 text-sm text-slate-500">Narrow the log by symptom, severity, and date range.</p>
              </div>
              <Filter className="text-slate-400" size={20} />
            </div>

            <div className="mt-4 grid gap-3">
              <input
                type="text"
                value={filters.symptomName}
                onChange={(event) => setFilters((current) => ({ ...current, symptomName: event.target.value }))}
                placeholder="Search symptom name"
                className="rounded-2xl border border-slate-300 px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-sky-500"
              />
              <div className="rounded-2xl border border-slate-300 px-4 py-3">
                <p className="text-sm font-medium text-slate-700">Severity</p>
                <div className="mt-3 flex flex-wrap gap-3">
                  {[
                    { key: "mild", label: "Mild" },
                    { key: "moderate", label: "Moderate" },
                    { key: "high", label: "High" },
                  ].map((item) => (
                    <label key={item.key} className="inline-flex items-center gap-2 text-sm text-slate-700">
                      <input
                        type="checkbox"
                        checked={filters.severityBands.includes(item.key)}
                        onChange={() => toggleSeverityBand(item.key)}
                        className="h-4 w-4 rounded border-slate-300 text-sky-500 focus:ring-sky-500"
                      />
                      {item.label}
                    </label>
                  ))}
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {[
                  { label: "High only", value: "7" },
                  { label: "Moderate+", value: "4" },
                  { label: "Newest", sortOrder: "DESC" },
                  { label: "Oldest", sortOrder: "ASC" },
                ].map((preset) => (
                  <button
                    key={preset.label}
                    type="button"
                    onClick={() =>
                      setFilters((current) => ({
                        ...current,
                        ...(preset.value
                          ? {
                              severityBands: preset.value === "7" ? ["high"] : ["moderate", "high"],
                            }
                          : {}),
                        ...(preset.sortOrder ? { sortOrder: preset.sortOrder } : {}),
                      }))
                    }
                    className="rounded-full bg-slate-100 px-3 py-1.5 text-sm text-slate-700 transition hover:bg-slate-200"
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <input
                  type="date"
                  value={filters.startDate}
                  onChange={(event) => setFilters((current) => ({ ...current, startDate: event.target.value }))}
                  aria-label="From date"
                  className="rounded-2xl border border-slate-300 px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
                <input
                  type="date"
                  value={filters.endDate}
                  onChange={(event) => setFilters((current) => ({ ...current, endDate: event.target.value }))}
                  aria-label="To date"
                  className="rounded-2xl border border-slate-300 px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>
              <div className="grid grid-cols-2 gap-3 text-xs font-medium text-slate-500">
                <span>From date</span>
                <span>To date</span>
              </div>
              <select
                value={filters.sortOrder}
                onChange={(event) => setFilters((current) => ({ ...current, sortOrder: event.target.value }))}
                className="rounded-2xl border border-slate-300 px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-sky-500"
              >
                <option value="DESC">Newest first</option>
                <option value="ASC">Oldest first</option>
              </select>
              <button
                type="button"
                onClick={() => {
                  const reset = { symptomName: "", severityBands: [], startDate: "", endDate: "", sortOrder: "DESC" };
                  setFilters(reset);
                }}
                className="rounded-2xl border border-slate-300 px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition"
              >
                Reset filters
              </button>
            </div>
          </section>

          <section className="rounded-3xl bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-semibold text-slate-900">Trend view</h2>
                <p className="mt-1 text-sm text-slate-500">Average severity and logging frequency across recent days.</p>
              </div>
              <button
                onClick={() => setIsModalOpen(true)}
                className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-b from-sky-500 to-blue-500 px-5 py-3 text-sm font-semibold text-white shadow-md transition hover:scale-[1.02]"
              >
                <Plus size={18} /> Log Symptom
              </button>
            </div>

            <div className="mt-5 grid gap-4 md:grid-cols-[1fr_0.9fr]">
              <div className="space-y-3">
                {trendItems.length > 0 ? (
                  trendItems.map((item) => (
                    <div key={item.date}>
                      <div className="mb-1 flex items-center justify-between text-sm text-slate-600">
                        <span>{formatLoggedDate(item.date)}</span>
                        <span>{item.averageSeverity}/10 avg</span>
                      </div>
                      <div className="h-3 overflow-hidden rounded-full bg-slate-100">
                        <div className="h-full rounded-full bg-gradient-to-r from-sky-500 to-indigo-500" style={{ width: `${Math.min(100, item.averageSeverity * 10)}%` }} />
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="rounded-2xl border border-dashed border-slate-200 p-4 text-sm text-slate-500">
                    Trend bars appear once you have symptom history.
                  </p>
                )}
              </div>

              <div className="rounded-2xl bg-slate-50 p-4">
                <p className="text-sm font-semibold text-slate-900">Most frequent symptoms</p>
                <div className="mt-3 space-y-2">
                  {topSymptoms.length > 0 ? (
                    topSymptoms.map(([symptom, count]) => (
                      <div key={symptom} className="flex items-center justify-between rounded-xl bg-white px-3 py-2 text-sm text-slate-700">
                        <span>{symptom}</span>
                        <span className="font-semibold text-slate-900">{count}</span>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-slate-500">No symptom frequency data yet.</p>
                  )}
                </div>
              </div>
            </div>

            <div className="mt-4 grid gap-4 md:grid-cols-[0.9fr_1.1fr]">
              <div className="rounded-2xl bg-slate-50 p-4">
                <p className="text-sm font-semibold text-slate-900">Severity mix</p>
                <div className="mt-3 space-y-3">
                  {[
                    { key: "mild", label: "Mild", value: severityDistribution.mild, tone: "bg-emerald-500" },
                    { key: "moderate", label: "Moderate", value: severityDistribution.moderate, tone: "bg-amber-500" },
                    { key: "high", label: "High", value: severityDistribution.high, tone: "bg-rose-500" },
                  ].map((item) => (
                    <div key={item.key}>
                      <div className="mb-1 flex items-center justify-between text-sm text-slate-600">
                        <span>{item.label}</span>
                        <span>{item.value}</span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-white">
                        <div
                          className={`h-full ${item.tone}`}
                          style={{ width: `${logs.length > 0 ? Math.round((item.value / logs.length) * 100) : 0}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-2xl bg-sky-50 p-4">
                <p className="text-sm font-semibold text-slate-900">Trend insight</p>
                <p className="mt-2 text-sm text-slate-600">{trendInsight}</p>
                <div className="mt-4 grid gap-3 sm:grid-cols-3">
                  <div className="rounded-xl bg-white p-3">
                    <p className="text-xs uppercase tracking-wide text-slate-500">Tracked days</p>
                    <p className="mt-1 text-xl font-bold text-slate-900">{trendItems.length}</p>
                  </div>
                  <div className="rounded-xl bg-white p-3">
                    <p className="text-xs uppercase tracking-wide text-slate-500">Top symptom</p>
                    <p className="mt-1 text-sm font-semibold text-slate-900">{topSymptoms[0]?.[0] || "-"}</p>
                  </div>
                  <div className="rounded-xl bg-white p-3">
                    <p className="text-xs uppercase tracking-wide text-slate-500">Latest avg</p>
                    <p className="mt-1 text-xl font-bold text-slate-900">{trendItems[trendItems.length - 1]?.averageSeverity ?? "-"}</p>
                  </div>
                </div>
              </div>
            </div>
          </section>
        </div>

        <h2 className="mb-3 text-lg font-semibold text-slate-700">Recent Logs</h2>
        <p className="mb-3 text-sm text-slate-500">Each symptom entry is labeled by who recorded it.</p>
        {error ? <p className="mb-3 text-sm text-red-600">{error}</p> : null}
        <div className="flex flex-col gap-4">
          {loading ? (
            <div className="rounded-3xl border border-dashed border-sky-200 bg-white/80 p-10 text-center text-sm text-slate-500">
              Loading symptom history...
            </div>
          ) : logs.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-sky-200 bg-white/80 p-10 text-center">
              <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-sky-100 text-sky-700">
                <HeartPulse size={24} />
              </div>
              <p className="font-medium text-slate-700">No symptoms logged yet</p>
              <p className="mt-1 text-sm text-slate-500">Your wellness timeline will appear here after your first entry.</p>
            </div>
          ) : (
            logs.map((log) => {
              const style = getSeverityStyle(log.severity ?? 0);
              const source = getLogSource(log);
              return (
                <div
                  key={log.id}
                  className={`rounded-2xl border-l-4 ${style.border} bg-white/90 p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-sm text-slate-400">{formatLoggedDate(log.date)}</p>
                      <p className="text-xl font-semibold text-slate-900">{log.symptom}</p>
                    </div>
                    <div className="flex flex-col items-end gap-1.5">
                      <span className={`rounded-full px-3 py-1 text-xs font-semibold ${style.badge}`}>{style.label}</span>
                      <span className={`rounded-full px-3 py-1 text-xs font-semibold ${source.tone}`}>{source.label}</span>
                    </div>
                  </div>

                  <div className="mt-3 flex items-center justify-between text-sm text-slate-600">
                    <span className="inline-flex items-center gap-1">
                      <Activity size={15} /> Severity
                    </span>
                    <span className="font-semibold text-slate-800">{log.severity} / 10</span>
                  </div>

                  <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
                    <div className={`h-full ${style.bar}`} style={{ width: `${Math.max(0, Math.min(100, (log.severity ?? 0) * 10))}%` }} />
                  </div>

                  {log.notes ? <p className="mt-3 rounded-lg bg-slate-50 p-3 text-sm text-slate-600">{log.notes}</p> : null}
                  <div className="mt-4 flex justify-end">
                    <button
                      type="button"
                      onClick={() => handleDelete(log.id)}
                      className="inline-flex items-center gap-2 rounded-xl border border-rose-200 px-3 py-2 text-xs font-semibold text-rose-700 transition hover:bg-rose-50"
                    >
                      <Trash2 size={14} />
                      Delete log
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {isModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-3xl border border-white/80 bg-white p-6 shadow-lg">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xl font-semibold text-slate-900">Log Symptom</h2>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 transition hover:text-slate-600">
                <X size={24} />
              </button>
            </div>

            <div className="mb-4">
              <h3 className="mb-2 font-medium text-slate-700">Choose symptom</h3>
              <div className="flex flex-wrap gap-2">
                {PRESET_SYMPTOMS.map((symptom) => (
                  <button
                    key={symptom}
                    onClick={() => setCurrentSymptom(symptom)}
                    className={`rounded-full px-4 py-2 transition ${
                      currentSymptom === symptom ? "bg-sky-500 text-white shadow-sm" : "bg-sky-50 text-sky-700 hover:bg-sky-100"
                    }`}
                  >
                    {symptom}
                  </button>
                ))}
                <button
                  onClick={() => setCurrentSymptom("__custom__")}
                  className={`rounded-full px-4 py-2 transition ${
                    currentSymptom === "__custom__" ? "bg-indigo-500 text-white shadow-sm" : "bg-indigo-50 text-indigo-700 hover:bg-indigo-100"
                  }`}
                >
                  Custom symptom
                </button>
              </div>
              {currentSymptom === "__custom__" ? (
                <div className="mt-3 space-y-3">
                  <input
                    type="text"
                    value={customSymptom}
                    onChange={(event) => setCustomSymptom(event.target.value)}
                    placeholder="Type your symptom"
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-sky-500"
                  />
                  {customSymptomSuggestions.length > 0 ? (
                    <div>
                      <p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                        Reuse previous custom symptoms
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {customSymptomSuggestions.map((symptom) => (
                          <button
                            key={symptom}
                            type="button"
                            onClick={() => setCustomSymptom(symptom)}
                            className="rounded-full bg-slate-100 px-3 py-1.5 text-sm text-slate-700 transition hover:bg-slate-200"
                          >
                            {symptom}
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>

            <div className="mb-4">
              <h3 className="mb-2 font-medium text-slate-700">Log date</h3>
              <input
                type="date"
                value={currentDate}
                onChange={(event) => setCurrentDate(event.target.value)}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-sky-500"
              />
            </div>

            <div className="mb-4">
              <h3 className="mb-2 font-medium text-slate-700">Rate severity (1-10)</h3>
              <div className="flex flex-wrap gap-2">
                {[...Array(10).keys()].map((index) => {
                  const level = index + 1;
                  return (
                    <button
                      key={level}
                      onClick={() => setCurrentSeverity(level)}
                      className={`rounded-full px-3 py-1 transition ${
                        currentSeverity === level ? "bg-orange-500 text-white shadow-sm" : "bg-orange-50 text-orange-700 hover:bg-orange-100"
                      }`}
                    >
                      {level}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="mb-4">
              <h3 className="mb-2 font-medium text-slate-700">Notes (optional)</h3>
              <textarea
                value={currentNotes}
                onChange={(event) => setCurrentNotes(event.target.value)}
                rows={3}
                className="w-full rounded-xl bg-slate-100 p-3 focus:outline-none focus:ring-2 focus:ring-sky-500"
                placeholder="Describe how you're feeling..."
              />
            </div>

            <div className="mt-4 flex gap-3">
              <button
                onClick={() => {
                  setIsModalOpen(false);
                  setCurrentDate(new Date().toISOString().slice(0, 10));
                }}
                className="flex-1 rounded-lg border border-slate-300 px-4 py-2 text-slate-700 transition hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-sky-500 px-4 py-2 text-white transition hover:bg-sky-600"
              >
                <Check size={18} /> Save
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
