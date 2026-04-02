
import { apiUrl, authHeaders } from "./http";

async function request(path, options = {}) {
  const response = await fetch(`${apiUrl}${path}`, {
    ...options,
    headers: {
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...authHeaders(),
      ...(options.headers || {}),
    },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || data.error || "Request failed");
  return data;
}


export function getMyPatients() {
  return request("/api/caregivers/patients");
}


export function getCaregiverDashboard(patientId) {
  return request(`/api/caregivers/patients/${patientId}/dashboard`);
}


export function generateInviteLink() {
  return request("/api/caregiver-invites/generate", { method: "POST" });
}
export function getMyInvites() {
  return request("/api/caregiver-invites/mine");
}
export function resolveInviteToken(token) {
  return fetch(`${apiUrl}/api/caregiver-invites/${token}`)
    .then((r) => r.json())
    .then((data) => { if (!data.patient) throw new Error(data.message || "Invalid link"); return data; });
}
export function acceptInviteToken(token) {
  return request(`/api/caregiver-invites/${token}/accept`, { method: "POST" });
}
export function rejectInviteToken(token) {
  return request(`/api/caregiver-invites/${token}/reject`, { method: "POST" });
}


export function createCareNote(patientId, note) {
  return request("/api/caregiver-notes/", {
    method: "POST",
    body: JSON.stringify({ patientId, note }),
  });
}
export function getCareNotes(patientId) {
  return request(`/api/caregiver-notes/patients/${patientId}`);
}
export function updateCareNote(id, note) {
  return request(`/api/caregiver-notes/${id}`, {
    method: "PATCH",
    body: JSON.stringify({ note }),
  });
}

export function logMedicationSupportAction(medicationId, action, note = "") {
  return request(`/api/caregiver-actions/medications/${medicationId}/support-action`, {
    method: "POST",
    body: JSON.stringify({ action, note }),
  });
}
export function getMedicationAdherenceHistory(medicationId) {
  return request(`/api/caregiver-actions/medications/${medicationId}/adherence-history`);
}

export function caregiverLogSymptom(patientId, name, severity, notes = "") {
  return request("/api/caregiver-actions/symptoms", {
    method: "POST",
    body: JSON.stringify({ patientId, name, severity, notes }),
  });
}
export function getCaregiverPatientSymptoms(patientId) {
  return request(`/api/caregiver-actions/symptoms/patients/${patientId}`);
}


export function getCaregiverReminders(patientId) {
  return request(`/api/caregiver-actions/reminders/patients/${patientId}`);
}
export function dismissReminder(reminderId) {
  return request(`/api/caregiver-actions/reminders/${reminderId}/dismiss`, {
    method: "PATCH",
  });
}

export function caregiverRequestAppointment(patientId, payload) {
  return request(`/api/caregiver-actions/appointments/patients/${patientId}/request`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function sendCareConcern(patientId, concern, context = "") {
  return request("/api/caregiver-actions/care-concerns", {
    method: "POST",
    body: JSON.stringify({ patientId, concern, context }),
  });
}

export function getCaregiverPatientMedications(patientId) {
  return request(`/api/caregivers/patients/${patientId}/medications`);
}
export function getCaregiverPatientAppointments(patientId) {
  return request(`/api/caregivers/patients/${patientId}/appointments`);
}