import { useEffect, useMemo, useState } from "react";
import Navbar from "../components/Navbar";
import {
  createAdminAccount,
  listAdminAccounts,
  updateManagedUserRole,
} from "../api/admin";

const ROLE_OPTIONS = [
  { value: "admin", label: "Admin" },
  { value: "patient", label: "Patient" },
  { value: "caregiver", label: "Caregiver" },
];

function formatDate(value) {
  if (!value) return "Not available";
  try {
    return new Date(value).toLocaleString();
  } catch {
    return value;
  }
}

function UserStatCard({ label, value, hint, tone = "sky" }) {
  const toneClass = {
    sky: "from-sky-100 to-white text-sky-900 border-sky-200",
    emerald: "from-emerald-100 to-white text-emerald-900 border-emerald-200",
    amber: "from-amber-100 to-white text-amber-900 border-amber-200",
  }[tone];

  return (
    <div className={`rounded-[1.5rem] border bg-gradient-to-br px-5 py-4 ${toneClass}`}>
      <p className="text-[11px] font-semibold uppercase tracking-[0.24em] opacity-70">{label}</p>
      <p className="mt-3 text-3xl font-black tracking-tight">{value}</p>
      <p className="mt-2 text-sm opacity-80">{hint}</p>
    </div>
  );
}

