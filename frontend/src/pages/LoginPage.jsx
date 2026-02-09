import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { login as loginApi } from "../api/auth";
import bgImage from "../assets/landingBg.png";

export default function LoginPage({ embedded = false, onClose, onSwitchToSignup }) {
  const navigate = useNavigate();
  const [showPassword, setShowPassword] = useState(false);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleLogin(e) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const { token, user } = await loginApi(email, password);

      localStorage.setItem("accessToken", token);
      localStorage.setItem("user", JSON.stringify(user));
      localStorage.setItem("userRole", user.role);

      if (user.role === "doctor") navigate("/dashboardDoctor");
      else navigate("/dashboardPatient");

      if (embedded) onClose?.();
    } catch (err) {
      setError(err?.message || "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className={`relative flex items-center justify-center ${
        embedded ? "" : "min-h-screen p-6"
      }`}
    >
      {!embedded && (
        <>
          <img
            src={bgImage}
            alt="Healio background"
            className="absolute inset-0 h-full w-full object-cover"
          />
          <div className="absolute inset-0 bg-black/60" />
        </>
      )}
      <div className="relative z-10 w-full max-w-md rounded-2xl bg-white/10 backdrop-blur-sm border border-white/20 shadow-lg p-10">
        {embedded && (
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-white text-xl hover:opacity-80"
            aria-label="Close"
          >
            ✕
          </button>
        )}

        <div className="text-center">
          <h1 className="text-4xl font-extrabold text-white">Healio</h1>
          <p className="mt-2 text-sm text-white">Keeping your health in line.</p>
        </div>

        <form className="space-y-4 mt-8" onSubmit={handleLogin}>
          <div className="space-y-2">
            <label className="text-sm font-medium text-white">Email Address</label>
            <input
              type="email"
              placeholder="username@gmail.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              className="w-full h-11 bg-white rounded-lg border border-slate-300 text-slate-900 px-3 placeholder:text-slate-400 focus:ring-2 focus:outline-none focus:border-sky-500 focus:ring-sky-500"
              required
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-white">Password</label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                placeholder="•••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                className="w-full h-11 bg-white rounded-lg border border-slate-300 text-slate-900 px-3 placeholder:text-slate-400 focus:ring-2 focus:outline-none focus:border-sky-500 focus:ring-sky-500"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-sky-700 hover:text-sky-900"
              >
                {showPassword ? "Hide" : "Show"}
              </button>
            </div>
          </div>

          {error ? (
            <div className="text-sm text-red-100 bg-red-600/30 border border-red-200/30 rounded-lg p-2">
              {error}
            </div>
          ) : null}

          <button
            type="submit"
            disabled={loading}
            className="mt-3 w-full h-11 bg-sky-700 rounded-lg text-white font-semibold hover:bg-sky-600 transition disabled:opacity-70"
          >
            {loading ? "Logging in..." : "Login"}
          </button>

          <p className="text-center text-white text-sm">
            Don&apos;t have an account yet?{" "}
            <span
              onClick={() =>
                embedded ? onSwitchToSignup?.() : navigate("/signup")
              }
              className="text-sky-200 hover:underline cursor-pointer"
            >
              Sign up
            </span>
          </p>
        </form>
      </div>
    </div>
  );
}
