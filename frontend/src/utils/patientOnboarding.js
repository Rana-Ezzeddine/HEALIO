const ONBOARDING_PENDING_KEY = "healio:patient-onboarding-pending";
const ONBOARDING_DISMISSED_PREFIX = "healio:patient-onboarding-dismissed:";

function getPatientIdentityKey(user) {
  return user?.id || user?.email || "";
}

function getDismissedKey(user) {
  return `${ONBOARDING_DISMISSED_PREFIX}${getPatientIdentityKey(user)}`;
}

export function queuePatientOnboarding(user) {
  if (user?.role !== "patient") return;

  const identityKey = getPatientIdentityKey(user);
  if (!identityKey) return;

  window.sessionStorage.setItem(ONBOARDING_PENDING_KEY, identityKey);
}

export function isPatientOnboardingQueued(user) {
  if (user?.role !== "patient") return false;

  const identityKey = getPatientIdentityKey(user);
  if (!identityKey) return false;

  const queuedIdentity = window.sessionStorage.getItem(ONBOARDING_PENDING_KEY);
  return queuedIdentity === identityKey;
}

export function clearQueuedPatientOnboarding(user) {
  if (user?.role !== "patient") return;

  const identityKey = getPatientIdentityKey(user);
  if (!identityKey) return;

  const queuedIdentity = window.sessionStorage.getItem(ONBOARDING_PENDING_KEY);
  if (queuedIdentity !== identityKey) return;

  window.sessionStorage.removeItem(ONBOARDING_PENDING_KEY);
}

export function dismissPatientOnboarding(user) {
  if (user?.role !== "patient") return;

  const identityKey = getPatientIdentityKey(user);
  if (!identityKey) return;

  window.localStorage.setItem(getDismissedKey(user), "true");
}

export function clearDismissedPatientOnboarding(user) {
  if (user?.role !== "patient") return;

  const identityKey = getPatientIdentityKey(user);
  if (!identityKey) return;

  window.localStorage.removeItem(getDismissedKey(user));
}

export function isPatientOnboardingDismissed(user) {
  if (user?.role !== "patient") return false;

  const identityKey = getPatientIdentityKey(user);
  if (!identityKey) return false;

  return window.localStorage.getItem(getDismissedKey(user)) === "true";
}
