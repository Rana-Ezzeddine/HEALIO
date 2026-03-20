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
};

export function needsDoctorApprovalHold(user) {
  return (
    Boolean(user) &&
    user.role === "doctor" &&
    user.doctorApprovalStatus !== DOCTOR_APPROVAL_STATUS.APPROVED
  );
}

export function getPostAuthRoute(user) {
  if (needsDoctorApprovalHold(user)) {
    return "/doctor-approval-status";
  }

  return dashboardPathByRole[user?.role] || "/dashboardPatient";
}
