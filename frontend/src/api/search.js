import { apiUrl, authHeaders } from "./http";

async function request(path) {
  const response = await fetch(`${apiUrl}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(),
    },
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.message || data.error || "Request failed");
  }

  return data;
}

export function getMedicationFilterOptions(patientId) {
  const params = new URLSearchParams();
  if (patientId) params.set("patientId", patientId);
  return request(`/api/search/filter-options?${params.toString()}`);
}

export function searchAndFilterMedications({
  q = "",
  prescribedBy = "",
  frequency = "",
  status = "",
  sortBy = "createdAt",
  sortOrder = "DESC",
  patientId = "",
}) {
  const params = new URLSearchParams({
    sortBy,
    sortOrder,
    limit: "100",
    offset: "0",
  });

  if (q.trim()) params.set("q", q.trim());
  if (prescribedBy) params.set("prescribedBy", prescribedBy);
  if (frequency) params.set("frequency", frequency);
  if (status) params.set("status", status);
  if (patientId) params.set("patientId", patientId);

  return request(`/api/search/medications?${params.toString()}`);
}
