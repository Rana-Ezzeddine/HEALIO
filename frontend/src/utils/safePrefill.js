const STORAGE_KEY = "healio.safe-prefill.v1";

function loadStore() {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function saveStore(value) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
  } catch {
    // Ignore storage write errors (private mode, quota limits, etc.)
  }
}

function sanitizeValue(value) {
  if (typeof value === "string") {
    return value.slice(0, 500);
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return value;
  }
  return undefined;
}

export function readSafePrefill(scope, defaults = {}) {
  const store = loadStore();
  const scopeData = store[scope] && typeof store[scope] === "object" ? store[scope] : {};
  return { ...defaults, ...scopeData };
}

export function writeSafePrefill(scope, values = {}) {
  const store = loadStore();
  const current = store[scope] && typeof store[scope] === "object" ? store[scope] : {};
  const next = { ...current };

  for (const [key, value] of Object.entries(values)) {
    const sanitized = sanitizeValue(value);
    if (sanitized === undefined || sanitized === null || sanitized === "") {
      delete next[key];
    } else {
      next[key] = sanitized;
    }
  }

  store[scope] = next;
  saveStore(store);
}

export function clearSafePrefill(scope, keys = []) {
  const store = loadStore();
  if (!store[scope]) return;

  if (!Array.isArray(keys) || keys.length === 0) {
    delete store[scope];
    saveStore(store);
    return;
  }

  for (const key of keys) {
    delete store[scope][key];
  }

  saveStore(store);
}
