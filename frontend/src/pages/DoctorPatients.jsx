import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "../components/Navbar";
import { apiUrl, authHeaders } from "../api/http";
import { getDoctorLinkRequests, reviewDoctorLinkRequest } from "../api/links";

function statusBadge(status) {
  if (status === "active") return "bg-emerald-100 text-emerald-700";
  if (status === "pending") return "bg-amber-100 text-amber-700";
  return "bg-slate-100 text-slate-600";
}

function patientInitials(record) {
  const first = record?.firstName || record?.patient?.firstName || "";
  const last = record?.lastName || record?.patient?.lastName || "";
  const email = record?.email || record?.patient?.email || "";
  return [first, last]
    .filter(Boolean)
    .map((n) => n[0].toUpperCase())
    .join("") || (email ? email[0].toUpperCase() : "?");
}

function patientDisplayName(record) {
  const p = record?.patient || record;
  return (
    [p?.firstName, p?.lastName].filter(Boolean).join(" ").trim() ||
    p?.displayName ||
    p?.email ||
    "Patient"
  );
}

export default function DoctorPatients() {
  const navigate = useNavigate();
  const [pendingRequests, setPendingRequests] = useState([]);
  const [assignedPatients, setAssignedPatients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reviewStatus, setReviewStatus] = useState({ error: "", success: "" });

  async function load() {
    setLoading(true);
    setError("");
    try {
      const [requestsRes, patientsRes] = await Promise.all([
        getDoctorLinkRequests(),
        fetch(`${apiUrl}/api/doctors/assigned-patients`, {
          headers: { "Content-Type": "application/json", ...authHeaders() },
        }).then(async (res) => {
          const data = await res.json().catch(() => ({}));
          if (!res.ok) throw new Error(data.message || "Failed to load assigned patients.");
          return data;
        }),
      ]);
      setPendingRequests(requestsRes.requests || []);
      setAssignedPatients(patientsRes.patients || []);
    } catch (err) {
      setError(err.message || "Failed to load patient data.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function handleReview(patientId, decision) {
    setReviewStatus({ error: "", success: "" });
    try {
      await reviewDoctorLinkRequest(patientId, decision);
      setReviewStatus({
        error: "",
        success: decision === "active" ? "Request approved." : "Request rejected.",
      });
      await load();
    } catch (err) {
      setReviewStatus({ error: err.message || "Failed to review request.", success: "" });
    }
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />

      <main className="mx-auto max-w-6xl px-6 pb-10 pt-28">
        {/* Hero */}
        <section className="rounded-[2rem] bg-gradient-to-r from-slate-900 via-sky-800 to-cyan-600 p-8 text-white shadow-xl">
          <p className="text-sm font-semibold uppercase tracking-[0.25em] text-white/75">Doctor Workspace</p>
          <h1 className="mt-3 text-4xl font-black">Patients</h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-white/85">
            Review incoming link requests and manage your active patient roster from one place.
          </p>
        </section>

        {/* Summary row */}
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Pending requests</p>
            <p className="mt-2 text-3xl font-black text-slate-900">{pendingRequests.length}</p>
            <p className="mt-1 text-sm text-slate-500">Awaiting your decision</p>
          </div>
          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Active patients</p>
            <p className="mt-2 text-3xl font-black text-slate-900">{assignedPatients.filter((r) => r.status === "active").length}</p>
            <p className="mt-1 text-sm text-slate-500">Currently linked</p>
          </div>
        </div>

        {/* Global error */}
        {error ? (
          <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        ) : null}

        {/* Review feedback */}
        {reviewStatus.error ? (
          <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {reviewStatus.error}
          </div>
        ) : null}
        {reviewStatus.success ? (
          <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            {reviewStatus.success}
          </div>
        ) : null}

        <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_1fr]">

          {/* ── Pending requests ── */}
          <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-semibold text-slate-900">Link requests</h2>
                <p className="mt-1 text-sm text-slate-500">Patients waiting for you to approve or reject.</p>
              </div>
              {pendingRequests.length > 0 ? (
                <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-700">
                  {pendingRequests.length} pending
                </span>
              ) : null}
            </div>

            <div className="mt-5 space-y-4">
              {loading ? (
                <p className="text-sm text-slate-500">Loading...</p>
              ) : pendingRequests.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-200 px-6 py-8 text-center text-sm text-slate-500">
                  No pending patient requests.
                </div>
              ) : (
                pendingRequests.map((request) => {
                  const name = patientDisplayName(request);
                  const email = request.patient?.email || "";
                  const initials = patientInitials(request);
                  const requestedAt = request.createdAt
                    ? new Date(request.createdAt).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })
                    : null;

                  return (
                    <div key={request.patientId} className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
                      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                        {/* Identity */}
                        <div className="flex items-start gap-4">
                          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-sky-100 text-sm font-bold text-sky-700">
                            {initials}
                          </div>
                          <div>
                            <p className="font-semibold text-slate-900">{name}</p>
                            {email && name !== email ? (
                              <p className="text-sm text-slate-500">{email}</p>
                            ) : null}
                            <div className="mt-2 flex flex-wrap gap-2">
                              <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs text-slate-600">
                                Patient
                              </span>
                              {requestedAt ? (
                                <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs text-slate-600">
                                  Requested {requestedAt}
                                </span>
                              ) : null}
                            </div>
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex shrink-0 gap-2">
                          <button
                            type="button"
                            onClick={() => handleReview(request.patientId, "active")}
                            className="rounded-xl bg-emerald-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-600"
                          >
                            Approve
                          </button>
                          <button
                            type="button"
                            onClick={() => handleReview(request.patientId, "rejected")}
                            className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2 text-sm font-semibold text-rose-600 transition hover:bg-rose-100"
                          >
                            Reject
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </section>

          {/* ── Assigned patients ── */}
          <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-semibold text-slate-900">Assigned patients</h2>
                <p className="mt-1 text-sm text-slate-500">All patients currently linked to your account.</p>
              </div>
              <button
                type="button"
                onClick={load}
                className="rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition"
              >
                Refresh
              </button>
            </div>

            <div className="mt-5 space-y-3">
              {loading ? (
                <p className="text-sm text-slate-500">Loading...</p>
              ) : assignedPatients.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-200 px-6 py-8 text-center text-sm text-slate-500">
                  No patients linked yet.
                </div>
              ) : (
                assignedPatients.map((record) => {
                  const name = patientDisplayName(record);
                  const email = record.patient?.email || "";
                  const initials = patientInitials(record);
                  const assignedAt = record.assignedAt
                    ? new Date(record.assignedAt).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })
                    : null;

                  return (
                    <div key={record.patient?.id} className="flex items-center gap-4 rounded-2xl border border-slate-200 p-4">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-cyan-100 text-sm font-bold text-cyan-700">
                        {initials}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-semibold text-slate-900">{name}</p>
                        {email && name !== email ? (
                          <p className="truncate text-sm text-slate-500">{email}</p>
                        ) : null}
                        {assignedAt ? (
                          <p className="mt-0.5 text-xs text-slate-400">Linked {assignedAt}</p>
                        ) : null}
                      </div>
                      <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold capitalize ${statusBadge(record.status)}`}>
                        {record.status}
                      </span>
                    </div>
                  );
                })
              )}
            </div>
          </section>
        </div>

        {/* Back link */}
        <div className="mt-8">
          <button
            type="button"
            onClick={() => navigate("/dashboardDoctor")}
            className="text-sm font-medium text-slate-500 hover:text-slate-700 transition"
          >
            ← Back to dashboard
          </button>
        </div>
      </main>
    </div>
  );
}
