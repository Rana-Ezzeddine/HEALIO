import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "../components/Navbar";
import { apiUrl, authHeaders } from "../api/http";
import { rememberDoctorPatientTab } from "../utils/doctorPatientTabs";

function patientInitials(record) {
  const p = record?.patient || record;
  const email = p?.email || "";
  const display = patientDisplayName(record);
  const pieces = display.split(" ").filter(Boolean);
  if (pieces.length >= 2) return `${pieces[0][0]}${pieces[1][0]}`.toUpperCase();
  return email ? email[0].toUpperCase() : "?";
}

function patientDisplayName(record) {
  const p = record?.patient || record;
  return [p?.firstName, p?.lastName].filter(Boolean).join(" ").trim() || p?.displayName || p?.email || "Patient";
}

function formatDateTime(value) {
  if (!value) return "Not scheduled";
  return new Date(value).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

function formatRelativeDate(value) {
  if (!value) return "No recent signal";
  const diff = Date.now() - new Date(value).getTime();
  const hours = Math.max(1, Math.round(diff / (1000 * 60 * 60)));
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return `${days}d ago`;
}

async function fetchAssignedPatients() {
  const response = await fetch(`${apiUrl}/api/doctors/assigned-patients`, {
    headers: { "Content-Type": "application/json", ...authHeaders() },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || "Failed to load assigned patients.");
  return data;
}

async function fetchDoctorDashboardOverview() {
  const response = await fetch(`${apiUrl}/api/doctors/patients/urgency`, {
    headers: { "Content-Type": "application/json", ...authHeaders() },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || "Failed to load urgency overview.");
  return data;
}

async function reviewPatientUrgency(patientId, payload) {
  const response = await fetch(`${apiUrl}/api/doctors/patients/${patientId}/urgency/review`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify(payload),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || "Failed to save urgency review.");
  return data;
}

async function overridePatientUrgency(patientId, payload) {
  const response = await fetch(`${apiUrl}/api/doctors/patients/${patientId}/urgency/override`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify(payload),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || "Failed to save urgency override.");
  return data;
}

async function fetchLinkRequestsCount() {
  const response = await fetch(`${apiUrl}/api/doctors/assignments/requests`, {
    headers: { "Content-Type": "application/json", ...authHeaders() },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || "Failed to load link requests.");
  return (data.requests || []).length;
}

export default function DoctorPatients() {
  const navigate = useNavigate();
  const [assignedPatients, setAssignedPatients] = useState([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [urgencyFilter, setUrgencyFilter] = useState("all");
  const [savingPatientId, setSavingPatientId] = useState("");
  const [message, setMessage] = useState("");
  const [overrideDrafts, setOverrideDrafts] = useState({});
  const [expandedReviewPatientId, setExpandedReviewPatientId] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError("");
      setMessage("");
      try {
        const [patientsRes, overviewRes, requestsCount] = await Promise.all([
          fetchAssignedPatients(),
          fetchDoctorDashboardOverview(),
          fetchLinkRequestsCount(),
        ]);
        if (!cancelled) {
          const overviewPatients = new Map(
            (overviewRes.patients || []).map((record) => [record.id, record])
          );
          const mergedPatients = (patientsRes.patients || [])
            .filter((record) => record.status === "active")
            .map((record) => {
              const patientId = record.patient?.id || record.id;
              const overviewRecord = overviewPatients.get(patientId);
              const merged = {
                ...record,
                id: patientId,
                snapshot: overviewRecord?.snapshot || record.snapshot || {},
                urgency: overviewRecord?.urgency || {
                  score: 0,
                  level: "stable",
                  reasons: ["AI unavailable"],
                  recommendedAction: "Review manually",
                },
              };
              return {
                ...merged,
                urgency: {
                  ...merged.urgency,
                  label:
                    merged.urgency?.effectiveLevel === "critical" || merged.urgency?.level === "critical"
                      ? "Critical"
                      : merged.urgency?.effectiveLevel === "needs_review" || merged.urgency?.level === "needs_review"
                        ? "Needs review"
                        : "Stable",
                  tone:
                    merged.urgency?.effectiveLevel === "critical" || merged.urgency?.level === "critical"
                      ? "rose"
                      : merged.urgency?.effectiveLevel === "needs_review" || merged.urgency?.level === "needs_review"
                        ? "amber"
                        : "emerald",
                },
              };
            })
            .sort((a, b) => b.urgency.score - a.urgency.score);

          setAssignedPatients(mergedPatients);
          setPendingCount(requestsCount);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err.message || "Failed to load patients.");
          setAssignedPatients([]);
          setPendingCount(0);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  async function refreshPatients() {
    setLoading(true);
    setError("");
    try {
      const [patientsRes, overviewRes, requestsCount] = await Promise.all([
        fetchAssignedPatients(),
        fetchDoctorDashboardOverview(),
        fetchLinkRequestsCount(),
      ]);
      const overviewPatients = new Map((overviewRes.patients || []).map((record) => [record.id, record]));
      const mergedPatients = (patientsRes.patients || [])
        .filter((record) => record.status === "active")
        .map((record) => {
          const patientId = record.patient?.id || record.id;
          const overviewRecord = overviewPatients.get(patientId);
          const merged = {
            ...record,
            id: patientId,
            snapshot: overviewRecord?.snapshot || record.snapshot || {},
            urgency: overviewRecord?.urgency || {
              score: 0,
              level: "stable",
              reasons: [],
              recommendedAction: "Continue routine monitoring.",
            },
            review: overviewRecord?.review || null,
            calculatedAt: overviewRecord?.calculatedAt || null,
          };
          return {
            ...merged,
            urgency: {
              ...merged.urgency,
              label:
                merged.urgency?.effectiveLevel === "critical" || merged.urgency?.level === "critical"
                  ? "Critical"
                  : merged.urgency?.effectiveLevel === "needs_review" || merged.urgency?.level === "needs_review"
                    ? "Needs review"
                    : "Stable",
              tone:
                merged.urgency?.effectiveLevel === "critical" || merged.urgency?.level === "critical"
                  ? "rose"
                  : merged.urgency?.effectiveLevel === "needs_review" || merged.urgency?.level === "needs_review"
                    ? "amber"
                    : "emerald",
            },
          };
        })
        .sort((a, b) => (b.urgency?.effectiveScore ?? b.urgency?.score ?? 0) - (a.urgency?.effectiveScore ?? a.urgency?.score ?? 0));
      setAssignedPatients(mergedPatients);
      setPendingCount(requestsCount);
    } catch (err) {
      setError(err.message || "Failed to load patients.");
    } finally {
      setLoading(false);
    }
  }

  async function handleReview(patientId) {
    try {
      setSavingPatientId(patientId);
      setMessage("");
      await reviewPatientUrgency(patientId, { status: "reviewed", note: "Reviewed from doctor workspace." });
      await refreshPatients();
      setMessage("Urgency review saved.");
    } catch (err) {
      setError(err.message || "Failed to save urgency review.");
    } finally {
      setSavingPatientId("");
    }
  }

  async function handleOverride(patientId, currentUrgency) {
    const draft = overrideDrafts[patientId];
    if (!draft?.reason?.trim()) {
      setError("Add an override reason before saving.");
      return;
    }
    try {
      setSavingPatientId(patientId);
      setMessage("");
      await overridePatientUrgency(patientId, {
        level: draft.level || currentUrgency?.effectiveLevel || currentUrgency?.level || "needs_review",
        score: Number(draft.score ?? currentUrgency?.effectiveScore ?? currentUrgency?.score ?? 50),
        reason: draft.reason,
      });
      await refreshPatients();
      setMessage("Urgency override saved.");
    } catch (err) {
      setError(err.message || "Failed to save urgency override.");
    } finally {
      setSavingPatientId("");
    }
  }

  const criticalCount = assignedPatients.filter((record) => record.urgency?.level === "critical").length;
  const reviewCount = assignedPatients.filter((record) => (record.urgency?.effectiveLevel || record.urgency?.level) === "needs_review").length;

  const filteredPatients = assignedPatients.filter((record) => {
    const patient = record.patient || record;
    const displayName = patientDisplayName(record).toLowerCase();
    const email = (patient?.email || "").toLowerCase();
    const query = searchTerm.trim().toLowerCase();
    const urgencyMatches =
      urgencyFilter === "all" ||
      (urgencyFilter === "critical" && (record.urgency?.effectiveLevel || record.urgency?.level) === "critical") ||
      (urgencyFilter === "review" && ["critical", "needs_review"].includes(record.urgency?.effectiveLevel || record.urgency?.level));

    return (
      urgencyMatches &&
      (
        !query ||
        displayName.includes(query) ||
        email.includes(query) ||
        ((record.snapshot?.latestSymptom?.name || "").toLowerCase().includes(query))
      )
    );
  });

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />

      <main className="mx-auto max-w-7xl px-6 pb-10 pt-28">
        <section className="rounded-[2rem] bg-gradient-to-r from-slate-900 via-sky-800 to-cyan-600 p-8 text-white shadow-xl">
          <div className="grid gap-6 xl:grid-cols-[1.25fr_0.75fr] xl:items-start">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.25em] text-white/75">Doctor Workspace</p>
              <h1 className="mt-3 text-4xl font-black">Patients</h1>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-white/85">
                See your active patient roster here. Open any patient to enter their dedicated detail page, where clinical notes and treatment plans are available in context.
              </p>
              <div className="mt-5 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => navigate("/doctorAppointments")}
                  className="rounded-xl bg-white/15 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/25"
                >
                  Open appointments
                </button>
              </div>
            </div>

            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
              <button
                type="button"
                onClick={() => navigate('/doctor-patients/requests')}
                className="rounded-2xl border border-white/15 bg-white/10 px-4 py-3 text-left shadow-sm backdrop-blur-sm transition hover:bg-white/15"
              >
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/70">Link requests</p>
                <p className="mt-1 text-xl font-black text-white">{pendingCount}</p>
                <p className="mt-0.5 text-[11px] text-white/75">Open approval queue</p>
              </button>
              <div className="rounded-2xl border border-white/15 bg-white/10 px-4 py-3 shadow-sm backdrop-blur-sm">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/70">Active patients</p>
                <p className="mt-1 text-xl font-black text-white">{assignedPatients.length}</p>
                <p className="mt-0.5 text-[11px] text-white/75">Currently linked</p>
              </div>
            </div>
          </div>
        </section>

        {error ? <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}
        {message ? <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{message}</div> : null}

        <section className="mt-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="text-xl font-semibold text-slate-900">Assigned patients</h2>
              <p className="mt-1 text-sm text-slate-500">Click a patient to enter their dedicated page.</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setUrgencyFilter("all")}
                className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${urgencyFilter === "all" ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}
              >
                All patients
              </button>
              <button
                type="button"
                onClick={() => setUrgencyFilter("review")}
                className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${urgencyFilter === "review" ? "bg-amber-500 text-white" : "bg-amber-50 text-amber-700 hover:bg-amber-100"}`}
              >
                Needs review {reviewCount + criticalCount ? `• ${reviewCount + criticalCount}` : ""}
              </button>
              <button
                type="button"
                onClick={() => setUrgencyFilter("critical")}
                className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${urgencyFilter === "critical" ? "bg-rose-600 text-white" : "bg-rose-50 text-rose-700 hover:bg-rose-100"}`}
              >
                Critical {criticalCount ? `• ${criticalCount}` : ""}
              </button>
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-50"
              >
                Refresh
              </button>
            </div>
          </div>

          <div className="mt-5 grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
            <input
              type="text"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Search by patient name, email, or symptom"
              className="rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-sky-300 focus:ring-2 focus:ring-sky-100"
            />
            <div className="rounded-2xl border border-sky-100 bg-gradient-to-r from-sky-50 to-cyan-50 px-4 py-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-sky-700">Clinical urgency engine</p>
              <p className="mt-1 text-sm text-slate-700">Patients are ranked by a deterministic review-priority engine using emergency status, symptom severity and recency, symptom frequency, diagnosis burden, medication burden, and follow-up timing. Doctors can review and override the score.</p>
            </div>
          </div>

          <div className="mt-5 space-y-3">
            {loading ? (
              <p className="text-sm text-slate-500">Loading...</p>
            ) : assignedPatients.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-200 px-6 py-8 text-center text-sm text-slate-500">
                No patients linked yet.
              </div>
            ) : filteredPatients.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-200 px-6 py-8 text-center text-sm text-slate-500">
                No patients match the current search.
              </div>
            ) : (
              filteredPatients.map((record) => {
                const patientId = record.patient?.id || record.id;
                const snapshot = record.snapshot || {};
                const displayName = patientDisplayName(record);
                const urgency = record.urgency || { score: 0, label: "Stable", level: "stable", tone: "emerald", reasons: [] };
                const urgencyToneClasses =
                  urgency.tone === "rose"
                    ? "bg-rose-100 text-rose-700"
                    : urgency.tone === "amber"
                      ? "bg-amber-100 text-amber-700"
                      : "bg-emerald-100 text-emerald-700";
                const urgencyBarClasses =
                  urgency.tone === "rose"
                    ? "from-rose-500 to-pink-500"
                    : urgency.tone === "amber"
                      ? "from-amber-500 to-orange-400"
                      : "from-emerald-500 to-teal-400";
                return (
                  <button
                    key={patientId}
                    type="button"
                    onClick={() => {
                      rememberDoctorPatientTab({ id: patientId, name: displayName });
                      navigate(`/doctor-patients/${patientId}`);
                    }}
                    className="flex w-full items-start gap-4 rounded-2xl border border-slate-200 p-4 text-left transition hover:border-slate-300 hover:bg-slate-50"
                  >
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-cyan-100 text-sm font-bold text-cyan-700">{patientInitials(record)}</div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="truncate font-semibold text-slate-900">{displayName}</p>
                          {record.patient?.email && displayName !== record.patient.email ? <p className="truncate text-sm text-slate-500">{record.patient.email}</p> : null}
                        </div>
                        <div className="min-w-[150px] rounded-2xl border border-slate-200 bg-white px-3 py-2 shadow-sm">
                          <div className="flex items-center justify-between gap-3">
                            <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${urgencyToneClasses}`}>{urgency.label}</span>
                            <span className="text-lg font-black text-slate-900">{urgency.effectiveScore ?? urgency.score}</span>
                          </div>
                          <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
                            <div className={`h-full rounded-full bg-gradient-to-r ${urgencyBarClasses}`} style={{ width: `${urgency.effectiveScore ?? urgency.score}%` }} />
                          </div>
                          <p className="mt-2 text-[11px] text-slate-500">{urgency.reasons.join(" • ")}</p>
                        </div>
                      </div>
                      <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                        <div className="rounded-xl bg-slate-50 px-3 py-2">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Latest symptom</p>
                          <p className="mt-1 text-sm font-semibold text-slate-900">{snapshot.latestSymptom?.name || "No recent symptom"}</p>
                          <p className="mt-1 text-xs text-slate-500">
                            {snapshot.latestSymptom?.loggedAt ? `${snapshot.latestSymptom?.severity || "Logged"} • ${formatRelativeDate(snapshot.latestSymptom.loggedAt)}` : "Routine monitoring"}
                          </p>
                        </div>
                        <div className="rounded-xl bg-slate-50 px-3 py-2">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Next appointment</p>
                          <p className="mt-1 text-sm font-semibold text-slate-900">{snapshot.nextAppointmentAt ? formatDateTime(snapshot.nextAppointmentAt) : "Not scheduled"}</p>
                          <p className="mt-1 text-xs text-slate-500">{snapshot.nextAppointmentAt ? "Follow-up on calendar" : "No visit booked"}</p>
                        </div>
                        <div className="rounded-xl bg-slate-50 px-3 py-2">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Meds count</p>
                          <p className="mt-1 text-sm font-semibold text-slate-900">{snapshot.activeMedicationCount || 0} active</p>
                          <p className="mt-1 text-xs text-slate-500">{snapshot.activeDiagnosisCount || 0} active diagnoses</p>
                        </div>
                        <div className="rounded-xl bg-slate-50 px-3 py-2">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">AI recommendation</p>
                          <p className="mt-1 text-sm font-semibold text-sky-700">
                            {urgency.recommendedAction || ((urgency.effectiveLevel || urgency.level) === "critical" ? "Review immediately" : (urgency.effectiveLevel || urgency.level) === "needs_review" ? "Check soon" : "Routine follow-up")}
                          </p>
                        </div>
                      </div>
                      <div className="mt-3 rounded-2xl border border-slate-200 bg-white px-3 py-3">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-500">
                            <span>Model: deterministic-v1</span>
                            {record.calculatedAt ? <span>Calculated {formatDateTime(record.calculatedAt)}</span> : null}
                            {record.review?.reviewedAt ? <span>Reviewed {formatDateTime(record.review.reviewedAt)}</span> : null}
                            {urgency.override?.overriddenAt ? <span>Override {formatDateTime(urgency.override.overriddenAt)}</span> : null}
                          </div>
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              setExpandedReviewPatientId((current) => current === patientId ? "" : patientId);
                            }}
                            className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-100"
                          >
                            {expandedReviewPatientId === patientId ? "Hide review tools" : "Review / override"}
                          </button>
                        </div>

                        {expandedReviewPatientId === patientId ? (
                          <div className="mt-3 space-y-3">
                            <div className="flex flex-wrap items-center gap-2">
                              <button
                                type="button"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  handleReview(patientId);
                                }}
                                disabled={savingPatientId === patientId}
                                className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-slate-800 disabled:bg-slate-400"
                              >
                                {savingPatientId === patientId ? "Saving..." : "Mark reviewed"}
                              </button>
                              <select
                                value={overrideDrafts[patientId]?.level || urgency.effectiveLevel || urgency.level || "needs_review"}
                                onClick={(event) => event.stopPropagation()}
                                onChange={(event) => setOverrideDrafts((current) => ({
                                  ...current,
                                  [patientId]: {
                                    ...current[patientId],
                                    level: event.target.value,
                                  },
                                }))}
                                className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700"
                              >
                                <option value="stable">Stable</option>
                                <option value="needs_review">Needs review</option>
                                <option value="critical">Critical</option>
                              </select>
                              <input
                                type="number"
                                min="0"
                                max="100"
                                value={overrideDrafts[patientId]?.score ?? urgency.effectiveScore ?? urgency.score}
                                onClick={(event) => event.stopPropagation()}
                                onChange={(event) => setOverrideDrafts((current) => ({
                                  ...current,
                                  [patientId]: {
                                    ...current[patientId],
                                    score: event.target.value,
                                  },
                                }))}
                                className="w-24 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700"
                              />
                            </div>
                            <div className="flex flex-wrap items-center gap-2">
                              <input
                                type="text"
                                value={overrideDrafts[patientId]?.reason || ""}
                                onClick={(event) => event.stopPropagation()}
                                onChange={(event) => setOverrideDrafts((current) => ({
                                  ...current,
                                  [patientId]: {
                                    ...current[patientId],
                                    reason: event.target.value,
                                  },
                                }))}
                                placeholder="Override reason"
                                className="min-w-[240px] flex-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-700"
                              />
                              <button
                                type="button"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  handleOverride(patientId, urgency);
                                }}
                                disabled={savingPatientId === patientId}
                                className="rounded-lg border border-sky-200 bg-sky-50 px-3 py-1.5 text-xs font-semibold text-sky-700 transition hover:bg-sky-100 disabled:opacity-60"
                              >
                                Save override
                              </button>
                            </div>
                          </div>
                        ) : null}
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
