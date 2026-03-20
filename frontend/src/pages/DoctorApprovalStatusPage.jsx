import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "../components/Navbar";
import { getDoctorApplicationStatus } from "../api/doctorReview";
import { clearSession, getUser, updateSessionUser } from "../api/http";
import { DOCTOR_APPROVAL_STATUS, getPostAuthRoute } from "../utils/authRouting";

const statusStyles = {
  [DOCTOR_APPROVAL_STATUS.UNVERIFIED]: "bg-amber-100 text-amber-800 border-amber-200",
  [DOCTOR_APPROVAL_STATUS.PENDING]: "bg-sky-100 text-sky-800 border-sky-200",
  [DOCTOR_APPROVAL_STATUS.APPROVED]: "bg-emerald-100 text-emerald-800 border-emerald-200",
  [DOCTOR_APPROVAL_STATUS.REJECTED]: "bg-rose-100 text-rose-800 border-rose-200",
};

const statusLabels = {
  [DOCTOR_APPROVAL_STATUS.UNVERIFIED]: "Email not verified",
  [DOCTOR_APPROVAL_STATUS.PENDING]: "Pending approval",
  [DOCTOR_APPROVAL_STATUS.APPROVED]: "Approved",
  [DOCTOR_APPROVAL_STATUS.REJECTED]: "Rejected",
};

function statusMessage(application) {
  if (!application) return "";
  if (application.status === DOCTOR_APPROVAL_STATUS.APPROVED) {
    return "Your doctor account is approved. You can continue into the doctor dashboard.";
  }
  if (application.status === DOCTOR_APPROVAL_STATUS.REJECTED) {
    return "Your application is not approved yet. Review the notes below and update your profile if needed.";
  }
  if (!application.isVerified || application.status === DOCTOR_APPROVAL_STATUS.UNVERIFIED) {
    return "Verify your email first. Once verified, your doctor application can move into review.";
  }
  if (application.requestedMoreInfo) {
    return "A reviewer requested more information before approval can continue.";
  }
  return "Your application is in review. Doctor product features stay locked until approval is granted.";
}

function SummaryRow({ label, value }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white/80 px-4 py-3">
      <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">{label}</p>
      <p className="mt-1 text-sm font-medium text-slate-700">{value || "Not provided yet"}</p>
    </div>
  );
}

