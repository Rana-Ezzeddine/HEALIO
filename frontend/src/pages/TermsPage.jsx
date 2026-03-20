import PublicPageShell from "../components/PublicPageShell";

function TermsSection({ title, children }) {
  return (
    <section>
      <h2 className="text-2xl font-bold text-slate-900">{title}</h2>
      <div className="mt-3 space-y-3 text-sm leading-7 text-slate-600">{children}</div>
    </section>
  );
}

export default function TermsPage() {
  return (
    <PublicPageShell
      title="Terms of Service"
      intro="These terms describe the basic expectations for using HEALIO, including account responsibilities, role-based access, and important limits of the platform."
    >
      <TermsSection title="Use of the Platform">
        <p>HEALIO is intended for care coordination, communication, appointments, and health-management support across patient, caregiver, and doctor roles.</p>
      </TermsSection>

      <TermsSection title="Account Responsibilities">
        <p>Users are responsible for maintaining the security of their credentials and for providing accurate account and profile information.</p>
      </TermsSection>

      <TermsSection title="Role-Based Access and Approval">
        <p>Platform access differs by role. Some accounts, especially doctor accounts, may require additional review and approval before access to role-specific features is granted.</p>
      </TermsSection>

      <TermsSection title="Acceptable Use">
        <p>Users must not attempt to access information outside their approved role or relationship, interfere with platform availability, or misuse communication and health-tracking features.</p>
      </TermsSection>

      <TermsSection title="Emergency Use Limitation">
        <p>HEALIO does not replace emergency medical services. In urgent or emergency situations, contact local emergency services immediately.</p>
      </TermsSection>

      <TermsSection title="Service Changes and Contact">
        <p>HEALIO may update platform behavior, access rules, or policy text over time. For questions, contact support@healio.local.</p>
      </TermsSection>
    </PublicPageShell>
  );
}
