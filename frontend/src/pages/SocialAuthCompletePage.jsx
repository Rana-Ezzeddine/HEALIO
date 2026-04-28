import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { clearSession, setSession } from "../api/http";
import { verifyTwoFactor } from "../api/auth";
import { getPostAuthRoute } from "../utils/authRouting";
import { queuePatientOnboarding } from "../utils/patientOnboarding";

function parseUser(rawUser) {
  if (!rawUser) return null;

  try {
    return JSON.parse(rawUser);
  } catch {
    return null;
  }
}

function getInitialResult(searchParams) {
  const token = searchParams.get("token");
  const user = parseUser(searchParams.get("user"));
  const challengeToken = searchParams.get("challengeToken");
  const mfaRequired = searchParams.get("mfaRequired") === "1";
  const error = searchParams.get("error");
  const provider = searchParams.get("provider");
  const providerLabel = provider === "apple" ? "Apple" : "Google";

  if (error) {
    return {
      token: "",
      user: null,
      hasError: true,
      message: searchParams.get("message") || `${providerLabel} sign-in failed.`,
      providerLabel,
    };
  }

  if (mfaRequired && challengeToken && user) {
    return {
      token: "",
      challengeToken,
      user,
      hasError: false,
      requiresTwoFactor: true,
      message: `Enter the code from your authenticator app to finish ${providerLabel} sign-in.`,
      providerLabel,
    };
  }

  if (!token || !user) {
    return {
      token: "",
      challengeToken: "",
      user: null,
      hasError: true,
      requiresTwoFactor: false,
      message: "Social sign-in could not be completed. Please try again.",
      providerLabel,
    };
  }

  return {
    token,
    challengeToken: "",
    user,
    hasError: false,
    requiresTwoFactor: false,
    message:
      user?.role === "doctor" && user?.doctorApprovalStatus !== "approved"
        ? `Signed in with ${providerLabel}. Redirecting to your application status...`
        : `Signed in with ${providerLabel}. Redirecting to your dashboard...`,
    providerLabel,
  };
}

export default function SocialAuthCompletePage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [initialResult] = useState(() => getInitialResult(searchParams));
  const [message] = useState(initialResult.message);
  const [hasError] = useState(initialResult.hasError);
  const [mfaCode, setMfaCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (initialResult.hasError || initialResult.requiresTwoFactor) {
      clearSession();
      return;
    }

    setSession({ token: initialResult.token, user: initialResult.user });
    queuePatientOnboarding(initialResult.user);
    localStorage.setItem("healio:auth-sync", String(Date.now()));

    navigate(getPostAuthRoute(initialResult.user), { replace: true });
  }, [initialResult, navigate]);

  async function handleVerify(e) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const { token, user } = await verifyTwoFactor(initialResult.challengeToken, mfaCode);
      setSession({ token, user });
      queuePatientOnboarding(user);
      localStorage.setItem("healio:auth-sync", String(Date.now()));
      navigate(getPostAuthRoute(user), { replace: true });
    } catch (err) {
      setError(err?.message || "Two-factor verification failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 px-6 flex items-center justify-center">
      <div className="w-full max-w-md rounded-3xl bg-white border border-slate-200 shadow-xl p-10 text-center">
        <h1 className="text-3xl font-extrabold text-slate-900">
          {hasError ? "Sign-in issue" : initialResult.requiresTwoFactor ? "Two-Factor Sign-In" : "Social Sign-in"}
        </h1>
        <p className={`mt-4 text-sm ${hasError ? "text-red-600" : "text-slate-600"}`}>
          {message}
        </p>
        {initialResult.requiresTwoFactor ? (
          <form className="mt-6 space-y-3 text-left" onSubmit={handleVerify}>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">
                Authenticator or backup code
              </label>
              <input
                type="text"
                value={mfaCode}
                onChange={(e) => setMfaCode(e.target.value)}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-slate-900 focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-400"
                placeholder="123456 or ABCD-EFGH"
                autoComplete="one-time-code"
                required
              />
            </div>
            {error ? (
              <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {error}
              </div>
            ) : null}
            <button
              type="submit"
              disabled={loading}
              className="w-full h-11 rounded-xl bg-sky-500 text-white font-semibold hover:bg-sky-600 transition disabled:opacity-70"
            >
              {loading ? "Verifying..." : "Complete sign-in"}
            </button>
          </form>
        ) : null}
        {hasError ? (
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
