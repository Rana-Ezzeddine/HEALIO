
import Navbar from "../components/Navbar";

const ALLOWED = [
  { key: "canViewMedications",  label: "View Medications",   desc: "See the patient's medication list and schedule." },
  { key: "canViewSymptoms",     label: "View Symptoms",      desc: "See the patient's logged symptoms and history." },
  { key: "canViewAppointments", label: "View Appointments",  desc: "See the patient's upcoming and past appointments." },
  { key: "canReceiveReminders", label: "Receive Reminders",  desc: "Get reminders for the patient's medications and appointments." },
  { key: "canMessageDoctor",    label: "Message Doctor",     desc: "Send messages to the patient's doctor when the patient allows." },
];

const NOT_ALLOWED = [
  "Diagnosing the patient",
  "Prescribing or recommending medications",
  "Editing the patient's treatment plan",
  "Accessing data the patient has not permitted",
];

export default function CaregiverPermissions({ grantedPermissions = {} }) {
  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />
      <main className="pt-28 max-w-2xl mx-auto px-6 py-8">
        <h1 className="text-3xl font-bold text-slate-800 mb-1">Your Permissions</h1>
        <p className="text-slate-500 mb-8">
          Your role is to support, coordinate, remind, observe, report, and escalate.
          Everything below depends on what your patient has allowed.
        </p>

        <div className="bg-white rounded-3xl shadow p-6 mb-6">
          <h2 className="text-lg font-semibold text-slate-800 mb-4">What you can do</h2>
          <div className="space-y-3">
            {ALLOWED.map(({ key, label, desc }) => (
              <div key={key} className="flex items-start gap-3">
                <span className="mt-0.5">
                  {grantedPermissions[key] ? "✅" : "⬜"}
                </span>
                <div>
                  <p className="text-sm font-medium text-slate-700">{label}</p>
                  <p className="text-xs text-slate-400">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-red-50 rounded-3xl p-6">
          <h2 className="text-lg font-semibold text-red-700 mb-4">What you cannot do</h2>
          <ul className="space-y-2">
            {NOT_ALLOWED.map((item) => (
              <li key={item} className="flex items-center gap-2 text-sm text-red-600">
                <span>🚫</span> {item}
              </li>
            ))}
          </ul>
        </div>
      </main>
    </div>
  );
}