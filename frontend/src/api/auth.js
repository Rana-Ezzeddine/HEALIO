const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:5050";

function makeApiError(data, fallback, status) {
  const err = new Error(data.message || fallback);
  err.code = data.code;
  err.status = status;
  if (data.email) err.email = data.email;
  if (data.user) err.user = data.user;
  return err;
}

export async function register({ firstName, lastName, email, password, role, licenseNb = "" }) {
  const res = await fetch(`${API_BASE}/api/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ firstName, lastName, email, password, role, licenseNb }),
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

export async function verifyTwoFactor(challengeToken, code) {
  const res = await fetch(`${API_BASE}/api/auth/verify-2fa`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ challengeToken, code }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw makeApiError(data, "Two-factor verification failed", res.status);
  return data;
}

export async function getMfaStatus(headers) {
  const res = await fetch(`${API_BASE}/api/auth/mfa/status`, {
    headers: { "Content-Type": "application/json", ...(headers || {}) },
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw makeApiError(data, "Failed to load two-factor status", res.status);
  return data;
}

export async function beginMfaSetup(payload, headers) {
  const res = await fetch(`${API_BASE}/api/auth/mfa/setup`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(headers || {}) },
    body: JSON.stringify(payload || {}),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw makeApiError(data, "Failed to start two-factor setup", res.status);
  return data;
}

export async function enableMfa(payload, headers) {
  const res = await fetch(`${API_BASE}/api/auth/mfa/enable`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(headers || {}) },
    body: JSON.stringify(payload || {}),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw makeApiError(data, "Failed to enable two-factor authentication", res.status);
  return data;
}

export async function disableMfa(payload, headers) {
  const res = await fetch(`${API_BASE}/api/auth/mfa/disable`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(headers || {}) },
    body: JSON.stringify(payload || {}),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw makeApiError(data, "Failed to disable two-factor authentication", res.status);
  return data;
}

export async function regenerateMfaRecoveryCodes(payload, headers) {
  const res = await fetch(`${API_BASE}/api/auth/mfa/recovery-codes`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(headers || {}) },
    body: JSON.stringify(payload || {}),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw makeApiError(data, "Failed to regenerate backup codes", res.status);
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

export async function requestPasswordReset(email) {
  const res = await fetch(`${API_BASE}/api/auth/forgot-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw makeApiError(data, "Failed to request password reset", res.status);
  return data;
}

export async function validatePasswordResetToken(token) {
  const res = await fetch(`${API_BASE}/api/auth/reset-password?token=${encodeURIComponent(token)}`);

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw makeApiError(data, "Password reset link is not valid", res.status);
  return data;
}

export async function resetPassword(token, password) {
  const res = await fetch(`${API_BASE}/api/auth/reset-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token, password }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw makeApiError(data, "Failed to reset password", res.status);
  return data;
}

export function startSocialAuth(provider, options = {}) {
  const search = new URLSearchParams();
  const normalizedProvider = provider === "apple" ? "apple" : "google";

  if (options.intent) search.set("intent", options.intent);
  if (options.role) search.set("role", options.role);

  window.location.assign(`${API_BASE}/api/auth/${normalizedProvider}/start?${search.toString()}`);
}
