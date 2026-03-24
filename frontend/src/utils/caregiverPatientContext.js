const ACTIVE_PATIENT_KEY = "caregiver:activePatientId";

export function getActiveCaregiverPatientId() {
  return window.localStorage.getItem(ACTIVE_PATIENT_KEY) || "";
}

export function setActiveCaregiverPatientId(patientId) {
  if (!patientId) {
    window.localStorage.removeItem(ACTIVE_PATIENT_KEY);
    return;
  }
  window.localStorage.setItem(ACTIVE_PATIENT_KEY, patientId);
}

export function resolveActiveCaregiverPatientId(patients = []) {
  const saved = getActiveCaregiverPatientId();
  if (saved && patients.some((record) => record?.patient?.id === saved)) {
    return saved;
  }

  const fallback = patients[0]?.patient?.id || "";
  setActiveCaregiverPatientId(fallback);
  return fallback;
}
