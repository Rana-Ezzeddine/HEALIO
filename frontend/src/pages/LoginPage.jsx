import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { login as loginApi } from "../api/auth";

export default function LoginPage() {
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

      // store auth
      localStorage.setItem("accessToken", token);
      localStorage.setItem("user", JSON.stringify(user));
      localStorage.setItem("userRole", user.role); // optional

      // route by role
      if (user.role === "doctor") navigate("/dashboardDoctor");
      else navigate("/dashboardPatient");
    } catch (err) {
      setError(err.message || "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#A0D6FF] to-[#cce9ff] flex items-center justify-center p-6">
      <div className="shadow-md shadow-white w-full max-w-md rounded-2xl bg-[#1B7AC3]/30 border border-[#5286AE]/10 p-10">
        <div className="text-center">
          <h1 className="text-4xl font-extrabold text-white">Healio</h1>
          <p className="mt-2 text-sm text-white">Keeping your health in line.</p>
        </div>

        <form className="space-y-4 mt-8" onSubmit={handleLogin}>
          <div className="space-y-5">
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

          <div className="space-y-5">
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
            className="mt-3 w-full h-11 bg-sky-700 rounded-lg text-white font-semibold hover:bg-[#1c84d4]/90 transition disabled:opacity-70"
          >
            {loading ? "Logging in..." : "Login"}
          </button>

          <p className="text-center text-white text-sm">
            Don't have an account yet?{" "}
            <span
              onClick={() => navigate("/signup")}
              className="text-sky-700 hover:underline cursor-pointer"
            >
              Sign up
            </span>
          </p>
        </form>
      </div>
    </div>
  );
}
