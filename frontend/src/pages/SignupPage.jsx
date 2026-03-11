import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { register as registerApi } from "../api/auth";
import { clearSession, getToken, getUser, setSession } from "../api/http";
import logo from "../assets/logo.png";

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
