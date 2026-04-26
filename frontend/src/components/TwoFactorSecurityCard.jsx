import { useCallback, useEffect, useMemo, useState } from "react";
import {
  beginMfaSetup,
  disableMfa,
  enableMfa,
  getMfaStatus,
  regenerateMfaRecoveryCodes,
} from "../api/auth";
import { authHeaders, getUser, updateSessionUser } from "../api/http";

function formatSecret(secret) {
  return String(secret || "").replace(/(.{4})/g, "$1 ").trim();
}

export default function TwoFactorSecurityCard() {
  const sessionUser = getUser();
  const [status, setStatus] = useState({
    enabled: Boolean(sessionUser?.mfaEnabled),
    authProvider: sessionUser?.authProvider || "local",
    backupCodesRemaining: 0,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [password, setPassword] = useState("");
  const [setup, setSetup] = useState(null);
  const [verificationCode, setVerificationCode] = useState("");
  const [recoveryCodes, setRecoveryCodes] = useState([]);
  const [disableCode, setDisableCode] = useState("");
  const [regenCode, setRegenCode] = useState("");

  const requiresPassword = status.authProvider === "local";

  const refreshStatus = useCallback(async () => {
    try {
      const nextStatus = await getMfaStatus(authHeaders());
      setStatus(nextStatus);
      const currentUser = getUser();
      if (currentUser) {
        updateSessionUser({ ...currentUser, mfaEnabled: nextStatus.enabled, authProvider: nextStatus.authProvider });
      }
    } catch (err) {
      setError(err?.message || "Failed to load security settings.");
    }
  }, []);

  useEffect(() => {
    refreshStatus();
  }, [refreshStatus]);

  const setupSecret = useMemo(() => formatSecret(setup?.secret), [setup]);

  async function handleStartSetup() {
    setError("");
    setSuccess("");
    setRecoveryCodes([]);
    setLoading(true);
    try {
      const response = await beginMfaSetup(
        requiresPassword ? { password } : {},
        authHeaders()
      );
      setSetup(response);
      setSuccess("Authenticator secret created. Add it to your app, then verify the code below.");
    } catch (err) {
      setError(err?.message || "Failed to start two-factor setup.");
    } finally {
      setLoading(false);
    }
  }

  async function handleEnable() {
    if (!setup?.setupToken) return;
    setError("");
    setSuccess("");
    setLoading(true);
    try {
      const response = await enableMfa(
        { setupToken: setup.setupToken, code: verificationCode },
        authHeaders()
      );
      setRecoveryCodes(response.backupCodes || []);
      setSetup(null);
      setVerificationCode("");
      setPassword("");
      setSuccess("Two-factor authentication is enabled. Save your backup codes somewhere safe.");
      await refreshStatus();
    } catch (err) {
      setError(err?.message || "Failed to enable two-factor authentication.");
    } finally {
      setLoading(false);
    }
  }

  async function handleDisable() {
    setError("");
    setSuccess("");
    setLoading(true);
    try {
      await disableMfa(
        {
          password: requiresPassword ? password : undefined,
          code: disableCode,
        },
        authHeaders()
      );
      setDisableCode("");
      setPassword("");
      setRecoveryCodes([]);
      setSuccess("Two-factor authentication disabled.");
      await refreshStatus();
    } catch (err) {
      setError(err?.message || "Failed to disable two-factor authentication.");
    } finally {
      setLoading(false);
    }
  }

  async function handleRegenerateCodes() {
    setError("");
    setSuccess("");
    setLoading(true);
    try {
      const response = await regenerateMfaRecoveryCodes(
        {
          password: requiresPassword ? password : undefined,
          code: regenCode,
        },
        authHeaders()
      );
      setRecoveryCodes(response.backupCodes || []);
      setRegenCode("");
      setPassword("");
      setSuccess("New backup codes generated. Store them somewhere safe.");
      await refreshStatus();
    } catch (err) {
      setError(err?.message || "Failed to regenerate backup codes.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="rounded-[2rem] bg-white p-8 shadow-sm">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.25em] text-sky-700">
            Account Security
          </p>
          <h2 className="mt-3 text-2xl font-black text-slate-900">
            Two-Factor Authentication
          </h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
            Protect this account with an authenticator app and one-time backup codes. This is stronger than email-only verification and is better suited for sensitive healthcare access.
          </p>
        </div>
        <div className="rounded-2xl bg-slate-100 px-4 py-3 text-sm font-semibold text-slate-700">
          {status.enabled ? "Enabled" : "Not enabled"}
        </div>
      </div>

      {error ? (
        <div className="mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}
      {success ? (
        <div className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {success}
        </div>
      ) : null}

      <div className="mt-6 grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-2xl border border-slate-200 p-5">
          <h3 className="text-lg font-semibold text-slate-900">Authenticator app</h3>
          <p className="mt-2 text-sm text-slate-600">
            Use Google Authenticator, Microsoft Authenticator, 1Password, or another TOTP-compatible app.
          </p>

          {requiresPassword ? (
            <div className="mt-4">
              <label className="mb-1.5 block text-sm font-medium text-slate-700">
                Current password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-400"
                placeholder="Required to change MFA settings"
              />
            </div>
          ) : null}

          {!status.enabled && !setup ? (
            <button
              type="button"
              onClick={handleStartSetup}
              disabled={loading}
              className="mt-5 rounded-xl bg-sky-500 px-4 py-2 font-semibold text-white transition hover:bg-sky-600 disabled:opacity-70"
            >
              {loading ? "Preparing..." : "Set up authenticator"}
            </button>
          ) : null}

          {!status.enabled && setup ? (
            <div className="mt-5 space-y-4">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-sm font-semibold text-slate-800">Manual setup key</p>
                <p className="mt-2 font-mono text-sm tracking-[0.18em] text-slate-900">
                  {setupSecret}
                </p>
                <p className="mt-3 text-xs text-slate-500">
                  If your authenticator app supports manual entry, enter this key and choose time-based 6-digit codes.
                </p>
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">
                  Verify setup code
                </label>
                <input
                  type="text"
                  value={verificationCode}
                  onChange={(e) => setVerificationCode(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-400"
                  placeholder="123456"
                />
              </div>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={handleEnable}
                  disabled={loading}
                  className="rounded-xl bg-emerald-600 px-4 py-2 font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-70"
                >
                  {loading ? "Verifying..." : "Enable 2FA"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSetup(null);
                    setVerificationCode("");
                    setSuccess("");
                    setError("");
                  }}
                  className="rounded-xl border border-slate-300 px-4 py-2 font-semibold text-slate-700 transition hover:bg-slate-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : null}

          {status.enabled ? (
            <div className="mt-5 space-y-4">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
                Backup codes remaining:{" "}
                <span className="font-semibold text-slate-900">
                  {status.backupCodesRemaining}
                </span>
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">
                  Current authenticator or backup code
                </label>
                <input
                  type="text"
                  value={disableCode}
                  onChange={(e) => setDisableCode(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-400"
                  placeholder="123456 or ABCD-EFGH"
                />
              </div>
              <button
                type="button"
                onClick={handleDisable}
                disabled={loading}
                className="rounded-xl border border-red-200 bg-red-50 px-4 py-2 font-semibold text-red-700 transition hover:bg-red-100 disabled:opacity-70"
              >
                {loading ? "Working..." : "Disable 2FA"}
              </button>
            </div>
          ) : null}
        </div>

        <div className="rounded-2xl border border-slate-200 p-5">
          <h3 className="text-lg font-semibold text-slate-900">Backup codes</h3>
          <p className="mt-2 text-sm text-slate-600">
            Backup codes are single-use emergency login codes in case you lose access to your authenticator app.
          </p>

          {recoveryCodes.length > 0 ? (
            <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4">
              <p className="text-sm font-semibold text-amber-800">
                Save these now. You won’t be able to view the same codes again.
              </p>
              <div className="mt-3 grid grid-cols-2 gap-2">
                {recoveryCodes.map((code) => (
                  <div
                    key={code}
                    className="rounded-lg bg-white px-3 py-2 font-mono text-sm text-slate-900"
                  >
                    {code}
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {status.enabled ? (
            <div className="mt-5 space-y-4">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">
                  Current authenticator or backup code
                </label>
                <input
                  type="text"
                  value={regenCode}
                  onChange={(e) => setRegenCode(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-400"
                  placeholder="123456 or ABCD-EFGH"
                />
              </div>
              <button
                type="button"
                onClick={handleRegenerateCodes}
                disabled={loading}
                className="rounded-xl border border-slate-300 px-4 py-2 font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-70"
              >
                {loading ? "Working..." : "Regenerate backup codes"}
              </button>
            </div>
          ) : (
            <p className="mt-4 rounded-2xl border border-dashed border-slate-200 px-4 py-3 text-sm text-slate-500">
              Backup codes will be generated after you enable two-factor authentication.
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
