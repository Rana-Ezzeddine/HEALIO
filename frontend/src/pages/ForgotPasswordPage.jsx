import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { requestPasswordReset } from "../api/auth";
import logo from "../assets/logo.png";

export default function ForgotPasswordPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccess("");

    try {
      const data = await requestPasswordReset(email.trim());
      setSuccess(data?.message || "If an account with that email exists, a reset link has been sent.");
    } catch (err) {
      setError(err?.message || "Failed to request password reset.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-page-enter relative min-h-screen overflow-hidden bg-slate-50 px-6 flex items-center justify-center">
      <div className="absolute inset-0 bg-[linear-gradient(180deg,#f8fbfd_0%,#eef7fb_100%)]" />
      <div className="absolute left-[-10%] top-[14%] h-72 w-72 rounded-full bg-sky-100/75 blur-3xl" />
      <div className="absolute right-[-8%] top-[10%] h-80 w-80 rounded-full bg-cyan-100/60 blur-3xl" />
      <div className="absolute left-[12%] top-[22%] h-24 w-24 rounded-[2rem] border border-white/70 bg-white/35" />
      <div className="absolute right-[14%] bottom-[18%] h-28 w-28 rounded-[2rem] border border-white/70 bg-white/30" />
      <div className="landing-orb-1 absolute left-[18%] top-[20%] h-4 w-4 rounded-full bg-sky-300/70 shadow-[0_0_18px_rgba(125,211,252,0.55)]" />
      <div className="landing-orb-2 absolute left-[24%] top-[58%] h-3 w-3 rounded-full bg-cyan-300/65 shadow-[0_0_16px_rgba(103,232,249,0.5)]" />
      <div className="landing-orb-3 absolute right-[22%] top-[28%] h-5 w-5 rounded-full bg-sky-200/75 shadow-[0_0_18px_rgba(186,230,253,0.55)]" />
      <div className="landing-orb-2 absolute right-[18%] bottom-[24%] h-3.5 w-3.5 rounded-full bg-cyan-200/75 shadow-[0_0_16px_rgba(165,243,252,0.5)]" />
      <div className="landing-orb-1 absolute left-[32%] bottom-[18%] h-2.5 w-2.5 rounded-full bg-sky-300/70 shadow-[0_0_14px_rgba(125,211,252,0.45)]" />

      <div className="relative z-10 w-full max-w-md rounded-3xl border border-slate-200 bg-white shadow-xl p-10">
          <div className="text-center">
            <img src={logo} alt="Healio logo" className="mx-auto h-16 w-auto mb-4" />
            <h1 className="text-3xl font-extrabold text-slate-900">Forgot Password</h1>
          <p className="mt-2 text-sm text-slate-600">
            Enter your email and we&apos;ll send you a secure reset link.
          </p>
        </div>

        <form className="space-y-4 mt-8" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700">Email Address</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="username@gmail.com"
              className="w-full h-11 rounded-lg border border-slate-300 px-3 text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-400 focus:border-sky-400"
              required
            />
          </div>

          {error ? (
            <div className="text-sm text-red-700 bg-red-100 border border-red-200 rounded-lg p-3">
              {error}
            </div>
          ) : null}

          {success ? (
            <div className="text-sm text-green-700 bg-green-100 border border-green-200 rounded-lg p-3">
              {success}
            </div>
          ) : null}

          <button
            type="submit"
            disabled={loading}
            className="w-full h-11 rounded-xl bg-sky-500 text-white font-semibold hover:bg-sky-600 transition disabled:opacity-70"
          >
            {loading ? "Sending..." : "Send Reset Link"}
          </button>

          <button
            type="button"
            onClick={() => {
              document.body.classList.add("auth-route-transitioning");
              window.setTimeout(() => {
                navigate("/loginPage");
                document.body.classList.remove("auth-route-transitioning");
              }, 90);
            }}
            className="w-full h-11 rounded-xl border border-slate-300 text-slate-700 font-semibold hover:bg-slate-50 transition"
          >
            Back to Login
          </button>
        </form>
      </div>
    </div>
  );
}
