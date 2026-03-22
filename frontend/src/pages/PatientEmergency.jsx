import { useEffect, useState } from "react";
import Navbar from "../components/Navbar";
import { getEmergencyCard, triggerEmergencyAlert, updateEmergencyStatus } from "../api/emergency";
import { apiUrl, authHeaders } from "../api/http";

export default function PatientEmergency() {
  const [profile, setProfile] = useState(null);
  const [reason, setReason] = useState("");
  const [status, setStatus] = useState({ loading: true, error: "", success: "" });
  const [submitting, setSubmitting] = useState(false);

  async function loadData() {
    setStatus((current) => ({ ...current, loading: true, error: "" }));
    try {
      const [card, profileResponse] = await Promise.all([
        getEmergencyCard(),
        fetch(`${apiUrl}/api/profile`, {
          headers: { "Content-Type": "application/json", ...authHeaders() },
        }).then(async (response) => {
          if (response.status === 404) return {};
          return response.json().catch(() => ({}));
        }),
      ]);
      setProfile({
        ...card,
        emergencyStatus: Boolean(profileResponse.emergencyStatus),
        emergencyStatusUpdatedAt: profileResponse.emergencyStatusUpdatedAt || null,
      });
      setStatus({ loading: false, error: "", success: "" });
    } catch (error) {
      setStatus({ loading: false, error: error.message || "Failed to load emergency details.", success: "" });
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  async function handleStatusChange(nextValue) {
    try {
      setSubmitting(true);
      const data = await updateEmergencyStatus(nextValue);
      setProfile((current) => ({
        ...(current || {}),
        emergencyStatus: data.emergencyStatus,
        emergencyStatusUpdatedAt: data.emergencyStatusUpdatedAt,
      }));
      setStatus((current) => ({
        ...current,
        error: "",
        success: nextValue ? "Emergency status is now active." : "Emergency status has been cleared.",
      }));
    } catch (error) {
      setStatus((current) => ({
        ...current,
        error: error.message || "Failed to update emergency status.",
        success: "",
      }));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleTriggerAlert() {
    try {
      setSubmitting(true);
      const data = await triggerEmergencyAlert(reason);
      setProfile((current) => ({
        ...(current || {}),
        emergencyStatus: true,
      }));
      setStatus((current) => ({
        ...current,
        error: "",
        success: `Emergency alert processed. ${data.alertsSent} doctor alert(s) sent.`,
      }));
      setReason("");
    } catch (error) {
      setStatus((current) => ({
        ...current,
        error: error.message || "Failed to trigger emergency alert.",
        success: "",
      }));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-rose-50">
      <Navbar />

      <main className="mx-auto max-w-5xl px-6 pb-10 pt-28">
        <section className="rounded-[2rem] bg-gradient-to-r from-rose-700 via-red-600 to-orange-500 p-8 text-white shadow-xl">
          <p className="text-sm font-semibold uppercase tracking-[0.25em] text-white/75">Emergency Access</p>
          <h1 className="mt-3 text-4xl font-black">One place for urgent status and emergency details.</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-white/90">
            Turn on emergency mode when you need immediate attention, then notify your linked doctor directly.
          </p>
        </section>

        {status.error ? (
          <div className="mt-6 rounded-2xl border border-red-200 bg-white px-4 py-3 text-sm text-red-700">
            {status.error}
          </div>
        ) : null}
        {status.success ? (
          <div className="mt-6 rounded-2xl border border-emerald-200 bg-white px-4 py-3 text-sm text-emerald-700">
            {status.success}
          </div>
        ) : null}

        <section className="mt-6 grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="rounded-3xl bg-white p-6 shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-2xl font-semibold text-slate-900">Emergency card</h2>
                <p className="mt-1 text-sm text-slate-500">This is the information your care team needs fast.</p>
              </div>
              <span className={`rounded-full px-3 py-1 text-xs font-semibold ${profile?.emergencyStatus ? "bg-rose-100 text-rose-700" : "bg-emerald-100 text-emerald-700"}`}>
                {profile?.emergencyStatus ? "Emergency active" : "Normal status"}
              </span>
            </div>

            {status.loading ? (
              <p className="mt-6 text-sm text-slate-500">Loading emergency profile...</p>
            ) : (
              <div className="mt-6 grid gap-4 sm:grid-cols-2">
                <div className="rounded-2xl bg-slate-50 p-4">
                  <p className="text-xs uppercase tracking-wide text-slate-500">Patient</p>
                  <p className="mt-2 font-semibold text-slate-900">{profile?.fullName || "Unknown"}</p>
                  <p className="mt-1 text-sm text-slate-600">{profile?.email || "No email on file"}</p>
                </div>
                <div className="rounded-2xl bg-slate-50 p-4">
                  <p className="text-xs uppercase tracking-wide text-slate-500">Blood Type</p>
                  <p className="mt-2 font-semibold text-slate-900">{profile?.bloodType || "Unknown"}</p>
                  <p className="mt-1 text-sm text-slate-600">DOB: {profile?.dateOfBirth || "Not set"}</p>
                </div>
                <div className="rounded-2xl bg-slate-50 p-4">
                  <p className="text-xs uppercase tracking-wide text-slate-500">Allergies</p>
                  <p className="mt-2 text-sm text-slate-700">
                    {profile?.allergies?.length ? profile.allergies.join(", ") : "No allergies recorded"}
                  </p>
                </div>
                <div className="rounded-2xl bg-slate-50 p-4">
                  <p className="text-xs uppercase tracking-wide text-slate-500">Conditions</p>
                  <p className="mt-2 text-sm text-slate-700">
                    {profile?.chronicConditions?.length ? profile.chronicConditions.join(", ") : "No chronic conditions recorded"}
                  </p>
                </div>
                <div className="rounded-2xl bg-slate-50 p-4 sm:col-span-2">
                  <p className="text-xs uppercase tracking-wide text-slate-500">Emergency contact</p>
                  <p className="mt-2 text-sm text-slate-700">
                    {profile?.emergencyContact
                      ? `${profile.emergencyContact.name} (${profile.emergencyContact.relationship}) - ${profile.emergencyContact.phoneNumber}`
                      : "No emergency contact saved"}
                  </p>
                </div>
              </div>
            )}
          </div>

          <div className="rounded-3xl bg-white p-6 shadow-sm">
            <h2 className="text-2xl font-semibold text-slate-900">Actions</h2>
            <p className="mt-1 text-sm text-slate-500">Use these controls when you need to signal urgent follow-up.</p>

            <div className="mt-6 space-y-3">
              <button
                type="button"
                disabled={submitting}
                onClick={() => handleStatusChange(true)}
                className="w-full rounded-2xl bg-rose-600 px-4 py-3 text-sm font-semibold text-white hover:bg-rose-700 transition disabled:opacity-70"
              >
                Activate emergency status
              </button>
              <button
                type="button"
                disabled={submitting}
                onClick={() => handleStatusChange(false)}
                className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition disabled:opacity-70"
              >
                Clear emergency status
              </button>
            </div>

            <div className="mt-6 rounded-2xl bg-rose-50 p-4">
              <label className="text-sm font-medium text-slate-800">Alert reason for doctor</label>
              <textarea
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                rows={4}
                placeholder="Describe what is happening right now..."
                className="mt-2 w-full rounded-2xl border border-rose-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-400"
              />
              <button
                type="button"
                disabled={submitting}
                onClick={handleTriggerAlert}
                className="mt-3 w-full rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white hover:bg-slate-800 transition disabled:opacity-70"
              >
                Notify linked doctors
              </button>
            </div>

            <p className="mt-4 text-xs text-slate-500">
              Last updated: {profile?.emergencyStatusUpdatedAt ? new Date(profile.emergencyStatusUpdatedAt).toLocaleString() : "Never"}
            </p>
          </div>
        </section>
      </main>
    </div>
  );
}
