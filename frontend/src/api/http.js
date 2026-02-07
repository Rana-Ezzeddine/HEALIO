export const apiUrl = import.meta.env.VITE_API_URL || "http://localhost:5050";

export function authHeaders() {
  const token = localStorage.getItem("accessToken");
  return token ? { Authorization: `Bearer ${token}` } : {};
}
