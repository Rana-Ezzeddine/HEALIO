// backend/src/controllers/profileController.js

const { saveProfile, getProfile } = require("../store/profileStore");

// Allowed values
const ALLOWED_GENDERS = new Set(["Male", "Female", "Prefer not to say"]);
const ALLOWED_BLOOD_TYPES = new Set(["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"]);

// Simple validators / normalizers
function normString(v) {
  if (typeof v !== "string") return null;
  const s = v.trim();
  return s.length ? s : null;
}

function isAlphaOnly(v) {
  // Strict letters only (no spaces/hyphens). If you want to allow spaces/hyphens, tell me.
  return /^[A-Za-z]+$/.test(v);
}

function normalizeName(value, fieldName) {
  const s = normString(value);
  if (!s) return { error: `${fieldName} is required` };
  if (s.length < 2) return { error: `${fieldName} must be at least 2 characters` };
  if (!isAlphaOnly(s)) return { error: `${fieldName} must contain letters only` };
  return { value: s };
}

const GENDER_CANON = {
  male: "Male",
  female: "Female",
  "prefer not to say": "Prefer not to say",
  "prefer-not-to-say": "Prefer not to say",
  "prefer_not_to_say": "Prefer not to say",
};

function normalizeGender(value) {
  if (typeof value !== "string") return { error: "gender is required" };
  const key = value.trim().toLowerCase();
  const canon = GENDER_CANON[key];
  if (!canon) return { error: "gender must be Male, Female, or Prefer not to say" };
  return { value: canon };
}

function isValidYYYYMMDD(dateStr) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return false;
  const d = new Date(`${dateStr}T00:00:00.000Z`);
  if (Number.isNaN(d.getTime())) return false;

  // Ensure it didn’t auto-correct (e.g., 2026-02-31 -> March)
  const [y, m, day] = dateStr.split("-").map((x) => parseInt(x, 10));
  return (
    d.getUTCFullYear() === y &&
    d.getUTCMonth() + 1 === m &&
    d.getUTCDate() === day
  );
}

function normalizeDateOfBirth(value) {
  const s = normString(value);
  if (!s) return { error: "dateOfBirth is required" };
  if (!isValidYYYYMMDD(s)) return { error: "dateOfBirth must be in YYYY-MM-DD format and be a real date" };
  return { value: s };
}

function normalizeBloodType(value) {
  const s = normString(value);
  if (!s) return { error: "bloodType is required" };
  if (!ALLOWED_BLOOD_TYPES.has(s)) return { error: "bloodType must be one of: A+, A-, B+, B-, AB+, AB-, O+, O-" };
  return { value: s };
}

function normalizeEmail(value) {
  const s = normString(value);
  if (!s) return { value: null }; // optional
  const ok = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
  if (!ok) return { error: "email must be a valid email address" };
  return { value: s };
}

function normalizePhoneNumber(value, fieldName = "phoneNumber", required = true) {
  const s = normString(value);
  if (!s) return required ? { error: `${fieldName} is required` } : { value: null };

  // Allow +, spaces, -, (), and digits; then validate digit count
  if (!/^[+\d\s()-]+$/.test(s)) return { error: `${fieldName} must contain only digits and optional +, spaces, (), -` };

  const digits = s.replace(/[^\d]/g, "");
  if (digits.length < 8 || digits.length > 15) return { error: `${fieldName} must have 8 to 15 digits` };

  // Normalize: keep leading + if user provided it, otherwise store digits only
  const normalized = s.trim().startsWith("+") ? `+${digits}` : digits;
  return { value: normalized };
}

function normalizeStringArray(value) {
  // Accept array OR comma-separated string from UI
  if (Array.isArray(value)) {
    return value
      .filter((x) => typeof x === "string")
      .map((x) => x.trim())
      .filter((x) => x.length > 0);
  }
  if (typeof value === "string") {
    return value
      .split(",")
      .map((x) => x.trim())
      .filter((x) => x.length > 0);
  }
  return [];
}

