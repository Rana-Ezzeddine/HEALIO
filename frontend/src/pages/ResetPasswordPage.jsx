import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { resetPassword, validatePasswordResetToken } from "../api/auth";
import logo from "../assets/logo.png";

const isStrongPassword = (value) =>
  value.length >= 10 &&
  /[A-Z]/.test(value) &&
  /[a-z]/.test(value) &&
  /[0-9]/.test(value);

function getInitialState(searchParams) {
  const token = (searchParams.get("token") || "").trim();

  if (!token) {
    return {
      token: "",
      status: "error",
      message: "Reset token is missing. Open the full link from your email and try again.",
      code: "RESET_TOKEN_MISSING",
    };
  }

  return {
    token,
    status: "loading",
    message: "Checking your reset link...",
    code: "",
  };
}

export default function ResetPasswordPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const initialState = getInitialState(searchParams);
  const [status, setStatus] = useState(initialState.status);
  const [message, setMessage] = useState(initialState.message);
  const [errorCode, setErrorCode] = useState(initialState.code);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!initialState.token) return;

    let cancelled = false;

    async function validateToken() {
      try {
        await validatePasswordResetToken(initialState.token);
        if (cancelled) return;
        setStatus("ready");
        setMessage("Choose a new password for your account.");
      } catch (err) {
        if (cancelled) return;
        setStatus("error");
        setErrorCode(err?.code || "");
        setMessage(err?.message || "This reset link is not valid.");
      }
    }

    validateToken();

    return () => {
      cancelled = true;
    };
  }, [initialState.token]);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!isStrongPassword(password)) {
      setStatus("ready");
      setMessage("Password must be 10+ chars and include uppercase, lowercase, and a number.");
      setErrorCode("PASSWORD_WEAK");
      return;
    }

    if (password !== confirmPassword) {
      setStatus("ready");
      setMessage("Passwords do not match.");
      setErrorCode("PASSWORD_MISMATCH");
      return;
    }

    setSubmitting(true);
    setErrorCode("");

    try {
      const data = await resetPassword(initialState.token, password);
      setStatus("success");
      setMessage(data?.message || "Password reset successfully.");
    } catch (err) {
      setStatus("error");
      setErrorCode(err?.code || "");
      setMessage(err?.message || "Failed to reset password.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 px-6 flex items-center justify-center">
      <div className="w-full max-w-md rounded-3xl bg-white border border-slate-200 shadow-xl p-10">
        <div className="text-center">
          <img src={logo} alt="Healio logo" className="mx-auto h-16 w-auto mb-4" />
          <h1 className="text-3xl font-extrabold text-slate-900">Reset Password</h1>
          <p className={`mt-3 text-sm ${status === "error" ? "text-red-600" : "text-slate-600"}`}>
            {message}
          </p>
        </div>

        {status === "ready" ? (
          <form className="space-y-4 mt-8" onSubmit={handleSubmit}>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">New Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full h-11 rounded-lg border border-slate-300 px-3 text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-400 focus:border-sky-400"
                required
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">Confirm Password</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full h-11 rounded-lg border border-slate-300 px-3 text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-400 focus:border-sky-400"
                required
              />
            </div>

            <p className="text-xs text-slate-500">
              Password must be 10+ chars and include uppercase, lowercase, and a number.
            </p>

            <button
              type="submit"
              disabled={submitting}
              className="w-full h-11 rounded-xl bg-sky-500 text-white font-semibold hover:bg-sky-600 transition disabled:opacity-70"
            >
              {submitting ? "Resetting..." : "Reset Password"}
            </button>
          </form>
        ) : null}

        {status === "success" ? (
          <button
            type="button"
            onClick={() => navigate("/loginPage")}
            className="mt-8 w-full h-11 rounded-xl bg-sky-500 text-white font-semibold hover:bg-sky-600 transition"
          >
            Go to Login
          </button>
        ) : null}

        {status === "error" ? (
          <div className="mt-8 space-y-3">
            {errorCode === "RESET_TOKEN_EXPIRED" ? (
              <button
                type="button"
                onClick={() => navigate("/forgot-password")}
                className="w-full h-11 rounded-xl bg-sky-500 text-white font-semibold hover:bg-sky-600 transition"
              >
                Request New Reset Link
              </button>
            ) : null}

            <button
              type="button"
              onClick={() => navigate("/loginPage")}
              className="w-full h-11 rounded-xl border border-slate-300 text-slate-700 font-semibold hover:bg-slate-50 transition"
            >
              Back to Login
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
