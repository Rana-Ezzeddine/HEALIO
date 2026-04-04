const NOTES_KEY = "healio:doctor-structured-notes";
const PLANS_KEY = "healio:doctor-structured-plans";
const DOCTOR_TO_CAREGIVER_NOTES_KEY = "healio:doctor-caregiver-notes";

function readMap(storageKey) {
  try {
    const raw = localStorage.getItem(storageKey);
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function writeMap(storageKey, value) {
  localStorage.setItem(storageKey, JSON.stringify(value));
}

export function getPatientClinicalNotes(patientId) {
  if (!patientId) return [];
  const map = readMap(NOTES_KEY);
  return Array.isArray(map[patientId]) ? map[patientId] : [];
}

export function savePatientClinicalNote(patientId, note) {
  if (!patientId || !note) return [];
  const map = readMap(NOTES_KEY);
  const current = Array.isArray(map[patientId]) ? map[patientId] : [];
  const next = [{ ...note }, ...current];
  map[patientId] = next;
  writeMap(NOTES_KEY, map);
  return next;
}

export function getPatientTreatmentPlans(patientId) {
  if (!patientId) return [];
  const map = readMap(PLANS_KEY);
  return Array.isArray(map[patientId]) ? map[patientId] : [];
}

export function savePatientTreatmentPlan(patientId, plan) {
  if (!patientId || !plan) return [];
  const map = readMap(PLANS_KEY);
  const current = Array.isArray(map[patientId]) ? map[patientId] : [];
  const existingIndex = current.findIndex((item) => item.id === plan.id);

  let next;
  if (existingIndex >= 0) {
    next = [...current];
    next[existingIndex] = { ...next[existingIndex], ...plan };
  } else {
    next = [{ ...plan }, ...current];
  }

  map[patientId] = next;
  writeMap(PLANS_KEY, map);
  return next;
}

export function getDoctorCaregiverNotes(patientId) {
  if (!patientId) return [];
  const map = readMap(DOCTOR_TO_CAREGIVER_NOTES_KEY);
  return Array.isArray(map[patientId]) ? map[patientId] : [];
}

export function saveDoctorCaregiverNote(patientId, note) {
  if (!patientId || !note) return [];
  const map = readMap(DOCTOR_TO_CAREGIVER_NOTES_KEY);
  const current = Array.isArray(map[patientId]) ? map[patientId] : [];
  const next = [{ ...note }, ...current];
  map[patientId] = next;
  writeMap(DOCTOR_TO_CAREGIVER_NOTES_KEY, map);
  return next;
}

export function formatListInput(value) {
  return String(value || "")
    .split("\n")
    .map((item) => item.trim())
    .filter(Boolean);
}

export function formatListOutput(items) {
  return Array.isArray(items) ? items.filter(Boolean).join(", ") : "";
}
