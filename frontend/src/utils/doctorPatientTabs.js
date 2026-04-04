const STORAGE_KEY = "healio:doctor-open-patient-tabs";
const EVENT_NAME = "healio:doctor-patient-tabs-updated";

function emitTabsUpdated() {
  window.dispatchEvent(new CustomEvent(EVENT_NAME));
}

export function readDoctorPatientTabs() {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function rememberDoctorPatientTab(tab) {
  if (!tab?.id) return readDoctorPatientTabs();
  const current = readDoctorPatientTabs().filter((item) => item.id !== tab.id);
  const next = [{ id: tab.id, name: tab.name || "Patient" }, ...current].slice(0, 8);
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  emitTabsUpdated();
  return next;
}

export function removeDoctorPatientTab(tabId) {
  if (!tabId) return readDoctorPatientTabs();
  const next = readDoctorPatientTabs().filter((item) => item.id !== tabId);
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  emitTabsUpdated();
  return next;
}

export function onDoctorPatientTabsUpdated(handler) {
  window.addEventListener(EVENT_NAME, handler);
  return () => window.removeEventListener(EVENT_NAME, handler);
}
