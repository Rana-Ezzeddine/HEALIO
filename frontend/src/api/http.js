// TODO(backend): Base URL must point to a running backend API.
export const apiUrl = import.meta.env.VITE_API_URL || "http://localhost:5050";

const authStorage = window.sessionStorage;

export function authHeaders() {
  // TODO(backend): Authenticated endpoints require a valid bearer token from backend login.
  const token = authStorage.getItem("accessToken");
  return token ? { Authorization: `Bearer ${token}` } : {};
}
export function setSession({ token, user }) {
  authStorage.setItem("accessToken", token);
  authStorage.setItem("user", JSON.stringify(user));
  authStorage.setItem("userRole", user.role);
  localStorage.removeItem("firstName");
  localStorage.removeItem("lastName");
  if (user?.firstName) localStorage.setItem("firstName", user.firstName);
  if (user?.lastName) localStorage.setItem("lastName", user.lastName);
  if (user?.email) localStorage.setItem("email", user.email);
}

export function updateSessionUser(user) {
  if (!user) return;
  authStorage.setItem("user", JSON.stringify(user));
  authStorage.setItem("userRole", user.role);
  localStorage.removeItem("firstName");
  localStorage.removeItem("lastName");
  if (user?.firstName) localStorage.setItem("firstName", user.firstName);
  if (user?.lastName) localStorage.setItem("lastName", user.lastName);
  if (user?.email) localStorage.setItem("email", user.email);
}

export function clearSession() {
  authStorage.removeItem("accessToken");
  authStorage.removeItem("user");
  authStorage.removeItem("userRole");
  localStorage.removeItem("accessToken");
  localStorage.removeItem("user");
  localStorage.removeItem("userRole");
  localStorage.removeItem("firstName");
  localStorage.removeItem("lastName");
  localStorage.removeItem("email");
  localStorage.removeItem("requestedRole");
  localStorage.removeItem("licenseNb");
  localStorage.removeItem("pendingPatientLinkCode");
  localStorage.removeItem("healio:auth-sync");
}

export function getToken() {
  return authStorage.getItem("accessToken");
}

export function getUser() {
  const raw = authStorage.getItem("user");
  return raw ? JSON.parse(raw) : null;
}
