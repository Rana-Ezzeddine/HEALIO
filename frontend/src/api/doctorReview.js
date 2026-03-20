import { apiUrl, authHeaders } from "./http";

function makeApiError(data, fallback, status) {
  const err = new Error(data.message || fallback);
  err.code = data.code;
  err.status = status;
  if (data.application) err.application = data.application;
  if (data.applications) err.applications = data.applications;
  return err;
}

export async function getDoctorApplicationStatus() {
  const res = await fetch(`${apiUrl}/api/doctors/application-status`, {
    headers: {
      ...authHeaders(),
    },
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw makeApiError(data, "Failed to fetch doctor application status", res.status);
  return data;
}

export async function listDoctorApplications(status = "pending_approval") {
  const search = new URLSearchParams();
  if (status) search.set("status", status);

  const res = await fetch(`${apiUrl}/api/doctors/review/applications?${search.toString()}`, {
    headers: {
      ...authHeaders(),
    },
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw makeApiError(data, "Failed to fetch doctor applications", res.status);
  return data;
}

export async function reviewDoctorApplication(doctorId, decision, notes = "") {
  const res = await fetch(`${apiUrl}/api/doctors/review/applications/${doctorId}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(),
    },
    body: JSON.stringify({ decision, notes }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw makeApiError(data, "Failed to review doctor application", res.status);
  return data;
}
