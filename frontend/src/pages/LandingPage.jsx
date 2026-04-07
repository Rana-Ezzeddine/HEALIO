// src/pages/LandingPage.jsx
import { useEffect, useMemo, useRef, useState } from "react";
import logo from "../assets/logo.png";
import Navbar from "../components/Navbar";
import PublicFooter from "../components/PublicFooter";
import LoginPage from "./LoginPage";
import SignupPage from "./SignupPage";

export default function LandingPage() {
  const [authView, setAuthView] = useState(null); // null | "login" | "signup"
  const [mascotPosition, setMascotPosition] = useState(null);
  const [activeMascotTarget, setActiveMascotTarget] = useState(0);
  const modalScrollRef = useRef(null);
  const roleAnchorRef = useRef(null);
  const featureAnchorRef = useRef(null);
  const howAnchorRef = useRef(null);
  const trustAnchorRef = useRef(null);

  useEffect(() => {
    const handleEsc = (e) => {
      if (e.key === "Escape") setAuthView(null);
    };
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, []);

  useEffect(() => {
    if (!authView) {
      document.body.style.overflow = "";
      return;
    }

    document.body.style.overflow = "hidden";
    window.scrollTo({ top: 0, left: 0, behavior: "smooth" });
    window.requestAnimationFrame(() => {
      modalScrollRef.current?.scrollTo({ top: 0, left: 0, behavior: "auto" });
    });

    return () => {
      document.body.style.overflow = "";
    };
  }, [authView]);

  const closeModal = () => setAuthView(null);
  const mascotTargets = useMemo(
    () => [roleAnchorRef, featureAnchorRef, howAnchorRef, trustAnchorRef],
    []
  );

  useEffect(() => {
    const updateMascotTarget = () => {
      if (window.innerWidth < 768) {
        setMascotPosition(null);
        return;
      }

      const anchors = mascotTargets
        .map((ref, index) => ({ element: ref.current, index }))
        .filter((item) => item.element);

      if (!anchors.length) return;

      const pageTopStart = 0;
      const startPosition = {
        left: Math.max(84, window.innerWidth * 0.16),
        top: 132,
        pageY: pageTopStart,
      };

      const points = [
        startPosition,
        ...anchors.map(({ element, index }) => {
          const rect = element.getBoundingClientRect();
          return {
            left: rect.right - 20,
            top: window.scrollY + rect.top - 26,
            pageY: window.scrollY + rect.top,
            index,
          };
        }),
      ];

      const triggerScroll = window.scrollY + window.innerHeight * 0.42;
      let segmentIndex = 0;

      for (let i = 0; i < points.length - 1; i += 1) {
        if (triggerScroll >= points[i].pageY && triggerScroll <= points[i + 1].pageY) {
          segmentIndex = i;
          break;
        }
        if (triggerScroll > points[points.length - 1].pageY) {
          segmentIndex = points.length - 2;
        }
      }

      const fromPoint = points[segmentIndex];
      const toPoint = points[segmentIndex + 1];
      const distance = Math.max(1, toPoint.pageY - fromPoint.pageY);
      const rawT = Math.min(1, Math.max(0, (triggerScroll - fromPoint.pageY) / distance));
      const easedT = rawT * rawT * (3 - 2 * rawT);
      const horizontalDirection = toPoint.left >= fromPoint.left ? 1 : -1;
      const horizontalDistance = Math.abs(toPoint.left - fromPoint.left);
      const verticalDistance = Math.abs(toPoint.top - fromPoint.top);
      const controlPoint = {
        left: (fromPoint.left + toPoint.left) / 2 + horizontalDirection * Math.max(22, horizontalDistance * 0.12),
        top: Math.min(fromPoint.top, toPoint.top) - Math.max(110, Math.min(190, 90 + verticalDistance * 0.32 + horizontalDistance * 0.08)),
      };
      const inv = 1 - easedT;
      const left =
        inv * inv * fromPoint.left +
        2 * inv * easedT * controlPoint.left +
        easedT * easedT * toPoint.left;
      const top =
        inv * inv * fromPoint.top +
        2 * inv * easedT * controlPoint.top +
        easedT * easedT * toPoint.top;

      setMascotPosition({ left, top });
      setActiveMascotTarget(Math.min(Math.max(segmentIndex, 0), mascotTargets.length - 1));
    };

    updateMascotTarget();
    window.addEventListener("scroll", updateMascotTarget, { passive: true });
    window.addEventListener("resize", updateMascotTarget);

    return () => {
      window.removeEventListener("scroll", updateMascotTarget);
      window.removeEventListener("resize", updateMascotTarget);
    };
  }, [mascotTargets]);

  return (
    <div className="relative min-h-screen overflow-hidden bg-slate-50 text-slate-900">
      <Navbar
        onLogin={() => setAuthView("login")}
        onSignup={() => setAuthView("signup")}
      />

      <div className="absolute inset-0 bg-slate-50" />
      <div className="landing-grid landing-grid-motion absolute inset-0 opacity-45" />
      <div className="landing-orb-1 absolute left-[7%] top-28 h-28 w-28 rounded-full bg-sky-200/55 blur-2xl" />
      <div className="landing-orb-2 absolute right-[10%] top-40 h-32 w-32 rounded-full bg-cyan-200/50 blur-2xl" />
      <div className="landing-orb-3 absolute left-[16%] top-[54%] h-20 w-20 rounded-full bg-amber-100/65 blur-xl" />
      <div className="landing-orb-2 absolute right-[16%] top-[62%] h-24 w-24 rounded-full bg-emerald-100/55 blur-xl" />
      <div className="landing-orb-1 absolute bottom-24 left-1/2 h-36 w-36 -translate-x-1/2 rounded-full bg-blue-100/55 blur-3xl" />
      <div className="landing-line absolute left-[12%] top-[22%] h-px w-24 bg-sky-300/70" />
      <div className="landing-line absolute right-[18%] top-[30%] h-px w-16 bg-cyan-300/70" />
      <div className="landing-line absolute left-[22%] bottom-[22%] h-px w-20 bg-emerald-300/60" />
      <div className="landing-line absolute right-[24%] bottom-[18%] h-px w-28 bg-amber-300/60" />

      {mascotPosition ? (
        <div
          className="pointer-events-none absolute z-20 hidden md:block"
          style={{ left: mascotPosition.left, top: mascotPosition.top }}
          aria-hidden="true"
        >
          <div key={activeMascotTarget} className="landing-mascot-hop relative">
            <div className="landing-light absolute left-1/2 top-1/2 h-28 w-28 -translate-x-1/2 -translate-y-1/2 rounded-full bg-sky-200/45 blur-2xl" />
            <div className="landing-sparkle absolute -left-4 top-1 h-2.5 w-2.5 rounded-full bg-amber-300 shadow-[0_0_14px_rgba(251,191,36,0.9)]" />
            <div className="landing-sparkle absolute -right-3 top-5 h-2 w-2 rounded-full bg-cyan-300 shadow-[0_0_14px_rgba(103,232,249,0.9)] [animation-delay:0.45s]" />
            <div className="landing-sparkle absolute left-2 bottom-0 h-1.5 w-1.5 rounded-full bg-emerald-300 shadow-[0_0_12px_rgba(110,231,183,0.9)] [animation-delay:0.9s]" />
            <div className="landing-sparkle absolute right-3 -bottom-1 h-2 w-2 rounded-full bg-sky-300 shadow-[0_0_14px_rgba(125,211,252,0.9)] [animation-delay:1.2s]" />

            <div className="relative flex h-16 w-16 items-center justify-center rounded-full border border-white/80 bg-white/92 shadow-xl">
              <div className="relative h-9 w-9 rounded-full bg-gradient-to-br from-sky-400 via-cyan-300 to-emerald-300">
                <div className="absolute left-1.5 top-2 h-1.5 w-1.5 rounded-full bg-slate-800" />
                <div className="absolute right-1.5 top-2 h-1.5 w-1.5 rounded-full bg-slate-800" />
                <div className="absolute left-1/2 top-5 h-2 w-4 -translate-x-1/2 rounded-b-full border-b-2 border-slate-800" />
              </div>
            </div>
          </div>
        </div>
      ) : null}

      <div className="relative z-10">
        <section className="flex min-h-screen items-center justify-center px-6 pb-20 pt-24 text-center">
          <div className="max-w-3xl">
            <img
              src={logo}
              alt="Healio logo"
              className="landing-reveal mx-auto mb-5 h-40 w-auto landing-delay-1"
            />
            <h1 className="landing-reveal landing-delay-2 text-2xl font-extrabold leading-tight md:text-4xl">
              HEALIO helps patients, caregivers, and doctors coordinate care in one secure place.
            </h1>

            <p className="landing-reveal landing-delay-3 mx-auto mt-6 max-w-2xl text-lg leading-8 text-slate-600">
              Track medications and symptoms, coordinate appointments, stay aligned with your care team, and respond faster when care becomes urgent.
            </p>

            <div className="landing-reveal landing-delay-4 mt-10 flex flex-col justify-center gap-4 sm:flex-row">
              <button
                onClick={() => setAuthView("signup")}
                className="rounded-xl bg-gradient-to-b from-cyan-400 to-blue-500 px-8 py-3 font-semibold text-white transition duration-200 hover:-translate-y-1 hover:from-cyan-500 hover:to-blue-600 hover:shadow-lg"
              >
                Get Started
              </button>

              <button
                onClick={() => setAuthView("login")}
                className="rounded-xl border border-slate-300 bg-white px-8 py-3 font-semibold text-slate-700 transition duration-200 hover:-translate-y-1 hover:bg-slate-100 hover:shadow-lg"
              >
                I already have an account
              </button>
            </div>

            <div className="mt-12 grid gap-4 text-left md:grid-cols-3">
              <QuickFact className="landing-reveal landing-delay-2" title="Role-Aware Access" text="Patients, caregivers, and doctors each see only the actions and information intended for their role." />
              <QuickFact className="landing-reveal landing-delay-3" title="Connected Care Team" text="Keep everyone aligned across medications, symptoms, appointments, and updates." />
              <QuickFact className="landing-reveal landing-delay-4" title="Safer Doctor Access" text="Doctor accounts are verified and approval-controlled before doctor product access is granted." />
            </div>
          </div>
        </section>

        <section id="roles" className="py-24">
          <div className="max-w-6xl mx-auto px-6">
            <div className="mx-auto max-w-3xl text-center">
              <span className="rounded-full bg-white px-4 py-1 text-sm font-semibold text-sky-700 shadow-sm">Who HEALIO is for</span>
              <h2 className="mt-5 text-3xl font-bold md:text-4xl">Three roles. One coordinated care experience.</h2>
              <p className="mt-4 text-lg text-slate-600">
                HEALIO is designed for the people directly involved in care, each with a different level of visibility and responsibility.
              </p>
            </div>

            <div className="mt-14 grid grid-cols-1 gap-8 md:grid-cols-3">
              <Feature
                anchorRef={roleAnchorRef}
                className="landing-reveal landing-delay-1"
                variant="patient"
                title="Patient"
                text="Track medications, symptoms, appointments, care updates, and emergency status from one place."
              />
              <Feature
                className="landing-reveal landing-delay-2"
                variant="caregiver"
                title="Caregiver"
                text="Support a patient’s day-to-day care with permission-aware access to the right information and tasks."
              />
              <Feature
                className="landing-reveal landing-delay-3"
                variant="doctor"
                title="Doctor"
                text="Review patient information, manage appointments, monitor updates, and coordinate treatment once approved."
              />
            </div>
          </div>
        </section>

        <section id="features" className="py-24 bg-white/60">
          <div className="mx-auto max-w-6xl px-6">
            <div className="mx-auto max-w-3xl text-center">
              <span className="rounded-full bg-sky-100 px-4 py-1 text-sm font-semibold text-sky-700">Core feature areas</span>
              <h2 className="mt-5 text-3xl font-bold md:text-4xl">Everything important stays connected.</h2>
              <p className="mt-4 text-lg text-slate-600">
                HEALIO organizes the product around the recurring parts of care that users need to manage together.
              </p>
            </div>

            <div className="mt-14 grid gap-6 md:grid-cols-2 xl:grid-cols-3">
              <Feature
                anchorRef={featureAnchorRef}
                className="landing-reveal landing-delay-1"
                variant="feature"
                icon="pill"
                tone="sky"
                title="Medications"
                text="View and manage treatment information, schedules, and changes over time."
              />
              <Feature
                className="landing-reveal landing-delay-2"
                variant="feature"
                icon="pulse"
                tone="rose"
                title="Symptoms"
                text="Track symptom activity, spot trends, and share context with the right care participants."
              />
              <Feature
                className="landing-reveal landing-delay-3"
                variant="feature"
                icon="calendar"
                tone="amber"
                title="Appointments"
                text="Coordinate visits, requests, and availability without losing the timeline."
              />
              <Feature
                className="landing-reveal landing-delay-2"
                variant="feature"
                icon="nodes"
                tone="emerald"
                title="Care Team"
                text="Support patient-doctor and caregiver relationships with role-aware access boundaries."
              />
              <Feature
                className="landing-reveal landing-delay-3"
                variant="feature"
                icon="spark"
                tone="violet"
                title="Updates"
                text="Keep everyone aligned on progress, notes, and meaningful changes in care."
              />
              <Feature
                className="landing-reveal landing-delay-4"
                variant="feature"
                icon="alert"
                tone="cyan"
                title="Emergency Support"
                text="Highlight urgent situations and support faster communication when care becomes critical."
              />
            </div>
          </div>
        </section>

        <section id="how-it-works" className="py-24">
          <div className="max-w-4xl mx-auto px-6">
            <div className="mx-auto max-w-3xl text-center">
              <span className="rounded-full bg-white px-4 py-1 text-sm font-semibold text-sky-700 shadow-sm">How it works</span>
              <h2 className="mt-5 text-3xl font-bold md:text-4xl">A first-time user should understand the flow immediately.</h2>
            </div>

            <div className="mt-14 grid gap-5">
              <HowStep
                anchorRef={howAnchorRef}
                className="landing-reveal landing-delay-1"
                number="1"
                title="Create an account and choose your role"
                text="Sign up as a patient, caregiver, or doctor so HEALIO can tailor the right experience and permissions."
              />
              <HowStep
                className="landing-reveal landing-delay-2"
                number="2"
                title="Verify your email and complete your setup"
                text="Email verification activates the account, while doctor accounts may also require approval before doctor-specific access is granted."
              />
              <HowStep
                className="landing-reveal landing-delay-3"
                number="3"
                title="Connect the right people"
                text="Patients, caregivers, and approved doctors are linked through role-aware relationships instead of open access."
              />
              <HowStep
                className="landing-reveal landing-delay-4"
                number="4"
                title="Manage care in one place"
                text="Use HEALIO to stay on top of medications, symptoms, appointments, updates, and urgent support needs."
              />
            </div>
          </div>
        </section>

        <section id="trust" className="py-24">
          <div className="mx-auto max-w-6xl px-6">
            <div className="rounded-[2rem] bg-gradient-to-br from-slate-900 via-sky-950 to-slate-900 p-8 text-white shadow-2xl md:p-12">
              <div className="max-w-3xl">
                <span className="rounded-full bg-white/10 px-4 py-1 text-sm font-semibold text-sky-100">Trust and safety</span>
                <h2 className="mt-5 text-3xl font-bold md:text-4xl">Care access should feel structured, not exposed.</h2>
                <p className="mt-4 text-lg leading-8 text-sky-50/85">
                  HEALIO is built around controlled access, verified identities, and safer visibility across roles.
                </p>
              </div>

              <div className="mt-10 grid gap-5 md:grid-cols-3">
                <TrustCard
                  anchorRef={trustAnchorRef}
                  className="landing-reveal landing-delay-1"
                  title="Doctor verification"
                  text="Doctor accounts can require both email verification and admin approval. A license number alone does not automatically unlock doctor access."
                />
                <TrustCard
                  className="landing-reveal landing-delay-2"
                  title="Role-based access"
                  text="Patients, caregivers, and doctors do not share the same permissions. Access is shaped by role and approved relationship context."
                />
                <TrustCard
                  className="landing-reveal landing-delay-3"
                  title="Safer information sharing"
                  text="Patient data should only appear through intended linking, permissions, and product flows, not open discovery."
                />
              </div>
            </div>
          </div>
        </section>

        <section className="py-24">
          <div className="mx-auto max-w-4xl px-6">
            <div className="relative overflow-hidden rounded-[2rem] border border-sky-300/45 bg-[linear-gradient(135deg,rgba(240,249,255,0.98),rgba(236,253,245,0.96),rgba(255,251,235,0.96))] p-8 shadow-[0_28px_80px_rgba(14,116,144,0.14)] md:p-12">
              <div className="pointer-events-none absolute inset-0 rounded-[2rem] bg-[linear-gradient(135deg,rgba(14,165,233,0.12),rgba(34,197,94,0.05),rgba(245,158,11,0.12))] opacity-80" />
              <div className="pointer-events-none absolute inset-[2px] rounded-[calc(2rem-2px)] bg-[linear-gradient(135deg,rgba(240,249,255,0.98),rgba(236,253,245,0.96),rgba(255,251,235,0.96))]" />
              <div className="pointer-events-none absolute inset-[12px] rounded-[1.45rem] border border-slate-200/70" />
              <div className="pointer-events-none absolute left-5 top-5 h-10 w-10 rounded-tl-[1.1rem] border-l-4 border-t-4 border-sky-500/85" />
              <div className="pointer-events-none absolute right-5 top-5 h-10 w-10 rounded-tr-[1.1rem] border-r-4 border-t-4 border-cyan-400/80" />
              <div className="pointer-events-none absolute bottom-5 left-5 h-10 w-10 rounded-bl-[1.1rem] border-b-4 border-l-4 border-emerald-400/80" />
              <div className="pointer-events-none absolute bottom-5 right-5 h-10 w-10 rounded-br-[1.1rem] border-b-4 border-r-4 border-amber-400/85" />
              <div className="pointer-events-none absolute left-20 top-0 h-[3px] w-28 rounded-full bg-gradient-to-r from-sky-500/0 via-sky-500/80 to-cyan-400/0" />
              <div className="pointer-events-none absolute bottom-0 right-16 h-[3px] w-24 rounded-full bg-gradient-to-r from-amber-400/0 via-amber-400/80 to-cyan-400/0" />
              <div className="pointer-events-none absolute left-0 top-16 h-20 w-[3px] rounded-full bg-gradient-to-b from-sky-500/0 via-sky-500/75 to-emerald-400/0" />
              <div className="pointer-events-none absolute bottom-14 right-0 h-16 w-[3px] rounded-full bg-gradient-to-b from-cyan-400/0 via-cyan-400/75 to-amber-400/0" />
              <div className="absolute -left-10 top-8 h-32 w-32 rounded-full bg-sky-200/50 blur-3xl" />
              <div className="absolute -right-6 bottom-6 h-36 w-36 rounded-full bg-cyan-200/45 blur-3xl" />
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.75),transparent_55%)]" />

              <div className="relative text-center">
                <span className="inline-flex rounded-full border border-sky-200 bg-white/80 px-4 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-sky-700 shadow-sm">
                  Ready When You Are
                </span>

                <h3 className="mt-5 text-3xl font-bold tracking-tight text-slate-900">
                  Start caring with more clarity and less friction.
                </h3>
                <p className="mx-auto mt-4 max-w-2xl text-slate-600">
                  Create your account, verify your email, and begin coordinating care in one place.
                </p>

                <button
                  onClick={() => setAuthView("signup")}
                  className="group mt-10 inline-flex items-center gap-3 rounded-full border border-sky-200 bg-white px-4 py-4 pr-6 shadow-[0_16px_40px_rgba(14,116,144,0.16)] transition duration-300 hover:-translate-y-1 hover:shadow-[0_24px_56px_rgba(14,116,144,0.22)]"
                >
                  <span className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-sky-500 via-cyan-400 to-emerald-300 text-lg font-black text-white shadow-[0_10px_24px_rgba(14,165,233,0.35)] transition duration-300 group-hover:scale-105">
                    +
                  </span>
                  <span className="text-left">
                    <span className="block text-xs font-semibold uppercase tracking-[0.22em] text-sky-600">
                      Start Now
                    </span>
                    <span className="mt-1 block text-base font-bold text-slate-900">
                      Create your account
                    </span>
                  </span>
                  <span className="ml-1 text-xl text-sky-500 transition duration-300 group-hover:translate-x-1">
                    →
                  </span>
                </button>
              </div>
            </div>
          </div>
        </section>

        <PublicFooter />
      </div>

      {/* MODAL */}
      {authView && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div
            className="modal-fade-in absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={closeModal}
          />

          <div
            ref={modalScrollRef}
            className="relative flex min-h-full items-start justify-center overflow-y-auto px-4 pt-8 pb-8 md:px-6 md:pt-12 md:pb-12"
          >
            <div className="modal-pop-in w-full max-w-lg max-h-[calc(100vh-4rem)] overflow-y-auto scrollbar-hide rounded-3xl md:max-h-[calc(100vh-6rem)]">
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

const roleCardStyles = {
  patient: {
    shell: "border-sky-200/80 bg-[linear-gradient(180deg,rgba(240,249,255,0.98),rgba(255,255,255,0.96))] shadow-[0_18px_40px_rgba(14,165,233,0.14)]",
    badge: "bg-sky-500 text-white",
    accent: "from-sky-400/70 to-cyan-300/20",
    rail: "from-sky-500 via-cyan-400 to-transparent",
  },
  caregiver: {
    shell: "border-emerald-200/80 bg-[linear-gradient(180deg,rgba(236,253,245,0.98),rgba(255,255,255,0.96))] shadow-[0_18px_40px_rgba(16,185,129,0.14)]",
    badge: "bg-emerald-500 text-white",
    accent: "from-emerald-400/70 to-teal-300/20",
    rail: "from-emerald-500 via-teal-400 to-transparent",
  },
  doctor: {
    shell: "border-violet-200/80 bg-[linear-gradient(180deg,rgba(245,243,255,0.98),rgba(255,255,255,0.96))] shadow-[0_18px_40px_rgba(139,92,246,0.14)]",
    badge: "bg-violet-500 text-white",
    accent: "from-violet-400/70 to-fuchsia-300/20",
    rail: "from-violet-500 via-fuchsia-400 to-transparent",
  },
};

const featureCardStyles = {
  sky: {
    shell: "border-sky-200/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(240,249,255,0.98))] shadow-[0_18px_36px_rgba(14,165,233,0.08)]",
    glow: "bg-sky-200/55",
    iconWrap: "bg-sky-100 text-sky-700 border-sky-200",
    rail: "from-sky-400 via-cyan-300 to-transparent",
    chip: "bg-sky-50 text-sky-700 border-sky-200",
  },
  rose: {
    shell: "border-rose-200/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(255,241,242,0.98))] shadow-[0_18px_36px_rgba(244,63,94,0.08)]",
    glow: "bg-rose-200/55",
    iconWrap: "bg-rose-100 text-rose-700 border-rose-200",
    rail: "from-rose-400 via-orange-300 to-transparent",
    chip: "bg-rose-50 text-rose-700 border-rose-200",
  },
  amber: {
    shell: "border-amber-200/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(255,251,235,0.98))] shadow-[0_18px_36px_rgba(245,158,11,0.08)]",
    glow: "bg-amber-200/55",
    iconWrap: "bg-amber-100 text-amber-700 border-amber-200",
    rail: "from-amber-400 via-yellow-300 to-transparent",
    chip: "bg-amber-50 text-amber-700 border-amber-200",
  },
  emerald: {
    shell: "border-emerald-200/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(236,253,245,0.98))] shadow-[0_18px_36px_rgba(16,185,129,0.08)]",
    glow: "bg-emerald-200/55",
    iconWrap: "bg-emerald-100 text-emerald-700 border-emerald-200",
    rail: "from-emerald-400 via-teal-300 to-transparent",
    chip: "bg-emerald-50 text-emerald-700 border-emerald-200",
  },
  violet: {
    shell: "border-violet-200/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(245,243,255,0.98))] shadow-[0_18px_36px_rgba(139,92,246,0.08)]",
    glow: "bg-violet-200/55",
    iconWrap: "bg-violet-100 text-violet-700 border-violet-200",
    rail: "from-violet-400 via-fuchsia-300 to-transparent",
    chip: "bg-violet-50 text-violet-700 border-violet-200",
  },
  cyan: {
    shell: "border-cyan-200/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(236,254,255,0.98))] shadow-[0_18px_36px_rgba(6,182,212,0.08)]",
    glow: "bg-cyan-200/55",
    iconWrap: "bg-cyan-100 text-cyan-700 border-cyan-200",
    rail: "from-cyan-400 via-sky-300 to-transparent",
    chip: "bg-cyan-50 text-cyan-700 border-cyan-200",
  },
};

function Feature({ title, text, className = "", anchorRef = null, variant = null, icon = null, tone = "sky" }) {
  const themed = roleCardStyles[variant] || null;
  const featureTheme = variant === "feature" ? featureCardStyles[tone] || featureCardStyles.sky : null;

  return (
    <div
      ref={anchorRef}
      className={`relative overflow-hidden rounded-[1.6rem] border p-6 shadow-sm transition duration-300 hover:-translate-y-1.5 hover:shadow-2xl ${
        themed ? themed.shell : featureTheme ? featureTheme.shell : "border-slate-200 bg-white"
      } ${className}`}
    >
      {themed ? (
        <>
          <div className={`pointer-events-none absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${themed.rail}`} />
          <div className={`pointer-events-none absolute -right-8 top-6 h-24 w-24 rounded-full bg-gradient-to-br ${themed.accent} blur-2xl`} />
          <div className="pointer-events-none absolute inset-[10px] rounded-[1.2rem] border border-white/70" />
        </>
      ) : featureTheme ? (
        <>
          <div className={`pointer-events-none absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${featureTheme.rail}`} />
          <div className={`pointer-events-none absolute -right-8 top-5 h-24 w-24 rounded-full ${featureTheme.glow} blur-2xl`} />
          <div className="pointer-events-none absolute inset-[10px] rounded-[1.2rem] border border-white/70" />
        </>
      ) : null}

      <div className="relative">
        {themed ? (
          <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] ${themed.badge}`}>
            Role
          </span>
        ) : featureTheme ? (
          <div className="flex items-start justify-between gap-4">
            <div className={`flex h-12 w-12 items-center justify-center rounded-2xl border ${featureTheme.iconWrap}`}>
              <FeatureGlyph icon={icon} />
            </div>
            <span className={`inline-flex rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] ${featureTheme.chip}`}>
              Feature
            </span>
          </div>
        ) : null}
        <h4 className={`${themed || featureTheme ? "mt-4" : ""} text-xl font-semibold text-slate-800`}>{title}</h4>
        <p className="mt-3 text-sm leading-6 text-slate-600">{text}</p>
      </div>
    </div>
  );
}

function FeatureGlyph({ icon }) {
  if (icon === "pill") {
    return <div className="h-3 w-7 rounded-full border-2 border-current rotate-[-18deg]" />;
  }
  if (icon === "pulse") {
    return (
      <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M3 12h4l2-4 4 8 2-4h6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  if (icon === "calendar") {
    return (
      <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="4" y="5" width="16" height="15" rx="3" />
        <path d="M8 3v4M16 3v4M4 10h16" strokeLinecap="round" />
      </svg>
    );
  }
  if (icon === "nodes") {
    return (
      <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="6" cy="12" r="2" />
        <circle cx="18" cy="6" r="2" />
        <circle cx="18" cy="18" r="2" />
        <path d="M8 12h6M16.5 7.5l-3.5 3M16.5 16.5l-3.5-3" strokeLinecap="round" />
      </svg>
    );
  }
  if (icon === "spark") {
    return (
      <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3Z" strokeLinejoin="round" />
      </svg>
    );
  }
  if (icon === "alert") {
    return (
      <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M12 4l8 14H4L12 4Z" strokeLinejoin="round" />
        <path d="M12 9v4M12 16h.01" strokeLinecap="round" />
      </svg>
    );
  }

  return <div className="h-3 w-3 rounded-full bg-current" />;
}

function QuickFact({ title, text, className = "" }) {
  return (
    <div className={`rounded-2xl border border-slate-200 bg-white/80 p-5 shadow-sm ${className}`}>
      <h3 className="text-sm font-bold uppercase tracking-[0.15em] text-sky-700">{title}</h3>
      <p className="mt-3 text-sm leading-6 text-slate-600">{text}</p>
    </div>
  );
}

function HowStep({ number, title, text, className = "", anchorRef = null }) {
  return (
    <div ref={anchorRef} className={`flex gap-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm ${className}`}>
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-sky-500 text-lg font-bold text-white">
        {number}
      </div>
      <div>
        <h3 className="text-lg font-bold text-slate-900">{title}</h3>
        <p className="mt-2 text-sm leading-6 text-slate-600">{text}</p>
      </div>
    </div>
  );
}

function TrustCard({ title, text, className = "", anchorRef = null }) {
  return (
    <div ref={anchorRef} className={`rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur ${className}`}>
      <h3 className="text-lg font-bold text-white">{title}</h3>
      <p className="mt-3 text-sm leading-6 text-sky-50/80">{text}</p>
    </div>
  );
}
