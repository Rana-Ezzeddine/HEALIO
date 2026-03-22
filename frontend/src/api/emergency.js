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
    throw new Error(data.message || data.error || "Request failed");
  }

  return data;
}

export function updateEmergencyStatus(isEmergency) {
  return request("/api/emergency/status", {
    method: "PATCH",
    body: JSON.stringify({ isEmergency }),
  });
}

export function triggerEmergencyAlert(reason) {
  return request("/api/emergency/trigger-alert", {
    method: "POST",
    body: JSON.stringify({ reason }),
  });
}

export function getEmergencyCard() {
  return request("/api/profile/emergency-card");
}
