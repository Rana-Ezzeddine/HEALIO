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
    <div className="min-h-screen bg-slate-50 px-6 flex items-center justify-center">
      <div className="w-full max-w-md rounded-3xl bg-white border border-slate-200 shadow-xl p-10">
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
            onClick={() => navigate("/loginPage")}
            className="w-full h-11 rounded-xl border border-slate-300 text-slate-700 font-semibold hover:bg-slate-50 transition"
          >
            Back to Login
          </button>
        </form>
      </div>
    </div>
  );
}
