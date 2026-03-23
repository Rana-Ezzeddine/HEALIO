
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "../components/Navbar";

const STEPS = [
  {
    id: "profile",
    title: "Complete Your Profile",
    description:
      "Add your name and contact details so your patient knows who you are.",
  },
  {
    id: "invite",
    title: "Connect to a Patient",
    description:
      "Enter the invite link sent by your patient, or check for a pending invitation below.",
  },
  {
    id: "permissions",
    title: "Review Your Permissions",
    description:
      "Understand what you can see and do as a caregiver. Your access depends on what the patient allows.",
  },
];

export default function CaregiverOnboarding() {
  const [currentStep, setCurrentStep] = useState(0);
  const [inviteLink, setInviteLink] = useState("");
  const navigate = useNavigate();

  const step = STEPS[currentStep];

  const handleNext = () => {
    if (currentStep < STEPS.length - 1) {
      setCurrentStep((s) => s + 1);
    } else {
      localStorage.setItem("caregiverOnboardingComplete", "true");
      navigate("/dashboardCaregiver");
    }
  };

  const handleSkip = () => {
    localStorage.setItem("caregiverOnboardingComplete", "true");
    navigate("/dashboardCaregiver");
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />
      <main className="pt-28 max-w-2xl mx-auto px-6 py-8">

        {/* Progress dots */}
        <div className="flex gap-2 mb-8">
          {STEPS.map((s, i) => (
            <div
              key={s.id}
              className={`h-2 rounded-full flex-1 transition-all ${
                i <= currentStep ? "bg-sky-500" : "bg-slate-200"
              }`}
            />
          ))}
        </div>

        <div className="bg-white rounded-3xl shadow p-8">
          <p className="text-slate-400 text-sm mb-1">
            Step {currentStep + 1} of {STEPS.length}
          </p>
          <h1 className="text-2xl font-bold text-slate-800 mb-2">
            {step.title}
          </h1>
          <p className="text-slate-500 mb-6">{step.description}</p>

          {/* Step: invite */}
          {step.id === "invite" && (
            <div className="mb-6">
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Patient Invite Link
              </label>
              <input
                type="text"
                placeholder="Paste your patient's invite link here"
                value={inviteLink}
                onChange={(e) => setInviteLink(e.target.value)}
                className="w-full border border-slate-200 rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-400"
              />
              <p className="text-xs text-slate-400 mt-2">
                You can also do this later from your dashboard.
              </p>
            </div>
          )}

          {/* Step: permissions */}
          {step.id === "permissions" && (
            <div className="mb-6 space-y-3">
              <div className="bg-emerald-50 rounded-xl p-4">
                <p className="text-sm font-semibold text-emerald-700 mb-2">
                  What you can do (when patient allows):
                </p>
                <ul className="text-sm text-emerald-700 space-y-1">
                  <li>✅ View medications</li>
                  <li>✅ View symptoms</li>
                  <li>✅ View appointments</li>
                  <li>✅ Receive reminders</li>
                  <li>✅ Write care notes</li>
                  <li>✅ Log symptom observations</li>
                </ul>
              </div>
              <div className="bg-red-50 rounded-xl p-4">
                <p className="text-sm font-semibold text-red-700 mb-2">
                  What you cannot do:
                </p>
                <ul className="text-sm text-red-700 space-y-1">
                  <li>🚫 Diagnose the patient</li>
                  <li>🚫 Prescribe medications</li>
                  <li>🚫 Edit treatment plans</li>
                </ul>
              </div>
            </div>
          )}

          <div className="flex justify-between">
            <button
              onClick={handleSkip}
              className="text-sm text-slate-400 hover:text-slate-600 transition"
            >
              Skip for now
            </button>
            <button
              onClick={handleNext}
              className="rounded-xl bg-sky-500 px-6 py-2 text-sm font-semibold text-white hover:bg-sky-600 transition"
            >
              {currentStep === STEPS.length - 1 ? "Get Started" : "Next"}
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}