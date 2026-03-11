import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { verifyEmail } from "../api/auth";
import { setSession } from "../api/http";

const dashboardPathByRole = {
  doctor: "/dashboardDoctor",
  patient: "/dashboardPatient",
  caregiver: "/dashboardCaregiver",
};

export default function VerifyEmailPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState("idle");
  const [message, setMessage] = useState("Preparing verification...");

  useEffect(() => {
    const rawToken = searchParams.get("token");
    const token = rawToken ? rawToken.trim() : "";

    if (!token) {
      setStatus("error");
      setMessage("Verification token is missing. Open the full link from your email and try again.");
      return;
    }

    async function runVerification() {
      setStatus("loading");
      setMessage("Verifying your email...");

      try {
        const { token: accessToken, user } = await verifyEmail(token);
        setSession({ token: accessToken, user });
        localStorage.setItem("healio:auth-sync", String(Date.now()));
        setStatus("success");
        setMessage("Email verified. Redirecting to your dashboard...");
        const dashboardPath = dashboardPathByRole[user?.role] || "/dashboardPatient";
        navigate(dashboardPath, { replace: true });
      } catch (err) {
        setStatus("error");
        setMessage(err?.message || "Email verification failed.");
      }
    }

    runVerification();
  }, [navigate, searchParams]);

  return (
    <div className="min-h-screen bg-slate-50 px-6 flex items-center justify-center">
      <div className="w-full max-w-md rounded-3xl bg-white border border-slate-200 shadow-xl p-10 text-center">
        <h1 className="text-3xl font-extrabold text-slate-900">Email Verification</h1>
        <p className="mt-4 text-sm text-slate-600">{message}</p>

        {status === "error" ? (
          <button
            type="button"
            onClick={() => navigate("/loginPage")}
            className="mt-6 w-full h-11 rounded-xl bg-sky-500 text-white font-semibold hover:bg-sky-600 transition"
          >
            Go to Login
          </button>
        ) : null}
      </div>
    </div>
  );
}
