import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { register as registerApi, startSocialAuth } from "../api/auth";
import { clearSession, getToken, getUser, setSession } from "../api/http";
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

export default function SignupPage({ embedded = false, onClose, onSwitchToLogin }) {
  const navigate = useNavigate();
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [userType, setUserType] = useState("patient");

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [licenseNb, setLicenseNb] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const roleDescriptionByType = {
    patient: "Track your health records, book appointments, and communicate with doctors.",
    doctor: "Manage patient records, schedule appointments, and provide healthcare services.",
    caregiver: "Support loved ones by tracking care updates, appointments, and medications.",
  };
  const isNameValid = (value) => /^[A-Za-z]{2,}$/.test(value.trim());
  const isStrongPassword = (value) =>
    value.length >= 10 &&
    /[A-Z]/.test(value) &&
    /[a-z]/.test(value) &&
    /[0-9]/.test(value);

  useEffect(() => {
    if (!success) return;

    const dashboardPathByRole = {
      doctor: "/dashboardDoctor",
      patient: "/dashboardPatient",
      caregiver: "/dashboardCaregiver",
    };

    function redirectIfVerified() {
      const token = getToken();
      const user = getUser();
      if (!token || !user) return;
      const target = dashboardPathByRole[user?.role] || "/dashboardPatient";
      navigate(target, { replace: true });
    }

    redirectIfVerified();
    const intervalId = window.setInterval(redirectIfVerified, 1000);
    window.addEventListener("storage", redirectIfVerified);
    window.addEventListener("focus", redirectIfVerified);
    document.addEventListener("visibilitychange", redirectIfVerified);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener("storage", redirectIfVerified);
      window.removeEventListener("focus", redirectIfVerified);
      document.removeEventListener("visibilitychange", redirectIfVerified);
    };
  }, [navigate, success]);

  useEffect(() => {
    if (!embedded) {
      clearSession();
    }
  }, [embedded]);

  async function handleCreateAccount(e) {
    e.preventDefault();
    setError("");
    setSuccess("");

    const cleanFirstName = firstName.trim();
    const cleanLastName = lastName.trim();
    const cleanEmail = email.trim();
    const dashboardPathByRole = {
      doctor: "/dashboardDoctor",
      patient: "/dashboardPatient",
      caregiver: "/dashboardCaregiver",
    };

    if (!isNameValid(cleanFirstName)) {
      setError("First name must be at least 2 characters and contain letters only.");
      return;
    }

    if (!isNameValid(cleanLastName)) {
      setError("Last name must be at least 2 characters and contain letters only.");
      return;
    }

    if (!isStrongPassword(password)) {
      setError("Password must be 10+ chars and include uppercase, lowercase, and a number.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    try {
      const registerResponse = await registerApi({
        firstName: cleanFirstName,
        lastName: cleanLastName,
        email: cleanEmail,
        password,
        role: userType,
      });

      if (registerResponse?.token && registerResponse?.user) {
        setSession({ token: registerResponse.token, user: registerResponse.user });
        navigate(dashboardPathByRole[registerResponse.user.role] || "/dashboardPatient", { replace: true });
        return;
      }

      localStorage.setItem("requestedRole", userType);
      localStorage.setItem("firstName", cleanFirstName);
      localStorage.setItem("lastName", cleanLastName);
      localStorage.setItem("email", cleanEmail);
      localStorage.setItem("licenseNb", licenseNb);
      localStorage.removeItem("pendingPatientLinkCode");

      setSuccess("Verification email sent. Open the link in your inbox to activate your account.");
    } catch (err) {
      setError(err?.message || "Failed to create account.");
    } finally {
      setLoading(false);
    }
  }

  function handleSocialSignup(provider) {
    setError("");
    setSuccess("");
    startSocialAuth(provider, {
      intent: "signup",
      role: userType,
    });
  }

  return (
    <div
      className={`relative flex items-center justify-center hide-scrollbar ${
        embedded ? "w-full" : "min-h-screen px-6 bg-slate-50 overflow-y-auto"
      }`}
    >
      {!embedded && (
        <>
          <div className="absolute inset-0 bg-sky-100/10" />
          <div className="absolute -top-40 -left-40 h-96 w-96 rounded-full bg-sky-200/40 blur-3xl" />
          <div className="absolute top-1/2 -right-40 h-96 w-96 rounded-full bg-indigo-200/40 blur-3xl" />
        </>
      )}
      <div className="relative z-10 w-full max-w-md rounded-3xl bg-white/80 backdrop-blur-md border border-white/60 shadow-xl p-12">
        <button
          onClick={() => (embedded ? onClose?.() : navigate("/"))}
          className="absolute top-4 right-4 text-slate-700 text-xl hover:opacity-50 transition"
          aria-label="Close"
        >
          ✕
        </button>

        <div className="text-center">
          <img src={logo} alt="Healio logo" className="mx-auto h-16 w-auto mb-4" />
          <h1 className="text-3xl font-extrabold text-slate-900">Create Account</h1>
          <p className="mt-2 text-sm text-slate-600">
            Create your account to get started.
          </p>
        </div>

        <div className="mt-4 space-y-3">
          <label className="text-sm font-medium text-slate-700">I am a:</label>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => {
                setUserType("patient");
                setLicenseNb("");
              }}
              className={`flex-1 h-10 rounded-lg font-medium transition ${
                userType === "patient"
                  ? "bg-sky-500 text-white"
                  : "bg-white text-slate-700 border border-slate-200 hover:bg-slate-100"
              }`}
            >
              Patient
            </button>
            <button
              type="button"
              onClick={() => {
                setUserType("doctor");
              }}
              className={`flex-1 h-10 rounded-lg font-medium transition ${
                userType === "doctor"
                  ? "bg-sky-500 text-white"
                  : "bg-white text-slate-700 border border-slate-200 hover:bg-slate-100"
              }`}
            >
              Doctor
            </button>
            <button
              type="button"
              onClick={() => {
                setUserType("caregiver");
                setLicenseNb("");
              }}
              className={`flex-1 h-10 rounded-lg font-medium transition ${
                userType === "caregiver"
                  ? "bg-sky-500 text-white"
                  : "bg-white text-slate-700 border border-slate-200 hover:bg-slate-100"
              }`}
            >
              Caregiver
            </button>
          </div>
        </div>

        <div className="mt-2">
          <p className="text-xs text-slate-500 italic">
            {roleDescriptionByType[userType]}
          </p>
        </div>

        <form className="space-y-4 mt-4" onSubmit={handleCreateAccount}>
          <div className="flex gap-2">
            <div className="space-y-2 w-full">
              <label className="text-sm font-medium text-slate-700">First Name</label>
              <input
                type="text"
                placeholder="First Name"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                minLength={2}
                pattern="[A-Za-z]{2,}"
                required
                className="w-full h-11 bg-white rounded-lg border border-slate-300 text-slate-900 px-3 placeholder:text-slate-400 focus:ring-2 focus:outline-none focus:border-sky-400 focus:ring-sky-400 transition"
              />
            </div>
            <div className="space-y-2 w-full">
              <label className="text-sm font-medium text-slate-700">Last Name</label>
              <input
                type="text"
                placeholder="Last Name"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                minLength={2}
                pattern="[A-Za-z]{2,}"
                required
                className="w-full h-11 bg-white rounded-lg border border-slate-300 text-slate-900 px-3 placeholder:text-slate-400 focus:ring-2 focus:outline-none focus:border-sky-400 focus:ring-sky-400 transition"
              />
            </div>
          </div>

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

          {userType === "doctor" && (
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700">
              License Number
            </label>
            <input
              type="text"
              placeholder="Enter your medical license number"
              value={licenseNb}
              onChange={(e) => setLicenseNb(e.target.value)}
              className="w-full h-11 bg-white rounded-lg border border-slate-300 text-slate-900 px-3 placeholder:text-slate-400 focus:ring-2 focus:outline-none focus:border-sky-400 focus:ring-sky-400 transition"
              required
            />
          </div>
        )}

          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700">Password</label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                placeholder="•••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
                minLength={10}
                className="w-full h-11 bg-white rounded-lg border border-slate-300 text-slate-900 px-3 placeholder:text-slate-400 focus:ring-2 focus:outline-none focus:border-sky-400 focus:ring-sky-400 transition"
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
            <p className="text-xs text-slate-500">
              Password must be 10+ chars and include uppercase, lowercase, and a number.
            </p>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700">Confirm Password</label>
            <div className="relative">
              <input
                type={showConfirm ? "text" : "password"}
                placeholder="•••••••••"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                autoComplete="new-password"
                className="w-full h-11 bg-white rounded-lg border border-slate-300 text-slate-900 px-3 placeholder:text-slate-400 focus:ring-2 focus:outline-none focus:border-sky-400 focus:ring-sky-400 transition"
                required
              />
              <button
                type="button"
                onClick={() => setShowConfirm(!showConfirm)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-sky-500 hover:text-sky-700 transition"
              >
                {showConfirm ? "Hide" : "Show"}
              </button>
            </div>
          </div>

          {error ? (
            <div className="text-sm text-red-700 bg-red-100 border border-red-200 rounded-lg p-2">
              {error}
            </div>
          ) : null}

          {success ? (
            <div className="text-sm text-green-700 bg-green-100 border border-green-200 rounded-lg p-2">
              {success}
            </div>
          ) : null}

          <button
            type="submit"
            disabled={loading}
            className="mt-4 w-full h-11 bg-gradient-to-r from-sky-400 to-indigo-400 rounded-xl text-white font-semibold hover:from-sky-500 hover:to-indigo-500 transition disabled:opacity-70 shadow"
          >
            {loading ? "Creating..." : "Create Account"}
          </button>

          <div className="flex items-center gap-3 pt-2">
            <div className="h-px flex-1 bg-slate-200" />
            <span className="text-xs font-medium uppercase tracking-[0.2em] text-slate-400">or</span>
            <div className="h-px flex-1 bg-slate-200" />
          </div>

          <button
            type="button"
            onClick={() => handleSocialSignup("google")}
            className="w-full h-11 rounded-xl border border-slate-300 bg-white text-slate-900 font-semibold hover:bg-slate-50 transition flex items-center justify-center gap-3"
          >
            <GoogleIcon />
            <span>Sign up with Google</span>
          </button>

          <p className="text-center text-sm text-slate-600 mt-3">
            Already have an account?{" "}
            <button
              type="button"
              onClick={() =>
                embedded && onSwitchToLogin
                  ? onSwitchToLogin()
                  : navigate("/loginPage")
              }
              className="text-sky-500 hover:underline cursor-pointer"
            >
              Login
            </button>
          </p>
        </form>
      </div>
    </div>
  );
}
