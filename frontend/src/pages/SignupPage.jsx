import { useState } from "react";
import { useNavigate } from "react-router-dom";
import bgImage from "../assets/bg-medical.png";

export default function SignupPage({ embedded = false, onClose }) {
  const navigate = useNavigate();
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [userType, setUserType] = useState("patient");

  function handleCreateAccount() {
    try {
      localStorage.setItem("userRole", userType);
    } catch (err) {
      console.error("Failed to save role", err);
    }
    // if embedded, close modal instead of navigating away
    if (embedded) onClose?.();
    else navigate("/");
  }

  return (
    <div
      className={`flex items-center justify-center ${
        embedded ? "" : "min-h-screen p-6"
      }`}
      style={
        embedded
          ? {}
          : {
              backgroundImage: `url(${bgImage})`,
              backgroundSize: "cover",
              backgroundPosition: "center",
            }
      }
    >
      <div className="relative w-full max-w-md rounded-2xl bg-white/10 backdrop-blur-sm border border-white/10 shadow-lg p-10">
        {/* Close button only in modal */}
        {embedded && (
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-white text-xl hover:opacity-80"
            aria-label="Close"
          >
            ✕
          </button>
        )}

        <div className="text-center">
          <h1 className="text-4xl font-extrabold text-white">Healio</h1>
          <p className="mt-2 text-sm text-white">
            Create your account to get started.
          </p>
        </div>

        <div className="mt-4 space-y-3">
          <label className="text-sm font-medium text-white">I am a:</label>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setUserType("patient")}
              className={`flex-1 h-10 rounded-lg font-medium transition ${
                userType === "patient"
                  ? "bg-sky-700 text-white"
                  : "bg-slate-100 text-slate-700 hover:bg-slate-200"
              }`}
            >
              Patient
            </button>
            <button
              type="button"
              onClick={() => setUserType("doctor")}
              className={`flex-1 h-10 rounded-lg font-medium transition ${
                userType === "doctor"
                  ? "bg-sky-700 text-white"
                  : "bg-slate-100 text-slate-700 hover:bg-slate-200"
              }`}
            >
              Doctor
            </button>
          </div>
        </div>

        <div className="mt-2">
          <p className="text-xs text-sky-50 italic">
            {userType === "patient"
              ? "Track your health records, book appointments, and communicate with doctors."
              : "Manage patient records, schedule appointments, and provide healthcare services."}
          </p>
        </div>

        <form className="space-y-4 mt-4">
          <div className="flex gap-2">
            <div className="space-y-2 w-full">
              <label className="text-sm font-medium text-white">
                First Name
              </label>
              <input
                type="text"
                placeholder="First Name"
                className="w-full h-11 bg-white rounded-lg border border-slate-300 text-slate-900 px-3 placeholder:text-slate-400 focus:ring-2 focus:outline-none focus:border-sky-500 focus:ring-sky-500"
              />
            </div>
            <div className="space-y-2 w-full">
              <label className="text-sm font-medium text-white">Last Name</label>
              <input
                type="text"
                placeholder="Last Name"
                className="w-full h-11 bg-white rounded-lg border border-slate-300 text-slate-900 px-3 placeholder:text-slate-400 focus:ring-2 focus:outline-none focus:border-sky-500 focus:ring-sky-500"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-white">
              Email Address
            </label>
            <input
              type="email"
              placeholder="username@gmail.com"
              className="w-full h-11 bg-white rounded-lg border border-slate-300 text-slate-900 px-3 placeholder:text-slate-400 focus:ring-2 focus:outline-none focus:border-sky-500 focus:ring-sky-500"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-white">Password</label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                placeholder="•••••••••"
                className="w-full h-11 bg-white rounded-lg border border-slate-300 text-slate-900 px-3 placeholder:text-slate-400 focus:ring-2 focus:outline-none focus:border-sky-500 focus:ring-sky-500"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-sky-600 hover:text-sky-800"
              >
                {showPassword ? "Hide" : "Show"}
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-white">
              Confirm Password
            </label>
            <div className="relative">
              <input
                type={showConfirm ? "text" : "password"}
                placeholder="•••••••••"
                className="w-full h-11 bg-white rounded-lg border border-slate-300 text-slate-900 px-3 placeholder:text-slate-400 focus:ring-2 focus:outline-none focus:border-sky-500 focus:ring-sky-500"
              />
              <button
                type="button"
                onClick={() => setShowConfirm(!showConfirm)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-sky-600 hover:text-sky-800"
              >
                {showConfirm ? "Hide" : "Show"}
              </button>
            </div>
          </div>

          <button
            type="button"
            onClick={handleCreateAccount}
            className="mt-3 w-full h-11 bg-sky-700 rounded-lg text-white font-semibold hover:bg-[#1c84d4]/90 transition"
          >
            Create Account
          </button>

          <p className="text-center text-white text-sm">
            Already have an account?{" "}
            <span
              onClick={() => (embedded ? onClose?.() : navigate("/login"))}
              className="text-sky-300 hover:underline cursor-pointer"
            >
              Login
            </span>
          </p>
        </form>
      </div>
    </div>
  );
}
