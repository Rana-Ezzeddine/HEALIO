import bcrypt from "bcrypt";
import crypto from "crypto";
import jwt from "jsonwebtoken";

const MFA_ISSUER = process.env.MFA_ISSUER || "HEALIO";
const TOTP_STEP_SECONDS = 30;
const TOTP_DIGITS = 6;
const TOTP_WINDOW = 1;
const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

function getMfaSecretKey() {
  const secret = process.env.MFA_ENCRYPTION_SECRET || process.env.JWT_ACCESS_SECRET;
  if (!secret) {
    throw new Error("Server misconfigured.");
  }
  return crypto.createHash("sha256").update(String(secret)).digest();
}

function base32Encode(buffer) {
  let bits = 0;
  let value = 0;
  let output = "";

  for (const byte of buffer) {
    value = (value << 8) | byte;
    bits += 8;

    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }

  if (bits > 0) {
    output += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  }

  return output;
}

function base32Decode(input) {
  const normalized = String(input || "")
    .toUpperCase()
    .replace(/[^A-Z2-7]/g, "");

  let bits = 0;
  let value = 0;
  const bytes = [];

  for (const char of normalized) {
    const index = BASE32_ALPHABET.indexOf(char);
    if (index === -1) continue;

    value = (value << 5) | index;
    bits += 5;

    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }

  return Buffer.from(bytes);
}

function formatManualEntryKey(secret) {
  return String(secret || "").replace(/(.{4})/g, "$1 ").trim();
}

function normalizeCode(code) {
  return String(code || "").trim().replace(/\s+/g, "");
}

function generateHotp(secret, counter) {
  const counterBuffer = Buffer.alloc(8);
  counterBuffer.writeBigUInt64BE(BigInt(counter));
  const hmac = crypto.createHmac("sha1", base32Decode(secret)).update(counterBuffer).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const binary =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);

  return String(binary % 10 ** TOTP_DIGITS).padStart(TOTP_DIGITS, "0");
}

function getCounterAt(timeMs) {
  return Math.floor(timeMs / 1000 / TOTP_STEP_SECONDS);
}

export function generateTotpSecret() {
  return base32Encode(crypto.randomBytes(20));
}

export function buildOtpAuthUrl({ email, secret, issuer = MFA_ISSUER }) {
  const label = `${issuer}:${email}`;
  const params = new URLSearchParams({
    secret,
    issuer,
    algorithm: "SHA1",
    digits: String(TOTP_DIGITS),
    period: String(TOTP_STEP_SECONDS),
  });
  return `otpauth://totp/${encodeURIComponent(label)}?${params.toString()}`;
}

export function encryptMfaSecret(secret) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", getMfaSecretKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(String(secret), "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString("base64")}.${tag.toString("base64")}.${ciphertext.toString("base64")}`;
}

export function decryptMfaSecret(payload) {
  const [ivPart, tagPart, ciphertextPart] = String(payload || "").split(".");
  if (!ivPart || !tagPart || !ciphertextPart) {
    throw new Error("Invalid MFA secret payload.");
  }

  const decipher = crypto.createDecipheriv(
    "aes-256-gcm",
    getMfaSecretKey(),
    Buffer.from(ivPart, "base64")
  );
  decipher.setAuthTag(Buffer.from(tagPart, "base64"));
  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(ciphertextPart, "base64")),
    decipher.final(),
  ]);

  return plaintext.toString("utf8");
}

export function verifyTotpCode(secret, code, now = Date.now()) {
  const normalizedCode = normalizeCode(code);
  if (!/^\d{6}$/.test(normalizedCode)) return false;

  const currentCounter = getCounterAt(now);
  for (let offset = -TOTP_WINDOW; offset <= TOTP_WINDOW; offset += 1) {
    if (generateHotp(secret, currentCounter + offset) === normalizedCode) {
      return true;
    }
  }
  return false;
}

export async function generateBackupCodes(count = 8) {
  const codes = Array.from({ length: count }, () => {
    const raw = crypto.randomBytes(4).toString("hex").toUpperCase();
    return `${raw.slice(0, 4)}-${raw.slice(4)}`;
  });

  const hashes = await Promise.all(codes.map((code) => bcrypt.hash(code, 10)));
  return { codes, hashes };
}

export async function verifyBackupCode(code, hashes = []) {
  const normalizedCode = normalizeCode(code).toUpperCase();
  if (!normalizedCode) return { ok: false, remainingHashes: hashes };

  for (let index = 0; index < hashes.length; index += 1) {
    const hash = hashes[index];
    // eslint-disable-next-line no-await-in-loop
    const matches = await bcrypt.compare(normalizedCode, hash);
    if (matches) {
      return {
        ok: true,
        remainingHashes: hashes.filter((_, hashIndex) => hashIndex !== index),
      };
    }
  }

  return { ok: false, remainingHashes: hashes };
}

function getChallengeSecret() {
  const secret = process.env.JWT_ACCESS_SECRET;
  if (!secret) throw new Error("Server misconfigured.");
  return secret;
}

export function createMfaChallengeToken({ userId, provider = "local" }) {
  return jwt.sign(
    {
      sub: userId,
      purpose: "mfa_login",
      provider,
    },
    getChallengeSecret(),
    { expiresIn: process.env.MFA_CHALLENGE_EXPIRES_IN || "10m" }
  );
}

export function verifyMfaChallengeToken(token) {
  const payload = jwt.verify(String(token || ""), getChallengeSecret());
  if (payload.purpose !== "mfa_login") {
    throw new Error("Invalid MFA challenge.");
  }
  return payload;
}

export function createMfaSetupToken({ userId, encryptedSecret }) {
  return jwt.sign(
    {
      sub: userId,
      purpose: "mfa_setup",
      encryptedSecret,
    },
    getChallengeSecret(),
    { expiresIn: process.env.MFA_SETUP_EXPIRES_IN || "10m" }
  );
}

export function verifyMfaSetupToken(token) {
  const payload = jwt.verify(String(token || ""), getChallengeSecret());
  if (payload.purpose !== "mfa_setup" || !payload.encryptedSecret) {
    throw new Error("Invalid MFA setup token.");
  }
  return payload;
}

export function buildMfaSetupPayload({ email, secret }) {
  return {
    manualEntryKey: formatManualEntryKey(secret),
    secret,
    otpAuthUrl: buildOtpAuthUrl({ email, secret }),
  };
}
