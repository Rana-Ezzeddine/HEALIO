import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "../components/Navbar";
import { apiUrl, authHeaders } from "../api/http";
import { getCaregiverLinkRequests, reviewCaregiverLinkRequest } from "../api/links";
import { setActiveCaregiverPatientId } from "../utils/caregiverPatientContext";

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

function permissionLabel(key) {
  const labels = {
    canViewMedications: "Medications",
    canViewSymptoms: "Symptoms",
    canViewAppointments: "Appointments",
    canMessageDoctor: "Doctor contact",
    canReceiveReminders: "Reminders",
  };
  return labels[key] || key;
}

export default function CaregiverPatients() {
  const navigate = useNavigate();
  const [pendingInvitations, setPendingInvitations] = useState([]);
  const [linkedPatients, setLinkedPatients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reviewStatus, setReviewStatus] = useState({ error: "", success: "" });

  async function load() {
    setLoading(true);
    setError("");
    try {
      const [patientsRes, requestsRes] = await Promise.all([
        fetch(`${apiUrl}/api/caregivers/patients`, {
          headers: { "Content-Type": "application/json", ...authHeaders() },
        }).then(async (res) => {
          const data = await res.json().catch(() => ({}));
          if (!res.ok) throw new Error(data.message || "Failed to load your patients.");
          return data;
        }),
        getCaregiverLinkRequests(),
      ]);

      setLinkedPatients(patientsRes.patients || []);
      setPendingInvitations(requestsRes.requests || []);
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
      await reviewCaregiverLinkRequest(patientId, decision);

      setReviewStatus({
        error: "",
        success: decision === "active" ? "Invitation accepted! You can now manage this patient." : "Invitation declined.",
      });
      await load();
    } catch (err) {
      setReviewStatus({ error: err.message || "Failed to respond to invitation.", success: "" });
    }
  }

  async function handleSwitchContext(patientId) {
    setActiveCaregiverPatientId(patientId);
    navigate("/dashboardCaregiver");
  }

  const activePatients = useMemo(
    () => linkedPatients.slice().sort((a, b) => {
      const aName = patientDisplayName(a);
      const bName = patientDisplayName(b);
      return aName.localeCompare(bName);
    }),
    [linkedPatients]
  );

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />

      <main className="mx-auto max-w-6xl px-6 pb-10 pt-28">
        {/* Hero */}
        <section className="rounded-[2rem] bg-gradient-to-r from-slate-900 via-emerald-800 to-teal-600 p-8 text-white shadow-xl">
          <p className="text-sm font-semibold uppercase tracking-[0.25em] text-white/75">Caregiver Workspace</p>
          <h1 className="mt-3 text-4xl font-black">My Patients</h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-white/85">
            Accept invitations and switch patient context from one place.
          </p>
        </section>

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

          {/* ── Pending invitations ── */}
          <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-semibold text-slate-900">Pending invitations</h2>
                <p className="mt-1 text-sm text-slate-500">Patients offering to add you as a caregiver.</p>
              </div>
              {pendingInvitations.length > 0 ? (
                <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-700">
                  {pendingInvitations.length} new
                </span>
              ) : null}
            </div>

            <div className="mt-5 space-y-4">
              {loading ? (
                <p className="text-sm text-slate-500">Loading...</p>
              ) : pendingInvitations.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-200 px-6 py-8 text-center text-sm text-slate-500">
                  No pending invitations. Once a patient adds you, they'll appear here.
                </div>
              ) : (
                pendingInvitations.map((invitation) => {
                  const name = patientDisplayName(invitation);
                  const email = invitation.patient?.email || "";
                  const initials = patientInitials(invitation);
                  const invitedAt = invitation.createdAt
                    ? new Date(invitation.createdAt).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })
                    : null;

                  return (
                    <div key={invitation.patientId} className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
                      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                        {/* Identity */}
                        <div className="flex items-start gap-4">
                          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-sm font-bold text-emerald-700">
                            {initials}
                          </div>
                          <div>
                            <p className="font-semibold text-slate-900">{name}</p>
                            {email && name !== email ? (
                              <p className="text-sm text-slate-500">{email}</p>
                            ) : null}
                            <div className="mt-2 flex flex-wrap gap-2">
                              <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs text-slate-600">
                                Inviting you
                              </span>
                              {invitedAt ? (
                                <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs text-slate-600">
                                  Sent {invitedAt}
                                </span>
                              ) : null}
                            </div>
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex shrink-0 gap-2">
                          <button
                            type="button"
                            onClick={() => handleReview(invitation.patientId, "active")}
                            className="rounded-xl bg-emerald-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-600"
                          >
                            Accept
                          </button>
                          <button
                            type="button"
                            onClick={() => handleReview(invitation.patientId, "rejected")}
                            className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2 text-sm font-semibold text-rose-600 transition hover:bg-rose-100"
                          >
                            Decline
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </section>

          {/* ── Active patients ── */}
          <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-semibold text-slate-900">Active patients</h2>
                <p className="mt-1 text-sm text-slate-500">All patients you're currently supporting.</p>
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
              ) : activePatients.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-200 px-6 py-8 text-center text-sm text-slate-500">
                  No active patients yet. Accept an invitation to get started.
                </div>
              ) : (
                activePatients.map((record) => {
                  const name = patientDisplayName(record);
                  const email = record.patient?.email || "";
                  const initials = patientInitials(record);
                  const permissions = record.permissions || {};

                  return (
                    <button
                      key={record.patient?.id}
                      type="button"
                      onClick={() => handleSwitchContext(record.patient?.id)}
                      className="w-full rounded-2xl border border-slate-200 bg-white p-4 text-left transition hover:border-emerald-300 hover:bg-emerald-50"
                    >
                      <div className="flex items-start gap-4">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-teal-100 text-sm font-bold text-teal-700">
                          {initials}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-semibold text-slate-900">{name}</p>
                          {email && name !== email ? (
                            <p className="truncate text-xs text-slate-500">{email}</p>
                          ) : null}
                          <div className="mt-2 flex flex-wrap gap-1">
                            {Object.entries(permissions).map(([key, enabled]) => (
                              <span
                                key={key}
                                className={`rounded-full px-2 py-1 text-xs font-semibold ${
                                  enabled
                                    ? "bg-emerald-100 text-emerald-700"
                                    : "bg-slate-100 text-slate-600"
                                }`}
                              >
                                {permissionLabel(key)}
                              </span>
                            ))}
                          </div>
                        </div>
                        <span className="shrink-0 text-xs text-slate-400">View</span>
                      </div>
                    </button>
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
            onClick={() => navigate("/dashboardCaregiver")}
            className="text-sm font-medium text-slate-500 hover:text-slate-700 transition"
          >
            ← Back to dashboard
          </button>
        </div>
      </main>
    </div>
  );
}
