import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "../components/Navbar";
import { getDoctorLinkRequests, reviewDoctorLinkRequest } from "../api/links";

function patientDisplayName(record) {
  const p = record?.patient || record;
  return [p?.firstName, p?.lastName].filter(Boolean).join(" ").trim() || p?.displayName || p?.email || "Patient";
}

function patientInitials(record) {
  const name = patientDisplayName(record).split(" ").filter(Boolean);
  if (name.length >= 2) return `${name[0][0]}${name[1][0]}`.toUpperCase();
  const email = record?.patient?.email || record?.email || "";
  return email ? email[0].toUpperCase() : "?";
}

export default function DoctorLinkRequests() {
  const navigate = useNavigate();
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [feedback, setFeedback] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    try {
      const data = await getDoctorLinkRequests();
      setRequests(data.requests || []);
    } catch (err) {
      setError(err.message || "Failed to load link requests.");
      setRequests([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function handleReview(patientId, decision) {
    setFeedback("");
    setError("");
    try {
      await reviewDoctorLinkRequest(patientId, decision);
      setFeedback(decision === 'active' ? 'Request approved.' : 'Request rejected.');
      await load();
    } catch (err) {
      setError(err.message || 'Failed to review request.');
    }
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />
      <main className="mx-auto max-w-5xl px-6 pb-10 pt-28">
        <section className="rounded-[2rem] bg-gradient-to-r from-slate-900 via-amber-700 to-orange-500 p-8 text-white shadow-xl">
          <p className="text-sm font-semibold uppercase tracking-[0.25em] text-white/75">Doctor Workspace</p>
          <h1 className="mt-3 text-4xl font-black">Link Requests</h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-white/85">Patients waiting for approval or rejection are reviewed here.</p>
          <div className="mt-5 flex flex-wrap gap-3">
            <button type="button" onClick={() => navigate('/doctor-patients')} className="rounded-xl bg-white/15 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/25">Back to patients</button>
          </div>
        </section>
        {error ? <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}
        {feedback ? <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{feedback}</div> : null}
        <section className="mt-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-semibold text-slate-900">Patients waiting for approval or rejection</h2>
              <p className="mt-1 text-sm text-slate-500">Approve only the patients you are ready to manage clinically.</p>
            </div>
            <button type="button" onClick={load} className="rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-50">Refresh</button>
          </div>
          <div className="mt-5 space-y-4">
            {loading ? <p className="text-sm text-slate-500">Loading...</p> : requests.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-200 px-6 py-8 text-center text-sm text-slate-500">No pending patient requests. Return to Patients to review your active panel or refresh later for new requests.</div>
            ) : requests.map((request) => (
              <div key={request.patientId} className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="flex items-start gap-4">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-sky-100 text-sm font-bold text-sky-700">{patientInitials(request)}</div>
                    <div>
                      <p className="font-semibold text-slate-900">{patientDisplayName(request)}</p>
                      {request.patient?.email && patientDisplayName(request) !== request.patient.email ? <p className="text-sm text-slate-500">{request.patient.email}</p> : null}
                    </div>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <button type="button" onClick={() => handleReview(request.patientId, 'active')} className="rounded-xl bg-emerald-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-600">Approve</button>
                    <button type="button" onClick={() => handleReview(request.patientId, 'rejected')} className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2 text-sm font-semibold text-rose-600 transition hover:bg-rose-100">Reject</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
