// src/pages/LoginPage.jsx
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { login as loginApi, resendVerification } from "../api/auth";
import { clearSession, setSession } from "../api/http";
import logo from "../assets/logo.png";

export default function LoginPage({ embedded = false, onClose, onSwitchToSignup }) {
  const navigate = useNavigate();
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [needsVerification, setNeedsVerification] = useState(false);

  useEffect(() => {
    if (!embedded) {
      clearSession();
    }
  }, [embedded]);

  async function handleLogin(e) {
    e.preventDefault();
    setError("");
    setInfo("");
    setNeedsVerification(false);
    setLoading(true);

    try {
      const { token, user } = await loginApi(email, password);

      setSession({ token, user });

      if (user.role === "doctor") navigate("/dashboardDoctor");
      else if (user.role === "caregiver") navigate("/dashboardCaregiver");
      else navigate("/dashboardPatient");

      if (embedded) onClose?.();
    } catch (err) {
      if (err?.code === "EMAIL_NOT_VERIFIED") {
        setNeedsVerification(true);
      }
      setError(err?.message || "Login failed");
    } finally {
      setLoading(false);
    }
  }

  async function handleResendVerification() {
    if (!email.trim()) {
      setError("Enter your email first.");
      return;
    }

    setError("");
    setInfo("");
    setResending(true);
    try {
      const data = await resendVerification(email.trim());
      setInfo(data?.message || "Verification email sent.");
    } catch (err) {
      setError(err?.message || "Failed to resend verification email.");
    } finally {
      setResending(false);
    }
  }

  return (
    <div
      className={`relative flex items-center justify-center ${
        embedded ? "w-full" : "min-h-screen px-6 bg-slate-50 overflow-hidden"
      }`}
    >

      <div className="relative z-10 w-full max-w-md rounded-3xl bg-white/80 backdrop-blur-md border border-white/60 shadow-xl p-12">
        <button
          onClick={() => (embedded ? onClose?.() : navigate("/"))}
          className="absolute top-4 right-4 text-slate-700 text-xl hover:opacity-50 transition"
          aria-label="Close"
        >
          ✕
        </button>

        
        <div className="text-center">
          <img src={logo} alt="Healio logo" className="mx-auto h-16 w-auto mb-2" />
          <h1 className="text-3xl font-extrabold text-slate-900">Welcome Back</h1>
          <p className="mt-2 text-sm text-slate-600">Log in to continue managing your health</p>
        </div>

        
        <form className="space-y-4 mt-8" onSubmit={handleLogin}>
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700">Email Address</label>
            <input
              type="email"
              placeholder="username@gmail.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              className="w-full h-11 bg-white rounded-lg border border-slate-300 text-slate-900 px-3 placeholder:text-slate-400 focus:ring-2 focus:outline-none focus:border-sky-400 focus:ring-sky-400 transition"
              required
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700">Password</label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                placeholder="•••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                className="w-full h-11 bg-white rounded-lg border border-slate-300 text-slate-900 px-3 placeholder:text-slate-400 focus:ring-2 focus:outline-none focus:border-sky-400 focus:ring-sky-400 transition pr-6"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-sky-500 hover:text-sky-700 transition"
              >
                {showPassword ? "Hide" : "Show"}
              </button>
            </div>
          </div>

          {error && (
            <div className="text-sm text-red-700 bg-red-100 border border-red-200 rounded-lg p-2">
              {error}
            </div>
          )}

          {info && (
            <div className="text-sm text-green-700 bg-green-100 border border-green-200 rounded-lg p-2">
              {info}
            </div>
          )}

          {needsVerification && (
            <button
              type="button"
              onClick={handleResendVerification}
              disabled={resending}
              className="w-full h-11 rounded-xl border border-sky-300 text-sky-700 font-semibold hover:bg-sky-50 transition disabled:opacity-70"
            >
              {resending ? "Sending..." : "Resend verification email"}
            </button>
          )}

          <button
            type="submit"
            disabled={loading}
            className="mt-4 w-full h-11 bg-gradient-to-r from-sky-400 to-indigo-400 rounded-xl text-white font-semibold hover:from-sky-500 hover:to-indigo-500 transition disabled:opacity-70 shadow"
          >
            {loading ? "Logging in..." : "Login"}
          </button>

          <p className="text-center text-sm text-slate-600 mt-3">
            Don&apos;t have an account yet?{" "}
            <span
              onClick={() =>
                embedded ? onSwitchToSignup?.() : navigate("/signup")
              }
              className="text-sky-500 hover:underline cursor-pointer"
            >
              Sign up
            </span>
          </p>
        </form>
      </div>
    </div>
  );
}
