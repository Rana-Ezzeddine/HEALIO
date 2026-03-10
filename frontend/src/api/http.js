// TODO(backend): Base URL must point to a running backend API.
export const apiUrl = import.meta.env.VITE_API_URL || "http://localhost:5050";

export function authHeaders() {
  // TODO(backend): Authenticated endpoints require a valid bearer token from backend login.
  const token = localStorage.getItem("accessToken");
  return token ? { Authorization: `Bearer ${token}` } : {};
}
export function setSession({ token, user }) {
  localStorage.setItem("accessToken", token);
  localStorage.setItem("user", JSON.stringify(user));
  localStorage.setItem("userRole", user.role);
}

export function clearSession() {
  localStorage.removeItem("accessToken");
  localStorage.removeItem("user");
  localStorage.removeItem("userRole");
}

export function getToken() {
  return localStorage.getItem("accessToken");
}

export function getUser() {
  const raw = localStorage.getItem("user");
  return raw ? JSON.parse(raw) : null;
}
