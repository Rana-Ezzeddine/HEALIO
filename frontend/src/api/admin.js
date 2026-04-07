import { apiUrl, authHeaders } from "./http";

function makeApiError(data, fallback, status) {
  const err = new Error(data.message || fallback);
  err.code = data.code;
  err.status = status;
  if (data.users) err.users = data.users;
  if (data.user) err.user = data.user;
  return err;
}

export async function listAdminAccounts() {
  const res = await fetch(`${apiUrl}/api/admin/admins`, {
    headers: {
      ...authHeaders(),
    },
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw makeApiError(data, "Failed to fetch admin accounts.", res.status);
  return data;
}

export async function createAdminAccount(payload) {
  const res = await fetch(`${apiUrl}/api/admin/admins`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(),
    },
    body: JSON.stringify(payload),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw makeApiError(data, "Failed to create admin account.", res.status);
  return data;
}

export async function updateManagedUserRole(userId, role) {
  const res = await fetch(`${apiUrl}/api/admin/users/${userId}/role`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(),
    },
    body: JSON.stringify({ role }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw makeApiError(data, "Failed to update user role.", res.status);
  return data;
}
