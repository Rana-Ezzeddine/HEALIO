const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:5050";

export async function register({ firstName, lastName, email, password, role }) {
  // TODO(backend): Requires POST /api/auth/register endpoint.
  const res = await fetch(`${API_BASE}/api/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ firstName, lastName, email, password, role }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || "Register failed");
  return data;
}

export async function login(email, password) {
  // TODO(backend): Requires POST /api/auth/login endpoint returning token and user role.
  const res = await fetch(`${API_BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || "Login failed");
  return data;
}

export async function verifyEmail(token) {
  const res = await fetch(`${API_BASE}/api/auth/verify-email`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || "Email verification failed");
  return data;
}
