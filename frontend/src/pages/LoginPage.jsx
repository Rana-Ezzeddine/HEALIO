// src/pages/LoginPage.jsx
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { login as loginApi, resendVerification, startSocialAuth } from "../api/auth";
import { clearSession, setSession } from "../api/http";
import { getPostAuthRoute } from "../utils/authRouting";
import logo from "../assets/logo.png";

function GoogleIcon() {
  return (
    <svg aria-hidden="true" className="h-5 w-5" viewBox="0 0 48 48">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.6 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3 0 5.7 1.1 7.8 2.9l5.7-5.7C34.1 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5Z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 18.9 12 24 12c3 0 5.7 1.1 7.8 2.9l5.7-5.7C34.1 6.1 29.3 4 24 4c-7.7 0-14.4 4.3-17.7 10.7Z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35 26.8 36 24 36c-5.2 0-9.6-3.3-11.2-8l-6.5 5C9.5 39.5 16.2 44 24 44Z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-1 2.9-2.9 4.9-5 6.2l6.2 5.2C36.1 39.8 44 34 44 24c0-1.3-.1-2.4-.4-3.5Z" />
    </svg>
  );
}

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
      navigate(getPostAuthRoute(user), { replace: true });

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

  function handleSocialLogin(provider) {
    setError("");
    setInfo("");
    setNeedsVerification(false);
    startSocialAuth(provider, { intent: "login" });
  }

  return (
    <div
      className={`relative flex items-center justify-center ${
        embedded ? "w-full" : "min-h-screen px-6 bg-slate-50 overflow-hidden"
      }`}
    >
      {!embedded && (
        <>
          <div className="absolute inset-0 bg-[linear-gradient(180deg,#f8fbfd_0%,#eef7fb_100%)]" />
          <div className="absolute left-[-10%] top-[14%] h-72 w-72 rounded-full bg-sky-100/75 blur-3xl" />
          <div className="absolute right-[-8%] top-[10%] h-80 w-80 rounded-full bg-cyan-100/60 blur-3xl" />
          <div className="absolute left-[12%] top-[22%] h-24 w-24 rounded-[2rem] border border-white/70 bg-white/35" />
          <div className="absolute right-[14%] bottom-[18%] h-28 w-28 rounded-[2rem] border border-white/70 bg-white/30" />
          <div className="absolute left-[18%] top-[20%] h-4 w-4 rounded-full bg-sky-300/70 shadow-[0_0_18px_rgba(125,211,252,0.55)]" />
          <div className="absolute left-[24%] top-[58%] h-3 w-3 rounded-full bg-cyan-300/65 shadow-[0_0_16px_rgba(103,232,249,0.5)]" />
          <div className="absolute right-[22%] top-[28%] h-5 w-5 rounded-full bg-sky-200/75 shadow-[0_0_18px_rgba(186,230,253,0.55)]" />
          <div className="absolute right-[18%] bottom-[24%] h-3.5 w-3.5 rounded-full bg-cyan-200/75 shadow-[0_0_16px_rgba(165,243,252,0.5)]" />
          <div className="absolute left-[32%] bottom-[18%] h-2.5 w-2.5 rounded-full bg-sky-300/70 shadow-[0_0_14px_rgba(125,211,252,0.45)]" />
        </>
      )}
      <div className={`relative z-10 w-full rounded-3xl border border-white/60 bg-white/80 shadow-xl backdrop-blur-md ${embedded ? "max-w-lg p-8 md:p-10" : "max-w-md p-12"}`}>
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

        
        <form className="mt-8 space-y-4" onSubmit={handleLogin}>
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
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => {
                  document.body.classList.add("auth-route-transitioning");
                  window.setTimeout(() => {
                    navigate("/forgot-password");
                    document.body.classList.remove("auth-route-transitioning");
                  }, 90);
                }}
                className="text-sm font-medium text-sky-600 hover:text-sky-700 hover:underline"
              >
                Forgot Password?
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

          <div className="flex items-center gap-3 pt-2">
            <div className="h-px flex-1 bg-slate-200" />
            <span className="text-xs font-medium uppercase tracking-[0.2em] text-slate-400">or</span>
            <div className="h-px flex-1 bg-slate-200" />
          </div>

          <button
            type="button"
            onClick={() => handleSocialLogin("google")}
            className="w-full h-11 rounded-xl border border-slate-300 bg-white text-slate-900 font-semibold hover:bg-slate-50 transition flex items-center justify-center gap-3"
          >
            <GoogleIcon />
            <span>Sign in with Google</span>
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