export default function DoctorApprovalStatusPage() {
  const navigate = useNavigate();
  const [application, setApplication] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    const user = getUser();
    if (!user) {
      navigate("/loginPage", { replace: true });
      return;
    }
    if (user.role !== "doctor") {
      navigate("/", { replace: true });
      return;
    }
  }, [navigate]);

  async function loadApplication(isRefresh = false) {
    setError("");
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const data = await getDoctorApplicationStatus();
      setApplication(data.application);

      const currentUser = getUser();
      if (currentUser) {
        const nextUser = {
          ...currentUser,
          doctorApprovalStatus: data.application?.status || currentUser.doctorApprovalStatus,
          doctorApprovalNotes: data.application?.notes || null,
          requestedMoreInfo: Boolean(data.application?.requestedMoreInfo),
          firstName: data.application?.profile?.firstName || currentUser.firstName,
          lastName: data.application?.profile?.lastName || currentUser.lastName,
          licenseNb: data.application?.profile?.licenseNb || currentUser.licenseNb,
        };
        updateSessionUser(nextUser);

        if (data.application?.status === DOCTOR_APPROVAL_STATUS.APPROVED) {
          navigate(getPostAuthRoute(nextUser), { replace: true });
          return;
        }
      }
    } catch (err) {
      if (err?.status === 403) {
        navigate("/", { replace: true });
        return;
      }
      setError(err?.message || "Failed to load doctor application status.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    loadApplication();
  }, []);

  const profile = application?.profile || {};
  const badgeStyle = statusStyles[application?.status] || "bg-slate-100 text-slate-700 border-slate-200";

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#f8fbfd_0%,#eef7fb_100%)]">
      <Navbar />
      <main className="mx-auto max-w-6xl px-6 pb-20 pt-32">
        <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <section className="rounded-[2rem] border border-white/70 bg-white/85 p-8 shadow-[0_35px_80px_-45px_rgba(15,23,42,0.35)] backdrop-blur-md">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.24em] text-sky-500">Doctor application</p>
                <h1 className="mt-3 text-4xl font-black tracking-tight text-slate-900">Approval Status</h1>
                <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-600">{statusMessage(application)}</p>
              </div>
              {application ? (
                <span className={`inline-flex rounded-full border px-4 py-2 text-sm font-semibold ${badgeStyle}`}>
                  {application.requestedMoreInfo && application.status === DOCTOR_APPROVAL_STATUS.PENDING
                    ? "More information requested"
                    : statusLabels[application.status] || application.status}
                </span>
              ) : null}
            </div>

            {error ? (
              <div className="mt-6 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                {error}
              </div>
            ) : null}

            {loading ? (
              <div className="mt-8 rounded-3xl border border-slate-200 bg-slate-50 px-6 py-10 text-sm text-slate-500">
                Loading your application...
              </div>
            ) : (
              <>
                <div className="mt-8 grid gap-4 md:grid-cols-2">
                  <SummaryRow label="Full name" value={[profile.firstName, profile.lastName].filter(Boolean).join(" ")} />
                  <SummaryRow label="Email" value={application?.email} />
                  <SummaryRow label="License number" value={profile.licenseNb} />
                  <SummaryRow label="Specialization" value={profile.specialization} />
                  <SummaryRow label="Years of experience" value={profile.yearsOfExperience ? `${profile.yearsOfExperience}` : ""} />
                  <SummaryRow label="Clinic name" value={profile.clinicName} />
                  <div className="md:col-span-2">
                    <SummaryRow label="Clinic address" value={profile.clinicAddress} />
                  </div>
                </div>

                {application?.notes ? (
                  <div className="mt-6 rounded-3xl border border-slate-200 bg-slate-50 px-5 py-4">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">Reviewer notes</p>
                    <p className="mt-3 text-sm leading-7 text-slate-700">{application.notes}</p>
                  </div>
                ) : null}
              </>
            )}
          </section>

          <aside className="rounded-[2rem] border border-sky-100 bg-white/85 p-8 shadow-[0_28px_70px_-45px_rgba(14,165,233,0.35)] backdrop-blur-md">
            <p className="text-sm font-semibold uppercase tracking-[0.22em] text-slate-400">Next steps</p>
            <div className="mt-5 space-y-4">
              <button
                type="button"
                onClick={() => loadApplication(true)}
                disabled={refreshing}
                className="flex h-12 w-full items-center justify-center rounded-2xl bg-slate-900 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-70"
              >
                {refreshing ? "Refreshing..." : "Refresh Status"}
              </button>
              <button
                type="button"
                onClick={() => navigate("/profileDoctor")}
                className="flex h-12 w-full items-center justify-center rounded-2xl border border-slate-300 bg-white text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                Update Application Details
              </button>
              {application?.status === DOCTOR_APPROVAL_STATUS.APPROVED ? (
                <button
                  type="button"
                  onClick={() => navigate("/dashboardDoctor")}
                  className="flex h-12 w-full items-center justify-center rounded-2xl border border-emerald-300 bg-emerald-50 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-100"
                >
                  Go to Doctor Dashboard
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => {
                  clearSession();
                  navigate("/", { replace: true });
                }}
                className="flex h-12 w-full items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 text-sm font-semibold text-slate-600 transition hover:bg-slate-100"
              >
                Log Out
              </button>
            </div>

            <div className="mt-8 rounded-3xl border border-slate-200 bg-slate-50 px-5 py-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">Review lifecycle</p>
              <ul className="mt-4 space-y-3 text-sm leading-6 text-slate-600">
                <li>Email verified doctor accounts move into approval review.</li>
                <li>Reviewers can approve, reject, or request more information.</li>
                <li>Doctor-only product pages stay locked until approval is complete.</li>
              </ul>
            </div>
          </aside>
        </div>
      </main>
    </div>
  );
}
