
import { useEffect, useState } from "react";
import Navbar from "../components/Navbar";
import { apiUrl, authHeaders } from "../api/http";

export default function CareTeam() {
  const [caregivers, setCaregivers] = useState([]);
  const [doctorEmail, setDoctorEmail] = useState("");
  const [permissions, setPermissions] = useState({
    canViewMedications: false,
    canViewSymptoms: false,
    canViewAppointments: false,
    canMessageDoctor: false,
    canReceiveReminders: false,
  });
  const [message, setMessage] = useState(null);
  const [loading, setLoading] = useState(false);

  // Load existing caregivers — GET /api/caregiver/assignments/mine
  useEffect(() => {
    fetch(`${apiUrl}/api/caregiver/assignments/mine`, {
      headers: { ...authHeaders() },
    })
      .then((r) => r.json())
      .then((data) => setCaregivers(data.caregivers || []))
      .catch(() => setMessage("Could not load care team."));
  }, []);

  const handleAssign = async () => {
    if (!doctorEmail.trim()) return;
    setLoading(true);
    setMessage(null);
    try {
      const res = await fetch(`${apiUrl}/api/caregiver/assignments`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({
          caregiverEmail: doctorEmail.trim(),
          permissions,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      setMessage("Caregiver added to your care team.");
      setDoctorEmail("");
      // Refresh list
      const updated = await fetch(`${apiUrl}/api/caregiver/assignments/mine`, {
        headers: { ...authHeaders() },
      }).then((r) => r.json());
      setCaregivers(updated.caregivers || []);
    } catch (err) {
      setMessage(err.message || "Could not assign caregiver.");
    } finally {
      setLoading(false);
    }
  };

  // Remove caregiver — DELETE /api/caregiver/assignments/:caregiverId
  const handleRemove = async (caregiverId) => {
    try {
      await fetch(`${apiUrl}/api/caregiver/assignments/${caregiverId}`, {
        method: "DELETE",
        headers: { ...authHeaders() },
      });
      setCaregivers((prev) =>
        prev.filter((c) => c.caregiver.id !== caregiverId)
      );
    } catch {
      setMessage("Could not remove caregiver.");
    }
  };

  const PERMISSION_LABELS = {
    canViewMedications: "View Medications",
    canViewSymptoms: "View Symptoms",
    canViewAppointments: "View Appointments",
    canMessageDoctor: "Message Doctor",
    canReceiveReminders: "Receive Reminders",
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />
      <main className="pt-28 max-w-3xl mx-auto px-6 py-8">
        <h1 className="text-3xl font-bold text-slate-800 mb-1">Care Team</h1>
        <p className="text-slate-500 mb-8">
          Manage who supports you. Invite a caregiver by email and control exactly
          what they can see.
        </p>

        {message && (
          <div className="mb-4 rounded-xl bg-sky-50 px-4 py-3 text-sm text-sky-700">
            {message}
          </div>
        )}

        {/* Current caregivers (5.4.d — statuses) */}
        <section className="bg-white rounded-3xl shadow p-6 mb-6">
          <h2 className="text-lg font-semibold text-slate-800 mb-4">
            Your Caregivers
          </h2>
          {caregivers.length === 0 ? (
            <p className="text-slate-400 text-sm">
              No caregivers linked yet. Invite one below.
            </p>
          ) : (
            caregivers.map((entry) => (
              <div
                key={entry.caregiver.id}
                className="flex items-center justify-between border-b border-slate-100 py-3 last:border-0"
              >
                <div>
                  <p className="text-sm font-medium text-slate-700">
                    {entry.caregiver.email}
                  </p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {Object.entries(entry.permissions)
                      .filter(([, v]) => v)
                      .map(([k]) => PERMISSION_LABELS[k])
                      .join(", ") || "No permissions granted"}
                  </p>
                </div>
                <button
                  onClick={() => handleRemove(entry.caregiver.id)}
                  className="text-xs text-red-500 hover:text-red-700 transition"
                >
                  Remove
                </button>
              </div>
            ))
          )}
        </section>

        {/* Invite caregiver (5.4.a, 5.5.a) */}
        <section className="bg-white rounded-3xl shadow p-6">
          <h2 className="text-lg font-semibold text-slate-800 mb-4">
            Invite a Caregiver
          </h2>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Caregiver Email
          </label>
          <input
            type="email"
            placeholder="caregiver@email.com"
            value={doctorEmail}
            onChange={(e) => setDoctorEmail(e.target.value)}
            className="w-full border border-slate-200 rounded-xl px-4 py-2 text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-sky-400"
          />

          {/* Permissions (5.6.f — plain language) */}
          <p className="text-sm font-medium text-slate-700 mb-2">
            What this caregiver can access:
          </p>
          <div className="space-y-2 mb-6">
            {Object.entries(PERMISSION_LABELS).map(([key, label]) => (
              <label key={key} className="flex items-center gap-2 text-sm text-slate-600">
                <input
                  type="checkbox"
                  checked={permissions[key]}
                  onChange={(e) =>
                    setPermissions((prev) => ({
                      ...prev,
                      [key]: e.target.checked,
                    }))
                  }
                  className="rounded"
                />
                {label}
              </label>
            ))}
          </div>

          <button
            onClick={handleAssign}
            disabled={loading}
            className="rounded-xl bg-sky-500 px-6 py-2 text-sm font-semibold text-white hover:bg-sky-600 transition disabled:opacity-50"
          >
            {loading ? "Sending..." : "Send Invitation"}
          </button>
        </section>
      </main>
    </div>
  );
}