export default function AdminReviewerManagementPage() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [creating, setCreating] = useState(false);
  const [search, setSearch] = useState("");
  const [roleUpdatingId, setRoleUpdatingId] = useState("");
  const [form, setForm] = useState({
    email: "",
    password: "",
    firstName: "",
    lastName: "",
  });

  async function loadUsers() {
    setLoading(true);
    setError("");
    try {
      const data = await listAdminAccounts();
      setUsers(data.users || []);
    } catch (err) {
      setError(err?.message || "Failed to load admin access data.");
      setUsers([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadUsers();
  }, []);

  const filteredUsers = useMemo(() => {
    const query = search.trim().toLowerCase();
    const source = users.filter((user) => user.role !== "admin");
    if (!query) return source;
    return source.filter((user) =>
      [user.displayName, user.email, user.role]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query))
    );
  }, [search, users]);

  const adminCount = users.filter((user) => user.role === "admin").length;
  const verifiedCount = users.filter((user) => user.isVerified).length;

  async function handleCreateAdmin(event) {
    event.preventDefault();
    setCreating(true);
    setError("");
    setSuccess("");

    try {
      const data = await createAdminAccount(form);
      setSuccess(data?.message || "Admin account created.");
      setForm({ email: "", password: "", firstName: "", lastName: "" });
      await loadUsers();
    } catch (err) {
      setError(err?.message || "Failed to create admin account.");
    } finally {
      setCreating(false);
    }
  }

  async function handleRoleChange(userId, role) {
    setRoleUpdatingId(userId);
    setError("");
    setSuccess("");
    try {
      const data = await updateManagedUserRole(userId, role);
      setSuccess(data?.message || "User role updated.");
      await loadUsers();
    } catch (err) {
      setError(err?.message || "Failed to update user role.");
    } finally {
      setRoleUpdatingId("");
    }
  }

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#f8fbfd_0%,#eef7fb_100%)]">
      <Navbar />
      <main className="mx-auto max-w-7xl px-6 pb-20 pt-32">
        <section className="rounded-[2rem] bg-[linear-gradient(120deg,#0f172a_0%,#0369a1_58%,#22d3ee_100%)] px-10 py-8 text-white shadow-[0_35px_90px_-48px_rgba(2,132,199,0.8)]">
          <div className="grid gap-6 lg:grid-cols-[1.4fr_0.9fr]">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.28em] text-sky-100">Admin workspace</p>
              <h1 className="mt-4 text-4xl font-black tracking-tight">Admin Access Management</h1>
              <p className="mt-4 max-w-3xl text-sm leading-7 text-sky-50/90">
                Provision internal admin accounts, promote trusted internal users into admin access, and keep doctor approval ownership inside the product instead of relying on environment allowlists.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <UserStatCard label="Admins" value={adminCount} hint="Active internal admin accounts" tone="sky" />
              <UserStatCard label="Verified users" value={verifiedCount} hint="Eligible internal accounts" tone="emerald" />
            </div>
          </div>
        </section>

        {error ? (
          <div className="mt-6 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {error}
          </div>
        ) : null}
        {success ? (
          <div className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            {success}
          </div>
        ) : null}

        <div className="mt-8 grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
          <section className="rounded-[1.75rem] border border-slate-200 bg-white/90 p-6 shadow-[0_25px_70px_-55px_rgba(15,23,42,0.45)]">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-sky-500">Create admin</p>
              <h2 className="mt-3 text-2xl font-black tracking-tight text-slate-900">Provision internal admin access</h2>
              <p className="mt-3 text-sm leading-7 text-slate-600">
                Create admin accounts directly for hospital management, ministry staff, or credentialing operations. The account is created verified and can log in immediately through the normal sign-in flow.
              </p>
            </div>

            <form className="mt-6 space-y-4" onSubmit={handleCreateAdmin}>
              <div className="grid gap-4 md:grid-cols-2">
                <input
                  value={form.firstName}
                  onChange={(event) => setForm((current) => ({ ...current, firstName: event.target.value }))}
                  placeholder="First name"
                  className="rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-700 shadow-sm outline-none transition focus:border-sky-300 focus:ring-2 focus:ring-sky-100"
                />
                <input
                  value={form.lastName}
                  onChange={(event) => setForm((current) => ({ ...current, lastName: event.target.value }))}
                  placeholder="Last name"
                  className="rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-700 shadow-sm outline-none transition focus:border-sky-300 focus:ring-2 focus:ring-sky-100"
                />
              </div>
              <input
                value={form.email}
                onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
                placeholder="Admin email"
                type="email"
                required
                className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-700 shadow-sm outline-none transition focus:border-sky-300 focus:ring-2 focus:ring-sky-100"
              />
              <input
                value={form.password}
                onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))}
                placeholder="Temporary password"
                type="password"
                required
                minLength={10}
                className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-700 shadow-sm outline-none transition focus:border-sky-300 focus:ring-2 focus:ring-sky-100"
              />
              <button
                type="submit"
                disabled={creating}
                className="rounded-full bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {creating ? "Creating admin..." : "Create admin account"}
              </button>
            </form>
          </section>

          <section className="rounded-[1.75rem] border border-slate-200 bg-white/90 p-6 shadow-[0_25px_70px_-55px_rgba(15,23,42,0.45)]">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-sky-500">Manage roles</p>
                <h2 className="mt-3 text-2xl font-black tracking-tight text-slate-900">Promote or demote admin access</h2>
              </div>
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search name, email, or role"
                className="w-full max-w-xs rounded-full border border-slate-200 px-4 py-2.5 text-sm text-slate-700 shadow-sm outline-none transition focus:border-sky-300 focus:ring-2 focus:ring-sky-100"
              />
            </div>

            <div className="mt-6 space-y-3">
              {loading ? (
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-6 text-sm text-slate-500">
                  Loading user accounts...
                </div>
              ) : filteredUsers.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
                  No matching accounts found.
                </div>
              ) : (
                filteredUsers.map((user) => (
                  <div
                    key={user.id}
                    className="rounded-[1.5rem] border border-slate-200 bg-slate-50/80 px-4 py-4"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-base font-semibold text-slate-900">{user.displayName}</p>
                        <p className="mt-1 text-sm text-slate-500">{user.email}</p>
                        <div className="mt-3 flex flex-wrap gap-2">
                          <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                            {user.role}
                          </span>
                          <span
                            className={`rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] ${
                              user.isVerified
                                ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                                : "border-amber-200 bg-amber-50 text-amber-700"
                            }`}
                          >
                            {user.isVerified ? "Verified" : "Unverified"}
                          </span>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        {user.role === "doctor" ? (
                          <span className="rounded-full border border-amber-200 bg-amber-50 px-4 py-2 text-sm font-semibold text-amber-800">
                            Managed in doctor approval
                          </span>
                        ) : (
                          <select
                            value={user.role}
                            onChange={(event) => handleRoleChange(user.id, event.target.value)}
                            disabled={roleUpdatingId === user.id}
                            className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm outline-none transition focus:border-sky-300 focus:ring-2 focus:ring-sky-100 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {ROLE_OPTIONS.map((option) => (
                              <option key={option.value} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                        )}
                      </div>
                    </div>
                    <div className="mt-4 grid gap-3 text-sm text-slate-500 md:grid-cols-2">
                      <p>Created: {formatDate(user.createdAt)}</p>
                      <p>Updated: {formatDate(user.updatedAt)}</p>
                    </div>
                    {user.role === "doctor" ? (
                      <p className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800">
                        Doctor roles remain managed through the doctor application workflow.
                      </p>
                    ) : null}
                  </div>
                ))
              )}
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
