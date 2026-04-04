export const DOCTOR_APPROVAL_STATUS = Object.freeze({
  NOT_APPLICABLE: 'not_applicable',
  UNVERIFIED: 'unverified',
  PENDING: 'pending_approval',
  APPROVED: 'approved',
  REJECTED: 'rejected',
});

export const DOCTOR_REVIEW_DECISION = Object.freeze({
  APPROVE: 'approve',
  REJECT: 'reject',
  REQUEST_MORE_INFO: 'request_more_info',
});

export const DOCTOR_APPROVAL_STATUS_VALUES = Object.freeze(Object.values(DOCTOR_APPROVAL_STATUS));
export const DOCTOR_REVIEW_DECISION_VALUES = Object.freeze(Object.values(DOCTOR_REVIEW_DECISION));

export const isDoctorRole = (role) => role === 'doctor';

export const getDoctorApprovalStatusForNewUser = ({ role, isVerified = false }) => {
  if (!isDoctorRole(role)) return DOCTOR_APPROVAL_STATUS.NOT_APPLICABLE;
  if (/^true$/i.test(process.env.DEMO_AUTO_APPROVE_DOCTORS || '')) {
    return DOCTOR_APPROVAL_STATUS.APPROVED;
  }
  return isVerified ? DOCTOR_APPROVAL_STATUS.PENDING : DOCTOR_APPROVAL_STATUS.UNVERIFIED;
};

export const isApprovedDoctorUser = (user) => (
  Boolean(user) &&
  user.role === 'doctor' &&
  user.doctorApprovalStatus === DOCTOR_APPROVAL_STATUS.APPROVED
);

export const buildDoctorApprovalBlockedPayload = (user) => {
  const requestedMoreInfo = Boolean(user?.doctorApprovalRequestedInfoAt);
  const base = {
    doctorApprovalStatus: user?.doctorApprovalStatus || DOCTOR_APPROVAL_STATUS.PENDING,
    doctorApprovalNotes: user?.doctorApprovalNotes || null,
    requestedMoreInfo,
  };

  if (user?.doctorApprovalStatus === DOCTOR_APPROVAL_STATUS.REJECTED) {
    return {
      status: 403,
      body: {
        code: 'DOCTOR_APPROVAL_REJECTED',
        message: 'Your doctor account has not been approved. Review the feedback and contact support if needed.',
        ...base,
      },
    };
  }

  return {
    status: 403,
    body: {
      code: 'DOCTOR_APPROVAL_PENDING',
      message: requestedMoreInfo
        ? 'More information is required before your doctor account can be approved.'
        : 'Your doctor account is pending approval. You cannot access doctor features yet.',
      ...base,
    },
  };
};
