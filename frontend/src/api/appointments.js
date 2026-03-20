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

export function getMyAppointments() {
  return request("/api/appointments/mine");
}

export function getDoctorSchedule({ from, to, includeCancelled = false }) {
  const params = new URLSearchParams({
    from,
    to,
    includeCancelled: String(includeCancelled),
  });

  return request(`/api/appointments/doctor/schedule?${params.toString()}`);
}

export function getDoctorAvailability({
  from,
  to,
  slotMinutes = 30,
  startHour,
  endHour,
}) {
  const params = new URLSearchParams({
    from,
    to,
    slotMinutes: String(slotMinutes),
  });

  if (Number.isInteger(startHour)) params.set("startHour", String(startHour));
  if (Number.isInteger(endHour)) params.set("endHour", String(endHour));

  return request(`/api/appointments/doctor/availability?${params.toString()}`);
}

export function createAppointment(payload) {
  return request("/api/appointments", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function createAppointmentRequest(payload) {
  return request("/api/appointments/requests", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function getRequestableDoctors() {
  return request("/api/appointments/requestable-doctors");
}

export function getPatientDoctorAvailability({
  doctorId,
  from,
  to,
  slotMinutes = 30,
  startHour,
  endHour,
}) {
  const params = new URLSearchParams({
    from,
    to,
    slotMinutes: String(slotMinutes),
  });

  if (Number.isInteger(startHour)) params.set("startHour", String(startHour));
  if (Number.isInteger(endHour)) params.set("endHour", String(endHour));

  return request(`/api/appointments/requestable-doctors/${doctorId}/availability?${params.toString()}`);
}

export function updateAppointmentStatus(id, status) {
  return request(`/api/appointments/${id}/status`, {
    method: "PATCH",
    body: JSON.stringify({ status }),
  });
}

export function reviewAppointmentRequest(id, status, notes) {
  return request(`/api/appointments/${id}/status`, {
    method: "PATCH",
    body: JSON.stringify({ status, notes }),
  });
}
