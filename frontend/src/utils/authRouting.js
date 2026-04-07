export const DOCTOR_APPROVAL_STATUS = Object.freeze({
  NOT_APPLICABLE: "not_applicable",
  UNVERIFIED: "unverified",
  PENDING: "pending_approval",
  APPROVED: "approved",
  REJECTED: "rejected",
});

const dashboardPathByRole = {
  doctor: "/dashboardDoctor",
  patient: "/dashboardPatient",
  caregiver: "/dashboardCaregiver",
  admin: "/admin-access",
};

const reviewerEmails = new Set(
  ["sleimanmohammad14@gmail.com"].map((email) => email.toLowerCase())
);

export function isReviewerUser(user) {
  const email = String(user?.email || "").toLowerCase().trim();
  return Boolean(email) && reviewerEmails.has(email);
}

export function needsDoctorApprovalHold(user) {
  return (
    Boolean(user) &&
    user.role === "doctor" &&
    user.doctorApprovalStatus !== DOCTOR_APPROVAL_STATUS.APPROVED
  );
}

export function getPostAuthRoute(user) {
  if (isReviewerUser(user)) {
    return "/doctor-review";
  }

  if (needsDoctorApprovalHold(user)) {
    return "/doctor-approval-status";
  }

  return dashboardPathByRole[user?.role] || "/dashboardPatient";
}
