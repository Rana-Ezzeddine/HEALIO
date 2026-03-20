// TODO(backend): Base URL must point to a running backend API.
export const apiUrl = import.meta.env.VITE_API_URL || "http://localhost:5050";

const authStorage = window.sessionStorage;
const cachedIdentityKeys = [
  "accessToken",
  "user",
  "userRole",
  "firstName",
  "lastName",
  "email",
  "requestedRole",
  "licenseNb",
  "pendingPatientLinkCode",
  "healio:auth-sync",
  "phone",
  "gender",
  "dateOfBirth",
  "allergies",
  "conditions",
  "bloodType",
  "emName",
  "relationship",
  "emPhone",
  "relationshipToPatient",
  "supportNotes",
  "specialization",
  "yearsOfExperience",
  "clinicName",
  "clinicAddress",
];

function clearCachedIdentityState() {
  for (const key of cachedIdentityKeys) {
    localStorage.removeItem(key);
  }
}

export function authHeaders() {
  // TODO(backend): Authenticated endpoints require a valid bearer token from backend login.
  const token = authStorage.getItem("accessToken");
  return token ? { Authorization: `Bearer ${token}` } : {};
}
export function setSession({ token, user }) {
  authStorage.clear();
  clearCachedIdentityState();
  authStorage.setItem("accessToken", token);
  authStorage.setItem("user", JSON.stringify(user));
  authStorage.setItem("userRole", user.role);
  if (user?.firstName) localStorage.setItem("firstName", user.firstName);
  if (user?.lastName) localStorage.setItem("lastName", user.lastName);
  if (user?.email) localStorage.setItem("email", user.email);
}

export function updateSessionUser(user) {
  if (!user) return;
  clearCachedIdentityState();
  authStorage.setItem("user", JSON.stringify(user));
  authStorage.setItem("userRole", user.role);
  if (user?.firstName) localStorage.setItem("firstName", user.firstName);
  if (user?.lastName) localStorage.setItem("lastName", user.lastName);
  if (user?.email) localStorage.setItem("email", user.email);
}

export function clearSession() {
  authStorage.clear();
  clearCachedIdentityState();
}

export function getToken() {
  return authStorage.getItem("accessToken");
}

export function getUser() {
  const raw = authStorage.getItem("user");
  return raw ? JSON.parse(raw) : null;
}
