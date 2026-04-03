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
  if (!response.ok) {
    throw new Error(data.message || "Request failed");
  }

  return data;
}

export function getCaregiverNotesForPatient(patientId) {
  return request(`/api/caregiver-notes/patients/${patientId}`);
}

export function createCaregiverNote(payload) {
  return request("/api/caregiver-notes", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function updateCaregiverNote(id, note) {
  return request(`/api/caregiver-notes/${id}`, {
    method: "PATCH",
    body: JSON.stringify({ note }),
  });
}
