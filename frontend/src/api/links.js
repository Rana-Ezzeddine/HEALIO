import { apiUrl, authHeaders } from "./http";

function makeApiError(data, fallback, status) {
  const err = new Error(data.message || data.error || fallback);
  err.code = data.code;
  err.status = status;
  return err;
}

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
    throw makeApiError(data, "Request failed", response.status);
  }

  return data;
}

export function getMyDoctors() {
  return request("/api/doctors/assignments/mine");
}

export function linkDoctorByEmail(doctorEmail) {
  return request("/api/doctors/assignments", {
    method: "POST",
    body: JSON.stringify({ doctorEmail }),
  });
}

export function getDoctorLinkRequests() {
  return request("/api/doctors/assignments/requests");
}

export function reviewDoctorLinkRequest(patientId, status) {
  return request(`/api/doctors/assignments/requests/${patientId}`, {
    method: "PATCH",
    body: JSON.stringify({ status }),
  });
}

export function getMyCaregivers() {
  return request("/api/caregivers/assignments/mine");
}

export function linkCaregiverByEmail(caregiverEmail, permissions) {
  return request("/api/caregivers/assignments", {
    method: "POST",
    body: JSON.stringify({ caregiverEmail, permissions }),
  });
}

export function getCaregiverLinkRequests() {
  return request("/api/caregivers/assignments/requests");
}

export function reviewCaregiverLinkRequest(patientId, status) {
  return request(`/api/caregivers/assignments/requests/${patientId}`, {
    method: "PATCH",
    body: JSON.stringify({ status }),
  });
}

export function updateCaregiverPermissions(caregiverId, permissions) {
  return request(`/api/caregivers/assignments/${caregiverId}`, {
    method: "PATCH",
    body: JSON.stringify(permissions),
  });
}

export function removeCaregiverAssignment(caregiverId) {
  return request(`/api/caregivers/assignments/${caregiverId}`, {
    method: "DELETE",
  });
}
