const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:5050";

function makeApiError(data, fallback, status) {
  const err = new Error(data.message || fallback);
  err.code = data.code;
  err.status = status;
  if (data.email) err.email = data.email;
  if (data.user) err.user = data.user;
  return err;
}

export async function register({ firstName, lastName, email, password, role }) {
  const res = await fetch(`${API_BASE}/api/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ firstName, lastName, email, password, role }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw makeApiError(data, "Register failed", res.status);
  return data;
}

export async function login(email, password) {
  const res = await fetch(`${API_BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw makeApiError(data, "Login failed", res.status);
  return data;
}

export async function verifyEmail(token) {
  const res = await fetch(`${API_BASE}/api/auth/verify-email`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw makeApiError(data, "Email verification failed", res.status);
  return data;
}

export async function resendVerification(email) {
  const res = await fetch(`${API_BASE}/api/auth/resend-verification`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw makeApiError(data, "Failed to resend verification email", res.status);
  return data;
}
