export const apiUrl = import.meta.env.VITE_API_URL || "http://localhost:5050";

export function authHeaders() {
  const token = localStorage.getItem("accessToken");
  return token ? { Authorization: `Bearer ${token}` } : {};
}
export function setSession({ token, user }) {
  localStorage.setItem("accessToken", token);
  localStorage.setItem("user", JSON.stringify(user));
}

export function clearSession() {
  localStorage.removeItem("accessToken");
  localStorage.removeItem("user");
}

export function getToken() {
  return localStorage.getItem("accessToken");
}

export function getUser() {
  const raw = localStorage.getItem("user");
  return raw ? JSON.parse(raw) : null;
}
