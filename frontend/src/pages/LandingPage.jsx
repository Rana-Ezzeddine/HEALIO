// src/pages/LandingPage.jsx
import { useEffect, useState } from "react";
import heroImg from "../assets/landingBg.png";

import LoginPage from "./LoginPage";
import SignupPage from "./SignupPage";

export default function LandingPage() {
  const [authView, setAuthView] = useState(null); // null | "login" | "signup"

  useEffect(() => {
    const handleEsc = (e) => {
      if (e.key === "Escape") setAuthView(null);
    };
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, []);

  const closeModal = () => setAuthView(null);

  return (
    <div className="relative min-h-screen">
      {/* Background locked to viewport */}
      <img
        src={heroImg}
        alt="Healio background"
        className="absolute inset-0 h-screen w-screen object-cover opacity-60"
      />
      <div className="absolute inset-0 bg-sky-950/50" />

      {/* Page content */}
      <div className="relative z-10">
        {/* HERO */}
        <section className="min-h-screen flex items-center justify-center text-center px-6">
          <div>
            <h1 className="text-5xl md:text-8xl font-black text-white">
              Healio
            </h1>
            <p className="mt-4 text-lg md:text-xl text-white">
              Keeping your health in line.
            </p>

            <div className="mt-12 flex justify-center gap-5">
              <button
                onClick={() => setAuthView("signup")}
                className="rounded-2xl bg-sky-400 px-8 py-3 font-semibold text-white hover:bg-sky-500 transition"
              >
                Sign Up
              </button>

              <button
                onClick={() => setAuthView("login")}
                className="rounded-2xl border border-white/60 bg-white/90 px-8 py-3 font-semibold text-slate-800 hover:bg-white transition"
              >
                Login
              </button>
            </div>
          </div>
        </section>

        {/* FEATURES */}
        <section className="w-full bg-white">
          <div className="max-w-6xl mx-auto px-6 py-12 grid grid-cols-1 gap-6 md:grid-cols-3">
            <div className="rounded-2xl bg-sky-50 border border-sky-100 p-6">
              <h3 className="text-lg font-semibold text-slate-800">
                Smart Appointments
              </h3>
              <p className="mt-2 text-sm text-slate-600">
                Book visits, manage schedules, and get reminders in seconds.
              </p>
            </div>
            <div className="rounded-2xl bg-sky-50 border border-sky-100 p-6">
              <h3 className="text-lg font-semibold text-slate-800">
                Health Records
              </h3>
              <p className="mt-2 text-sm text-slate-600">
                Keep your medical history organized and accessible anytime.
              </p>
            </div>
            <div className="rounded-2xl bg-sky-50 border border-sky-100 p-6">
              <h3 className="text-lg font-semibold text-slate-800">
                Secure Messaging
              </h3>
              <p className="mt-2 text-sm text-slate-600">
                Chat with doctors safely and get answers faster.
              </p>
            </div>
          </div>
        </section>

        {/* FOOTER */}
        <footer className="w-full bg-slate-100 border-t border-slate-200">
          <div className="max-w-6xl mx-auto px-6 py-4 flex flex-col items-center gap-3 text-center md:flex-row md:justify-between">
            <div className="text-sm text-slate-500">
              © 2026 Healio. All rights reserved.
            </div>
            <div className="flex gap-4 text-sm text-slate-500">
              <button className="hover:text-slate-700" type="button">
                Privacy
              </button>
              <button className="hover:text-slate-700" type="button">
                Terms
              </button>
              <button className="hover:text-slate-700" type="button">
                Support
              </button>
            </div>
          </div>
        </footer>
      </div>

      {/* MODAL (only card scrolls) */}
      {authView && (
        <div className="fixed inset-0 z-50">
          {/* backdrop */}
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={closeModal}
          />

          {/* centered modal */}
          <div className="relative min-h-full flex items-center justify-center px-4 py-10">
            <div className="w-full max-w-md max-h-[85vh] overflow-y-auto">
              {authView === "login" ? (
                <LoginPage
                  embedded
                  onClose={closeModal}
                  onSwitchToSignup={() => setAuthView("signup")}
                />
              ) : (
                <SignupPage
                  embedded
                  onClose={closeModal}
                  onSwitchToLogin={() => setAuthView("login")}
                />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
