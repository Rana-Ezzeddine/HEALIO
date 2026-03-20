import PublicPageShell from "../components/PublicPageShell";

function PolicySection({ title, children }) {
  return (
    <section>
      <h2 className="text-2xl font-bold text-slate-900">{title}</h2>
      <div className="mt-3 space-y-3 text-sm leading-7 text-slate-600">{children}</div>
    </section>
  );
}

export default function PrivacyPage() {
  return (
    <PublicPageShell
      title="Privacy Policy"
      intro="HEALIO is designed around role-based access and relationship-based visibility. This page explains what information the platform handles and how access is limited."
    >
      <PolicySection title="What HEALIO Collects">
        <p>HEALIO may collect account details, profile information, health-related entries, appointment information, communication records, and doctor application details.</p>
      </PolicySection>

      <PolicySection title="How HEALIO Uses Your Information">
        <p>Information is used to support account access, care coordination, appointment flows, reminders, health tracking, and approved communication between the right people.</p>
      </PolicySection>

      <PolicySection title="How Role-Based Access Works">
        <p>Patients, caregivers, and doctors do not receive the same access. The platform limits what each role can view and do based on account type and approved relationships.</p>
      </PolicySection>

      <PolicySection title="When Data Is Shared">
        <p>Patient information should only be visible through approved linking, permissions, and product flows intended for that relationship. Unapproved doctors should not appear in patient discovery or linking flows.</p>
      </PolicySection>

      <PolicySection title="Doctor Verification and Access Control">
        <p>Doctor accounts may require both email verification and administrative review before doctor-specific product access is granted. A license number alone does not automatically activate a doctor account.</p>
      </PolicySection>

      <PolicySection title="Questions and Contact">
        <p>If you have questions about privacy, role visibility, or account access, contact support@healio.local.</p>
      </PolicySection>
    </PublicPageShell>
  );
}
