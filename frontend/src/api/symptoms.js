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

export function getSymptoms() {
  return request("/api/symptoms");
}

export function createSymptom(payload) {
  return request("/api/symptoms", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function deleteSymptom(id) {
  return request(`/api/symptoms/${id}`, {
    method: "DELETE",
  });
}

export function filterSymptoms(params) {
  const query = new URLSearchParams();

  Object.entries(params || {}).forEach(([key, value]) => {
    if (value != null && value !== "") {
      query.set(key, String(value));
    }
  });

  return request(`/api/search/symptoms?${query.toString()}`);
}
