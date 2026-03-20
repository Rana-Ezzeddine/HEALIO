import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { resendVerification, verifyEmail } from "../api/auth";
import { clearSession, setSession } from "../api/http";
import { getPostAuthRoute } from "../utils/authRouting";

function getInitialView(searchParams) {
  const rawToken = searchParams.get("token");
  const token = rawToken ? rawToken.trim() : "";

  if (!token) {
    return {
      token: "",
      status: "error",
      message: "Verification token is missing. Open the full link from your email and try again.",
      canResend: false,
      email: "",
    };
  }

  return {
    token,
    status: "idle",
    message: "Preparing verification...",
    canResend: false,
    email: "",
  };
}

export default function VerifyEmailPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const initialView = getInitialView(searchParams);
  const [status, setStatus] = useState(initialView.status);
  const [message, setMessage] = useState(initialView.message);
  const [canResend, setCanResend] = useState(initialView.canResend);
  const [email, setEmail] = useState(initialView.email);
  const [isResending, setIsResending] = useState(false);

  useEffect(() => {
    if (!initialView.token) {
      clearSession();
      return;
    }

    let cancelled = false;

    async function runVerification() {
      setStatus("loading");
      setMessage("Verifying your email...");
      setCanResend(false);

      try {
        const { token: accessToken, user } = await verifyEmail(initialView.token);
        if (cancelled) return;

        setSession({ token: accessToken, user });
        localStorage.setItem("healio:auth-sync", String(Date.now()));
        setStatus("success");
        setMessage(
          user?.role === "doctor" && user?.doctorApprovalStatus !== "approved"
            ? "Email verified. Redirecting to your application status..."
            : "Email verified. Redirecting to your dashboard..."
        );
        navigate(getPostAuthRoute(user), { replace: true });
      } catch (err) {
        if (cancelled) return;

        clearSession();
        setStatus("error");
        setMessage(err?.message || "Email verification failed.");

        if (err?.code === "VERIFICATION_TOKEN_EXPIRED" && err?.email) {
          setEmail(err.email);
          setCanResend(true);
        }
      }
    }

    runVerification();

    return () => {
      cancelled = true;
    };
  }, [initialView.token, navigate]);

  async function handleResend() {
    if (!email) return;

    setIsResending(true);
    try {
      const data = await resendVerification(email);
      setCanResend(false);
      setMessage(data?.message || "Verification email sent. Check your inbox for a new link.");
    } catch (err) {
      setMessage(err?.message || "Failed to resend verification email.");
    } finally {
      setIsResending(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 px-6 flex items-center justify-center">
      <div className="w-full max-w-md rounded-3xl bg-white border border-slate-200 shadow-xl p-10 text-center">
        <h1 className="text-3xl font-extrabold text-slate-900">Email Verification</h1>
        <p className="mt-4 text-sm text-slate-600">{message}</p>

        {canResend ? (
          <button
            type="button"
            onClick={handleResend}
            disabled={isResending}
            className="mt-6 w-full h-11 rounded-xl border border-sky-300 text-sky-700 font-semibold hover:bg-sky-50 transition disabled:opacity-70"
          >
            {isResending ? "Sending..." : "Resend verification email"}
          </button>
        ) : null}

        {status === "error" ? (
          <button
            type="button"
            onClick={() => navigate("/loginPage")}
            className="mt-4 w-full h-11 rounded-xl bg-sky-500 text-white font-semibold hover:bg-sky-600 transition"
          >
            Go to Login
          </button>
        ) : null}
      </div>
    </div>
  );
}
