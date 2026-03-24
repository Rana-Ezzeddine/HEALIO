import { useEffect, useMemo, useState } from "react";
import Navbar from "../components/Navbar";
import { listDoctorApplications, reviewDoctorApplication } from "../api/doctorReview";

const FILTERS = [
  { value: "pending_approval", label: "Pending approval" },
  { value: "all", label: "All" },
  { value: "rejected", label: "Rejected" },
  { value: "approved", label: "Approved" },
  { value: "unverified", label: "Unverified" },
];

const statusPill = {
  pending_approval: "bg-sky-100 text-sky-800 border-sky-200",
  approved: "bg-emerald-100 text-emerald-800 border-emerald-200",
  rejected: "bg-rose-100 text-rose-800 border-rose-200",
  unverified: "bg-amber-100 text-amber-800 border-amber-200",
};

function formatStatus(application) {
  if (!application) return "";
  if (application.requestedMoreInfo && application.status === "pending_approval") {
    return "More info requested";
  }
  return application.status.replaceAll("_", " ");
}

function formatDate(value) {
  if (!value) return "Not available";
  try {
    return new Date(value).toLocaleString();
  } catch {
    return value;
  }
}

function ApplicationField({ label, value }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
      <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">{label}</p>
      <p className="mt-1 text-sm font-medium text-slate-700">{value || "Not provided"}</p>
    </div>
  );
}

function normalizeNotesHistory(application) {
  const history = application?.notesHistory;
  if (Array.isArray(history)) {
    return history
      .map((item) => ({
        text: item?.note || item?.notes || item?.text || "",
        createdAt: item?.createdAt || item?.updatedAt || "",
      }))
      .filter((item) => item.text);
  }

  if (application?.notes) {
    return [{ text: application.notes, createdAt: application?.reviewedAt || "" }];
  }

  return [];
}

