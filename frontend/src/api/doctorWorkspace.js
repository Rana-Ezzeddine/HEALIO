import { apiUrl, authHeaders } from "./http";

export async function getDoctorPatientWorkspace(patientId) {
  const response = await fetch(`${apiUrl}/api/doctors/patients/${patientId}/workspace`, {
    headers: { ...authHeaders() },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.message || "Failed to load patient workspace.");
  }
  return data;
}
