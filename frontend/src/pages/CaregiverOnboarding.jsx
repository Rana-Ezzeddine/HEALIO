

import { useState } from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "../components/Navbar";

const STEPS = [
  {
    id: "profile",
    title: "Complete Your Profile",
    description: "Add your name and contact details so your patient knows who you are.",
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
      "Understand what you can see and do as a caregiver. Your access depends entirely on what the patient allows.",
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
    <div className="min-h-screen bg-gradient-to-br from-sky-50 via-white to-indigo-50">
      <Navbar />
      <main className="mx-auto max-w-2xl px-6 pt-28 pb-10">
        {/* Progress bar */}
        <div className="mb-8 flex gap-2">
          {STEPS.map((s, i) => (
            <div
              key={s.id}
              className={`h-2 flex-1 rounded-full transition-all ${
                i <= currentStep ? "bg-sky-500" : "bg-slate-200"
              }`}
            />
          ))}
        </div>

        <div className="rounded-3xl bg-white p-8 shadow-sm border border-slate-200">
          <p className="text-sm text-slate-400 mb-1">
            Step {currentStep + 1} of {STEPS.length}
          </p>
          <h1 className="text-2xl font-bold text-slate-800 mb-2">{step.title}</h1>
          <p className="text-slate-500 mb-6">{step.description}</p>

          {/* Step: invite  */}
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
                className="w-full rounded-xl border border-slate-300 px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
              />
              <p className="mt-2 text-xs text-slate-400">
                You can also do this later from your dashboard.
              </p>
              <button
                onClick={() => navigate(`/caregiverAcceptInvite?token=${inviteLink}`)}
                disabled={!inviteLink.trim()}
                className="mt-3 rounded-xl bg-sky-500 px-5 py-2 text-sm font-semibold text-white hover:bg-sky-600 transition disabled:opacity-40"
              >
                Look Up Invitation
              </button>
            </div>
          )}

          {/* Step: permissions  */}
          {step.id === "permissions" && (
            <div className="mb-6 space-y-4">
              {/* distinguish caregiver notes from doctor notes */}
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-sm font-semibold text-slate-700 mb-1">
                  Caregiver notes vs. Doctor notes
                </p>
                <p className="text-sm text-slate-500">
                  Your care notes are practical observations — sleep, appetite, mood,
                  refusals. They are separate from doctor notes and clearly labeled
                  as caregiver entries.
                </p>
              </div>
              {/*support-oriented actions */}
              <div className="rounded-2xl bg-emerald-50 p-4">
                <p className="text-sm font-semibold text-emerald-700 mb-2">
                  What you can do (when patient allows):
                </p>
                <ul className="text-sm text-emerald-700 space-y-1">
                  <li>✅ View medications, symptoms, and appointments</li>
                  <li>✅ Receive reminders</li>
                  <li>✅ Write care notes</li>
                  <li>✅ Log symptom observations</li>
                  <li>✅ Help with appointment coordination</li>
                  <li>✅ View shared doctor contact details for coordination</li>
                </ul>
              </div>
              {/* guardrails */}
              <div className="rounded-2xl bg-red-50 p-4">
                <p className="text-sm font-semibold text-red-700 mb-2">
                  What you must never do:
                </p>
                <ul className="text-sm text-red-700 space-y-1">
                  <li>🚫 Diagnose the patient</li>
                  <li>🚫 Prescribe or recommend medications</li>
                  <li>🚫 Edit treatment plans</li>
                  <li>🚫 Access data the patient has not permitted</li>
                </ul>
              </div>
            </div>
          )}

          <div className="flex justify-between items-center">
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