export default function DoctorReviewPage() {
  const [statusFilter, setStatusFilter] = useState("pending_approval");
  const [applications, setApplications] = useState([]);
  const [selectedId, setSelectedId] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState("");
  const [rejectNotesWarning, setRejectNotesWarning] = useState("");

  async function loadApplications(filter = statusFilter, preserveSelection = true) {
    setError("");
    setSuccess("");
    setLoading(true);

    try {
      const data = await listDoctorApplications(filter);
      const nextApplications = data.applications || [];
      setApplications(nextApplications);

      const nextSelected =
        preserveSelection && nextApplications.some((item) => item.id === selectedId)
          ? selectedId
          : nextApplications[0]?.id || "";
      setSelectedId(nextSelected);
      setNotes(nextApplications.find((item) => item.id === nextSelected)?.notes || "");
    } catch (err) {
      setError(err?.status === 403 ? "Reviewer access is required for this page." : err?.message || "Failed to load doctor applications.");
      setApplications([]);
      setSelectedId("");
      setNotes("");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadApplications(statusFilter, false);
  }, [statusFilter]);

  const selectedApplication = useMemo(
    () => applications.find((item) => item.id === selectedId) || null,
    [applications, selectedId]
  );
  const notesHistory = useMemo(() => normalizeNotesHistory(selectedApplication), [selectedApplication]);

  useEffect(() => {
    setNotes(selectedApplication?.notes || "");
    setRejectNotesWarning("");
  }, [selectedApplication?.id]);

  async function handleDecision(decision) {
    if (!selectedApplication) return;
    if (decision === "request_more_info" && !notes.trim()) {
      setError("Notes are required when requesting more information.");
      return;
    }
    if (decision === "reject" && !notes.trim()) {
      setRejectNotesWarning("Adding reviewer notes is strongly encouraged when rejecting an application.");
    } else {
      setRejectNotesWarning("");
    }

    setError("");
    setSuccess("");
    setSubmitting(decision);

    try {
      const data = await reviewDoctorApplication(selectedApplication.id, decision, notes.trim());
      setSuccess(data?.message || "Doctor application updated.");
      await loadApplications(statusFilter);
    } catch (err) {
      setError(err?.message || "Failed to update doctor application.");
    } finally {
      setSubmitting("");
    }
  }

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#f8fbfd_0%,#eef7fb_100%)]">
      <Navbar />
      <main className="mx-auto max-w-7xl px-6 pb-20 pt-32">
        <div className="rounded-[2rem] border border-white/70 bg-white/85 p-8 shadow-[0_35px_80px_-45px_rgba(15,23,42,0.35)] backdrop-blur-md">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.24em] text-sky-500">Reviewer workspace</p>
              <h1 className="mt-3 text-4xl font-black tracking-tight text-slate-900">Doctor Applications</h1>
              <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-600">
                Review pending doctor applications, capture reviewer notes, and decide whether to approve, reject, or request more information.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {FILTERS.map((filter) => (
                <button
                  key={filter.value}
                  type="button"
                  onClick={() => setStatusFilter(filter.value)}
                  className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                    statusFilter === filter.value
                      ? "bg-slate-900 text-white"
                      : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  {filter.label}
                </button>
              ))}
            </div>
          </div>

          {error ? (
            <div className="mt-6 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {error}
            </div>
          ) : null}

          {success ? (
            <div className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
              {success}
            </div>
          ) : null}

          <div className="mt-8 grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
            <section className="rounded-[1.75rem] border border-slate-200 bg-slate-50/80 p-4">
              <div className="mb-4 flex items-center justify-between px-2">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Applications</p>
                <p className="text-sm text-slate-500">{applications.length} loaded</p>
              </div>

              <div className="space-y-3">
                {loading ? (
                  <div className="rounded-2xl border border-slate-200 bg-white px-4 py-6 text-sm text-slate-500">
                    Loading applications...
                  </div>
                ) : applications.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-4 py-8 text-center text-sm text-slate-500">
                    No doctor applications found for this filter.
                  </div>
                ) : (
                  applications.map((application) => (
                    <button
                      key={application.id}
                      type="button"
                      onClick={() => setSelectedId(application.id)}
                      className={`w-full rounded-[1.5rem] border px-4 py-4 text-left transition ${
                        selectedId === application.id
                          ? "border-sky-300 bg-sky-50 shadow-sm"
                          : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
                      }`}
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="text-base font-semibold text-slate-900">
                            {[application.profile?.firstName, application.profile?.lastName].filter(Boolean).join(" ") || "Unnamed doctor"}
                          </p>
                          <p className="mt-1 text-sm text-slate-500">{application.email}</p>
                        </div>
                        <span className={`rounded-full border px-3 py-1 text-xs font-semibold capitalize ${statusPill[application.status] || "bg-slate-100 text-slate-700 border-slate-200"}`}>
                          {formatStatus(application)}
                        </span>
                      </div>
                      <div className="mt-4 grid gap-3 text-sm text-slate-600 md:grid-cols-2">
                        <p>License: {application.profile?.licenseNb || "Missing"}</p>
                        <p>Specialization: {application.profile?.specialization || "Not provided"}</p>
                        <p>Created: {formatDate(application.createdAt)}</p>
                        <p>Reviewed: {formatDate(application.reviewedAt)}</p>
                      </div>
                    </button>
                  ))
                )}
              </div>
            </section>

            <section className="rounded-[1.75rem] border border-slate-200 bg-white p-6">
              {selectedApplication ? (
                <>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Application detail</p>
                      <h2 className="mt-2 text-2xl font-black tracking-tight text-slate-900">
                        {[selectedApplication.profile?.firstName, selectedApplication.profile?.lastName].filter(Boolean).join(" ") || "Doctor application"}
                      </h2>
                    </div>
                    <span className={`rounded-full border px-3 py-1 text-xs font-semibold capitalize ${statusPill[selectedApplication.status] || "bg-slate-100 text-slate-700 border-slate-200"}`}>
                      {formatStatus(selectedApplication)}
                    </span>
                  </div>

                  <div className="mt-6 grid gap-4 md:grid-cols-2">
                    <ApplicationField label="Email" value={selectedApplication.email} />
                    <ApplicationField label="License number" value={selectedApplication.profile?.licenseNb} />
                    <ApplicationField label="Specialization" value={selectedApplication.profile?.specialization} />
                    <ApplicationField label="Years of experience" value={selectedApplication.profile?.yearsOfExperience ? `${selectedApplication.profile.yearsOfExperience}` : ""} />
                    <ApplicationField label="Clinic name" value={selectedApplication.profile?.clinicName} />
                    <ApplicationField label="Created" value={formatDate(selectedApplication.createdAt)} />
                    <div className="md:col-span-2">
                      <ApplicationField label="Clinic address" value={selectedApplication.profile?.clinicAddress} />
                    </div>
                  </div>

                  <div className="mt-6 rounded-3xl border border-slate-200 bg-slate-50 px-5 py-4">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">Reviewer notes</p>
                      {selectedApplication.requestedMoreInfo ? (
                        <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700">
                          More info requested
                        </span>
                      ) : null}
                    </div>
                    <textarea
                      value={notes}
                      onChange={(event) => setNotes(event.target.value)}
                      rows={6}
                      placeholder="Add reviewer notes, approval rationale, or the information needed from the doctor."
                      className="mt-4 w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-sky-400 focus:ring-2 focus:ring-sky-200"
                    />
                    {rejectNotesWarning ? (
                      <p className="mt-3 text-xs font-semibold text-amber-700">{rejectNotesWarning}</p>
                    ) : null}
                  </div>

                  <div className="mt-4 rounded-3xl border border-slate-200 bg-white px-5 py-4">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">Reviewer notes history</p>
                    {notesHistory.length === 0 ? (
                      <p className="mt-3 text-sm text-slate-500">No reviewer notes history yet.</p>
                    ) : (
                      <div className="mt-3 space-y-3">
                        {notesHistory.map((entry, index) => (
                          <div key={`${selectedApplication.id}-note-${index}`} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                            {entry.createdAt ? (
                              <p className="text-xs text-slate-500">{formatDate(entry.createdAt)}</p>
                            ) : null}
                            <p className="mt-1 text-sm text-slate-700">{entry.text}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="mt-6 grid gap-3 md:grid-cols-3">
                    <button
                      type="button"
                      onClick={() => handleDecision("approve")}
                      disabled={Boolean(submitting)}
                      className="h-12 rounded-2xl bg-emerald-500 text-sm font-semibold text-white transition hover:bg-emerald-600 disabled:opacity-70"
                    >
                      {submitting === "approve" ? "Approving..." : "Approve"}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDecision("reject")}
                      disabled={Boolean(submitting)}
                      className="h-12 rounded-2xl bg-rose-500 text-sm font-semibold text-white transition hover:bg-rose-600 disabled:opacity-70"
                    >
                      {submitting === "reject" ? "Rejecting..." : "Reject"}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDecision("request_more_info")}
                      disabled={Boolean(submitting)}
                      className="h-12 rounded-2xl border border-sky-300 bg-sky-50 text-sm font-semibold text-sky-700 transition hover:bg-sky-100 disabled:opacity-70"
                    >
                      {submitting === "request_more_info" ? "Saving..." : "Request More Information"}
                    </button>
                  </div>
                </>
              ) : (
                <div className="flex min-h-[420px] items-center justify-center rounded-[1.5rem] border border-dashed border-slate-300 bg-slate-50 text-sm text-slate-500">
                  Select an application to review.
                </div>
              )}
            </section>
          </div>
        </div>
      </main>
    </div>
  );
}
