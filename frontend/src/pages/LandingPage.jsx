// src/pages/LandingPage.jsx
import { useEffect, useState } from "react";
import logo from "../assets/logo.png";
import Navbar from "../components/Navbar";
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
    <div className="relative min-h-screen overflow-hidden bg-slate-50 text-slate-900">
      <Navbar
        onLogin={() => setAuthView("login")}
        onSignup={() => setAuthView("signup")}
      />

      
      <div className="absolute -top-40 -left-40 h-96 w-96 rounded-full bg-sky-200/60 blur-3xl" />
      <div className="absolute top-1/2 -right-40 h-96 w-96 rounded-full bg-indigo-200/60 blur-3xl" />

      <div className="relative z-10">
        <section className="min-h-screen pt-15 flex items-center justify-center px-6 text-center">

          <div className="max-w-2xl">
            <img
              src={logo}
              alt="Healio logo"
              className="mx-auto mb-5 h-40 w-auto"
            />
            
              <span className="inline-block mb-4 rounded-full bg-sky-100 px-4 py-1 text-sm font-medium text-sky-700">
                Your digital health companion
              </span>

              <h1 className="text-4xl md:text-6xl font-extrabold leading-tight">
                Take control of your <br />
                <span className="bg-gradient-to-r from-cyan-400 to-blue-500 text-transparent bg-clip-text">health journey</span>
              </h1>

              <p className="mt-6 text-lg text-slate-600 max-w-xl">
                Healio helps you manage appointments, organize medical records,
                and stay connected with your doctors — all in one secure place.
              </p>

              <div className="mt-10 flex flex-col sm:flex-row justify-center gap-4">
                <button
                  onClick={() => setAuthView("signup")}
                  className="rounded-xl bg-gradient-to-b from-cyan-400 to-blue-500 px-8 py-3 font-semibold text-white
                             hover:from-cyan-500 hover:to-blue-600 transition shadow-lg transition-transform duration-200 hover:-translate-y-1 hover:shadow-lg"
                >
                  Get Started
                </button>

                <button
                  onClick={() => setAuthView("login")}
                  className="rounded-xl border border-slate-300 bg-white px-8 py-3
                             font-semibold text-slate-700
                             hover:bg-slate-100 transition transition-transform duration-200 hover:-translate-y-1 hover:shadow-lg"
                >
                  I already have an account
                </button>
              </div>
            </div>
        </section>

        <section className="py-24 ">
          <div className="max-w-6xl mx-auto px-6">
            <h2 className="text-3xl md:text-4xl font-bold text-center mb-16">
              Designed for real life
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <Feature
                title="Appointments"
                text="Schedule, reschedule, and never miss a visit again."
              />
              <Feature
                title="Medical Records"
                text="Your health history, organized and always available."
              />
              <Feature
                title="Doctor Chat"
                text="Secure messaging that keeps you connected."
              />
            </div>
          </div>
        </section>

        <section className="py-24">
          <div className="max-w-4xl mx-auto px-6">
            <div className="rounded-3xl bg-gradient-to-br from-sky-400 to-indigo-400 p-1">
              <div className="rounded-3xl bg-white px-8 py-14 text-center shadow-xl">
                <h3 className="text-3xl font-bold">
                  Start caring for your health today
                </h3>
                <p className="mt-4 text-slate-600">
                  It only takes a minute to create your account.
                </p>

                <button
                  onClick={() => setAuthView("signup")}
                  className="mt-8 rounded-xl bg-gradient-to-b from-cyan-400 to-blue-500 px-10 py-3 font-semibold text-white
                             hover:from-cyan-500 hover:to-blue-600 transition shadow transition-transform duration-200 hover:-translate-y-1 hover:shadow-lg"
                >
                  Create your account
                </button>
              </div>
            </div>
          </div>
        </section>

        <footer className="border-t border-slate-200 py-6 bg-white/70">
          <div className="max-w-6xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-slate-500">
            <span>© 2026 Healio</span>
            <div className="flex gap-6">
              <button className="hover:text-slate-800">Privacy</button>
              <button className="hover:text-slate-800">Terms</button>
              <button className="hover:text-slate-800">Support</button>
            </div>
          </div>
        </footer>
      </div>

      {/* MODAL */}
      {authView && (
        <div className="fixed inset-0 z-50">
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={closeModal}
          />

          <div className="relative min-h-full flex items-center justify-center px-4 py-10">
            <div className="w-full max-w-md max-h-[85vh] overflow-y-auto scrollbar-hide">
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

function Feature({ title, text }) {
  return (
    <div className="rounded-2xl bg-white border border-slate-200 p-6 shadow-sm
                    hover:shadow-md transition transition-transform duration-200 hover:-translate-y-1 hover:shadow-2xl">
      <h4 className="text-xl font-semibold text-slate-800">{title}</h4>
      <p className="mt-3 text-slate-600 text-sm">{text}</p>
    </div>
  );
}
