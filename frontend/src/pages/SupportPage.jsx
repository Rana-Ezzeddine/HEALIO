import PublicPageShell from "../components/PublicPageShell";

function SupportTopic({ title, text }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
      <h2 className="text-lg font-bold text-slate-900">{title}</h2>
      <p className="mt-2 text-sm leading-6 text-slate-600">{text}</p>
    </div>
  );
}

export default function SupportPage() {
  return (
    <PublicPageShell
      title="Support"
      intro="Need help with HEALIO? Use the guidance below for account access, verification, password recovery, and doctor application questions."
    >
      <section className="grid gap-6 md:grid-cols-2">
        <SupportTopic
          title="Contact Support"
          text="Email support@healio.local for account, access, and application issues. Include the email address tied to your account so we can help faster."
        />
        <SupportTopic
          title="Response Expectations"
          text="HEALIO support is intended for platform help, not urgent medical advice. Expect a response within 1-2 business days."
        />
      </section>

      <section>
        <h2 className="text-2xl font-bold text-slate-900">Common Topics</h2>
        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <SupportTopic
            title="Email Verification"
            text="If your verification link expires, request a new email from the login or verification screen."
          />
          <SupportTopic
            title="Password Reset"
            text="Use Forgot Password from the login screen to request a secure reset link."
          />
          <SupportTopic
            title="Doctor Applications"
            text="Doctor accounts may remain pending until reviewed. If more information is requested, update your application details and check the review notes."
          />
          <SupportTopic
            title="Privacy Questions"
            text="Questions about role-based access, account visibility, or data handling should be sent to support with as much context as possible."
          />
        </div>
      </section>

      <section className="rounded-2xl border border-red-200 bg-red-50 p-6">
        <h2 className="text-xl font-bold text-red-900">Emergency Notice</h2>
        <p className="mt-2 text-sm leading-6 text-red-800">
          HEALIO support cannot provide emergency medical care. If you are facing a medical emergency, contact local emergency services immediately.
        </p>
      </section>
    </PublicPageShell>
  );
}