function normalizeEmergencyContact(value) {
  if (!value || typeof value !== "object") return { value: null };

  const name = normString(value.name);
  const relationship = normString(value.relationship);
  const phoneRes = normalizePhoneNumber(value.phoneNumber, "emergencyContact.phoneNumber", false);

  // If user didn’t fill any emergency contact field, store null
  const anyProvided = !!(name || relationship || phoneRes.value);
  if (!anyProvided) return { value: null };

  // If they started filling it, require all 3 to be valid
  if (!name) return { error: "emergencyContact.name is required (if providing emergency contact)" };
  if (!relationship) return { error: "emergencyContact.relationship is required (if providing emergency contact)" };
  if (phoneRes.error) return { error: phoneRes.error };
  if (!phoneRes.value) return { error: "emergencyContact.phoneNumber is required (if providing emergency contact)" };

  return {
    value: {
      name,
      relationship,
      phoneNumber: phoneRes.value,
    },
  };
}

function validateProfile(data) {
  const firstNameRes = normalizeName(data.firstName, "firstName");
  if (firstNameRes.error) return { error: firstNameRes.error };

  const lastNameRes = normalizeName(data.lastName, "lastName");
  if (lastNameRes.error) return { error: lastNameRes.error };

  const genderRes = normalizeGender(data.gender);
  if (genderRes.error) return { error: genderRes.error };

  const dobRes = normalizeDateOfBirth(data.dateOfBirth);
  if (dobRes.error) return { error: dobRes.error };

  const phoneRes = normalizePhoneNumber(data.phoneNumber, "phoneNumber", true);
  if (phoneRes.error) return { error: phoneRes.error };

  const bloodRes = normalizeBloodType(data.bloodType);
  if (bloodRes.error) return { error: bloodRes.error };

  const emailRes = normalizeEmail(data.email);
  if (emailRes.error) return { error: emailRes.error };

  const emergencyRes = normalizeEmergencyContact(data.emergencyContact);
  if (emergencyRes.error) return { error: emergencyRes.error };

  return {
    normalized: {
      firstName: firstNameRes.value,
      lastName: lastNameRes.value,
      gender: genderRes.value,
      dateOfBirth: dobRes.value,

      // medical
      allergies: normalizeStringArray(data.allergies),
      chronicConditions: normalizeStringArray(data.chronicConditions),
      bloodType: bloodRes.value,

      // contact
      phoneNumber: phoneRes.value,
      email: emailRes.value, // optional (null if not provided)

      // emergency
      emergencyContact: emergencyRes.value, // null if not provided
    },
  };
}

// POST /api/profile (create or update)
function postProfile(req, res) {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ message: "Unauthorized" });

  const data = req.body || {};
  const { error, normalized } = validateProfile(data);
  if (error) return res.status(400).json({ message: error });

  const profile = {
    ...normalized,
    updatedAt: new Date().toISOString(),
  };

  const saved = saveProfile(userId, profile);
  return res.status(200).json(saved);
}

// GET /api/profile
function getMyProfile(req, res) {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ message: "Unauthorized" });

  const profile = getProfile(userId);
  if (!profile) return res.status(404).json({ message: "Profile not found" });

  return res.status(200).json(profile);
}

// GET /api/profile/emergency-card
function getEmergencyCard(req, res) {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ message: "Unauthorized" });

  const profile = getProfile(userId);
  if (!profile) return res.status(404).json({ message: "Profile not found" });

  const fullName = `${profile.firstName} ${profile.lastName}`;

  const allergiesText = profile.allergies?.length ? profile.allergies.join(", ") : "None";
  const conditionsText = profile.chronicConditions?.length ? profile.chronicConditions.join(", ") : "None";
  const bloodText = profile.bloodType || "Unknown";

  const contact = profile.emergencyContact || {};
  const contactName = contact.name || "Unknown";
  const contactRel = contact.relationship || "Unknown";
  const contactPhone = contact.phoneNumber || "Unknown";

  const shareText =
    `EMERGENCY INFO — ${fullName} | ` +
    `Blood: ${bloodText} | ` +
    `Allergies: ${allergiesText} | ` +
    `Conditions: ${conditionsText} | ` +
    `Contact: ${contactName} (${contactRel}) ${contactPhone}`;

  return res.status(200).json({
    fullName,
    gender: profile.gender,
    dateOfBirth: profile.dateOfBirth,

    bloodType: profile.bloodType,
    allergies: profile.allergies,
    chronicConditions: profile.chronicConditions,

    phoneNumber: profile.phoneNumber,
    email: profile.email,

    emergencyContact: profile.emergencyContact,
    shareText,
  });
}

module.exports = { postProfile, getMyProfile, getEmergencyCard };
