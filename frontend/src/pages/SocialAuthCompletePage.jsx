import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { clearSession, setSession } from "../api/http";
import { getPostAuthRoute } from "../utils/authRouting";

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

  if (!token || !user) {
    return {
      token: "",
      user: null,
      hasError: true,
      message: "Social sign-in could not be completed. Please try again.",
      providerLabel,
    };
  }

  return {
    token,
    user,
    hasError: false,
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
  const initialResult = getInitialResult(searchParams);
  const [message] = useState(initialResult.message);
  const [hasError] = useState(initialResult.hasError);

  useEffect(() => {
    if (initialResult.hasError) {
      clearSession();
      return;
    }

    setSession({ token: initialResult.token, user: initialResult.user });
    localStorage.setItem("healio:auth-sync", String(Date.now()));

    navigate(getPostAuthRoute(initialResult.user), { replace: true });
  }, [initialResult, navigate]);

  return (
    <div className="min-h-screen bg-slate-50 px-6 flex items-center justify-center">
      <div className="w-full max-w-md rounded-3xl bg-white border border-slate-200 shadow-xl p-10 text-center">
        <h1 className="text-3xl font-extrabold text-slate-900">
          {hasError ? "Sign-in issue" : "Social Sign-in"}
        </h1>
        <p className={`mt-4 text-sm ${hasError ? "text-red-600" : "text-slate-600"}`}>
          {message}
        </p>
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
