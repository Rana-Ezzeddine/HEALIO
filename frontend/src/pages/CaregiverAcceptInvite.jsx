import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import Navbar from "../components/Navbar";
import { resolveInviteToken, acceptInviteToken, rejectInviteToken } from "../api/caregiver";

const STATUS_LABELS = {
  pending: "Pending",
  active: "Active",
  rejected: "Rejected",
  expired: "Expired",
};

export default function CaregiverAcceptInvite() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [token, setToken] = useState(searchParams.get("token") || "");
  const [preview, setPreview] = useState(null);
  const [error, setError] = useState(null);
  const [finalStatus, setFinalStatus] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const t = searchParams.get("token");
    if (t) handleResolve(t);
  }, []);

  const handleResolve = async (t) => {
    setError(null);
    const resolveToken = t || token;
    if (!resolveToken.trim()) return;
    setLoading(true);
    try {
      const data = await resolveInviteToken(resolveToken.trim());
      setPreview({ ...data, token: resolveToken.trim() });
    } catch (err) {
      setError(err.message || "Invalid or expired invite link.");
    } finally {
      setLoading(false);
    }
  };

  const handleAccept = async () => {
    setLoading(true);
    try {
      await acceptInviteToken(preview.token);
      if (preview.patient?.email) {
        localStorage.setItem("linkedPatientName", preview.patient.email);
      }
      setFinalStatus("active");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleReject = async () => {
    setLoading(true);
    try {
      await rejectInviteToken(preview.token);
      setFinalStatus("rejected");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (finalStatus === "active") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-sky-50 via-white to-indigo-50">
        <Navbar />
        <main className="mx-auto max-w-lg px-6 pt-28 pb-10 text-center">
          <div className="rounded-3xl bg-white p-8 shadow-sm border border-slate-200">
            <p className="text-5xl mb-4">✅</p>
            <h1 className="text-2xl font-bold text-slate-800 mb-2">You're now linked!</h1>
            <p className="text-slate-500 mb-2">
              You are now linked to{" "}
              <strong>
                {[preview?.patient?.firstName, preview?.patient?.lastName]
                  .filter(Boolean)
                  .join(" ") || preview?.patient?.email}
              </strong>
              .
            </p>
            {/* show status badge */}
            <span className="inline-block rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700 mb-6">
              {STATUS_LABELS.active}
            </span>
            <div>
              <button
                onClick={() => navigate("/dashboardCaregiver")}
                className="rounded-xl bg-sky-500 px-6 py-2 text-sm font-semibold text-white hover:bg-sky-600 transition"
              >
                Go to Dashboard
              </button>
            </div>
          </div>
        </main>
      </div>
    );
  }

  if (finalStatus === "rejected") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-sky-50 via-white to-indigo-50">
        <Navbar />
        <main className="mx-auto max-w-lg px-6 pt-28 pb-10 text-center">
          <div className="rounded-3xl bg-white p-8 shadow-sm border border-slate-200">
            <p className="text-5xl mb-4">❌</p>
            <h1 className="text-xl font-bold text-slate-800 mb-2">Invitation Declined</h1>
            <span className="inline-block rounded-full bg-red-100 px-3 py-1 text-xs font-semibold text-red-700 mb-4">
              {STATUS_LABELS.rejected}
            </span>
            <p className="text-slate-500 mb-6">
              You have declined the invitation from{" "}
              {preview?.patient?.email || "this patient"}.
            </p>
            <button
              onClick={() => navigate("/dashboardCaregiver")}
              className="rounded-xl border border-slate-300 px-6 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition"
            >
              Back to Dashboard
            </button>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-sky-50 via-white to-indigo-50">
      <Navbar />
      <main className="mx-auto max-w-lg px-6 pt-28 pb-10">
        <div className="rounded-3xl bg-white p-8 shadow-sm border border-slate-200">
          <h1 className="text-2xl font-bold text-slate-800 mb-2">Connect to a Patient</h1>
          {/*enter patient invite link */}
          <p className="text-slate-500 mb-6">
            Enter the invite link your patient shared with you.
          </p>

          {!preview && (
            <div className="mb-4">
              <input
                type="text"
                placeholder="Paste invite link or token here"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                className="w-full rounded-xl border border-slate-300 px-4 py-2 text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-sky-500"
              />
              <button
                onClick={() => handleResolve()}
                disabled={loading || !token.trim()}
                className="rounded-xl bg-sky-500 px-6 py-2 text-sm font-semibold text-white hover:bg-sky-600 transition disabled:opacity-40"
              >
                {loading ? "Looking up..." : "Look Up Invitation"}
              </button>
            </div>
          )}

          {error && (
            <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          {/* show patient identity, relationship, permissions before acceptance */}
          {preview && (
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
              <h2 className="text-sm font-semibold text-slate-700 mb-3">
                Invitation Details
              </h2>
              <div className="space-y-2 mb-4">
                <p className="text-sm text-slate-600">
                  <span className="font-medium">Patient:</span>{" "}
                  {[preview.patient?.firstName, preview.patient?.lastName]
                    .filter(Boolean)
                    .join(" ") || preview.patient?.email}
                </p>
                <p className="text-sm text-slate-600">
                  <span className="font-medium">Email:</span> {preview.patient?.email}
                </p>
                {/* status badge */}
                <p className="text-sm text-slate-600">
                  <span className="font-medium">Status:</span>{" "}
                  <span className="inline-block rounded-full bg-yellow-100 px-2 py-0.5 text-xs font-semibold text-yellow-700">
                    {STATUS_LABELS[preview.status] ?? preview.status}
                  </span>
                </p>
                <p className="text-xs text-slate-400">
                  Expires: {new Date(preview.expiresAt).toLocaleDateString()}
                </p>
              </div>
              {/* actions depend on patient permissions */}
              <p className="text-xs text-slate-400 mb-4">
                By accepting, you agree to support this patient within the
                permissions they have set. Your access depends on what the
                patient allows.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={handleReject}
                  disabled={loading}
                  className="flex-1 rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 transition disabled:opacity-40"
                >
                  Decline
                </button>
                <button
                  onClick={handleAccept}
                  disabled={loading}
                  className="flex-1 rounded-xl bg-sky-500 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-600 transition disabled:opacity-40"
                >
                  {loading ? "Accepting..." : "Accept"}
                </button>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}