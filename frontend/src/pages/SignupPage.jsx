import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { register as registerApi } from "../api/auth";
import bgImage from "../assets/landingBg.png";

export default function SignupPage({ embedded = false, onClose, onSwitchToLogin }) {
  const navigate = useNavigate();
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [userType, setUserType] = useState("patient");

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function handleCreateAccount(e) {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    try {
      await registerApi(email, password);

      localStorage.setItem("requestedRole", userType);
      localStorage.setItem("firstName", firstName);
      localStorage.setItem("lastName", lastName);

      setSuccess("Account created successfully. Please log in.");

      // if embedded, close modal instead of navigating away
      if (embedded) onClose?.();
      else navigate("/loginPage");
    } catch (err) {
      setError(err?.message || "Failed to create account.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className={`relative flex items-center justify-center ${
        embedded ? "" : "min-h-screen px-6 py-10 sm:py-12"
      }`}
    >
      {!embedded && (
        <>
          <img
            src={bgImage}
            alt="Healio background"
            className="absolute inset-0 h-full w-full object-cover"
          />
          <div className="absolute inset-0 bg-black/60" />
        </>
      )}
      <div className="relative z-10 shadow-lg w-full max-w-md rounded-2xl bg-white/10 backdrop-blur-sm border border-white/20 p-10">
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

        <form className="space-y-4 mt-4" onSubmit={handleCreateAccount}>
          <div className="flex gap-2">
            <div className="space-y-2 w-full">
              <label className="text-sm font-medium text-white">First Name</label>
              <input
                type="text"
                placeholder="First Name"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                className="w-full h-11 bg-white rounded-lg border border-slate-300 text-slate-900 px-3 placeholder:text-slate-400 focus:ring-2 focus:outline-none focus:border-sky-500 focus:ring-sky-500"
              />
            </div>
            <div className="space-y-2 w-full">
              <label className="text-sm font-medium text-white">Last Name</label>
              <input
                type="text"
                placeholder="Last Name"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                className="w-full h-11 bg-white rounded-lg border border-slate-300 text-slate-900 px-3 placeholder:text-slate-400 focus:ring-2 focus:outline-none focus:border-sky-500 focus:ring-sky-500"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-white">Email Address</label>
            <input
              type="email"
              placeholder="username@gmail.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              className="w-full h-11 bg-white rounded-lg border border-slate-300 text-slate-900 px-3 placeholder:text-slate-400 focus:ring-2 focus:outline-none focus:border-sky-500 focus:ring-sky-500"
              required
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-white">Password</label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                placeholder="•••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
                className="w-full h-11 bg-white rounded-lg border border-slate-300 text-slate-900 px-3 placeholder:text-slate-400 focus:ring-2 focus:outline-none focus:border-sky-500 focus:ring-sky-500"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-sky-700 hover:text-sky-900"
              >
                {showPassword ? "Hide" : "Show"}
              </button>
            </div>
            <p className="text-xs text-sky-50">
              Password must be 10+ chars and include uppercase, lowercase, and a number.
            </p>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-white">Confirm Password</label>
            <div className="relative">
              <input
                type={showConfirm ? "text" : "password"}
                placeholder="•••••••••"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                autoComplete="new-password"
                className="w-full h-11 bg-white rounded-lg border border-slate-300 text-slate-900 px-3 placeholder:text-slate-400 focus:ring-2 focus:outline-none focus:border-sky-500 focus:ring-sky-500"
                required
              />
              <button
                type="button"
                onClick={() => setShowConfirm(!showConfirm)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-sky-700 hover:text-sky-900"
              >
                {showConfirm ? "Hide" : "Show"}
              </button>
            </div>
          </div>

          {error ? (
            <div className="text-sm text-red-100 bg-red-600/30 border border-red-200/30 rounded-lg p-2">
              {error}
            </div>
          ) : null}

          {success ? (
            <div className="text-sm text-green-100 bg-green-600/30 border border-green-200/30 rounded-lg p-2">
              {success}
            </div>
          ) : null}

          <button
            type="submit"
            disabled={loading}
            className="mt-3 w-full h-11 bg-sky-700 rounded-lg text-white font-semibold hover:bg-sky-600 transition disabled:opacity-70"
          >
            {loading ? "Creating..." : "Create Account"}
          </button>

          <p className="text-center text-white text-sm">
            Already have an account?{" "}
            <button
              type="button"
              onClick={() =>
                embedded && onSwitchToLogin
                  ? onSwitchToLogin()
                  : navigate("/loginPage")
              }
              className="text-sky-200 hover:underline cursor-pointer"
            >
              Login
            </button>
          </p>
        </form>
      </div>
    </div>
  );
}
