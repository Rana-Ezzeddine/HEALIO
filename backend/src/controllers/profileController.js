const { saveProfile, getProfile } = require("../store/profileStore");

// Letters-only (Unicode) + at least 2 chars. (Supports Arabic/Latin/etc letters)
// If you truly want ONLY English letters, replace with: /^[A-Za-z]{2,}$/
const NAME_REGEX = /^[\p{L}]{2,}$/u;

const ALLOWED_GENDERS = new Set(["male", "female"]);
const ALLOWED_BLOOD_TYPES = new Set(["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"]);

function normalizeName(value) {
  if (typeof value !== "string") return null;
  const v = value.trim();
  if (!v) return null;
  return v;
}

function normalizeGender(value) {
  if (typeof value !== "string") return null;
  const v = value.trim().toLowerCase();
  if (!v) return null;
  return v;
}

function normalizeBloodType(value) {
  if (typeof value !== "string") return null;
  const v = value.trim().toUpperCase();
  if (!v) return null;
  return v;
}

function normalizeEmail(value) {
  if (typeof value !== "string") return null;
  const email = value.trim().toLowerCase();
  if (!email) return null;
  return email;
}

function normalizePhoneNumber(value) {
  if (typeof value !== "string") return null;
  const phone = value.trim();
  if (!phone) return null;
  return phone;
}

function isValidName(value) {
  if (typeof value !== "string") return false;
  const v = value.trim();
  return NAME_REGEX.test(v);
}

function isValidEmail(value) {
  if (typeof value !== "string") return false;
  const v = value.trim();
  if (!v) return false;
  // Simple practical email check (not perfect, but good enough for most apps)
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}

function isValidPhoneNumber(value) {
  if (typeof value !== "string") return false;
  const v = value.trim();
  if (!v) return false;

  // Allow +, spaces, hyphens, parentheses. Reject other weird chars.
  if (!/^[0-9+()\-\s]+$/.test(v)) return false;

  // Must have enough digits to be a real number
  const digits = v.replace(/\D/g, "");
  return digits.length >= 7 && digits.length <= 15;
}

function isValidDateOfBirth(value) {
  if (typeof value !== "string") return false;
  const v = value.trim();

  // Require YYYY-MM-DD
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;

  const [y, m, d] = v.split("-").map(Number);

  // Basic sanity
  if (m < 1 || m > 12) return false;
  if (d < 1 || d > 31) return false;

  // Validate it's an actual calendar date
  const date = new Date(Date.UTC(y, m - 1, d));
  if (
    date.getUTCFullYear() !== y ||
    date.getUTCMonth() !== m - 1 ||
    date.getUTCDate() !== d
  ) {
    return false;
  }

  // Not in the future
  const now = new Date();
  if (date.getTime() > now.getTime()) return false;

  return true;
}

function normalizeStringArray(value) {
  if (!Array.isArray(value)) return [];
  return value
    .filter((x) => typeof x === "string")
    .map((x) => x.trim())
    .filter((x) => x.length > 0);
}

function normalizeEmergencyContact(value) {
  if (!value || typeof value !== "object") return null;

  // accept old key `phone` too
  const rawPhone = value.phoneNumber ?? value.phone;

  return {
    name: typeof value.name === "string" ? value.name.trim() : null,
    relationship: typeof value.relationship === "string" ? value.relationship.trim() : null,
    phoneNumber: typeof rawPhone === "string" ? rawPhone.trim() : null,
  };
}

function validateProfile(data) {
  // Required: firstName
  if (data.firstName == null) return "firstName is required";
  if (typeof data.firstName !== "string") return "firstName must be a string";
  if (!isValidName(data.firstName)) return "firstName must be at least 2 letters and contain only letters";

  // Required: lastName
  if (data.lastName == null) return "lastName is required";
  if (typeof data.lastName !== "string") return "lastName must be a string";
  if (!isValidName(data.lastName)) return "lastName must be at least 2 letters and contain only letters";

  // Required: gender (male/female)
  if (data.gender == null) return "gender is required";
  if (typeof data.gender !== "string") return "gender must be a string";
  const gender = normalizeGender(data.gender);
  if (!gender || !ALLOWED_GENDERS.has(gender)) return "gender must be either 'male' or 'female'";

  // Required: dateOfBirth (YYYY-MM-DD)
  if (data.dateOfBirth == null) return "dateOfBirth is required";
  if (typeof data.dateOfBirth !== "string") return "dateOfBirth must be a string";
  if (!isValidDateOfBirth(data.dateOfBirth)) return "dateOfBirth must be a valid date in YYYY-MM-DD format (not in the future)";

  // Required: phoneNumber
  if (data.phoneNumber == null) return "phoneNumber is required";
  if (typeof data.phoneNumber !== "string") return "phoneNumber must be a string";
  if (!isValidPhoneNumber(data.phoneNumber)) return "phoneNumber is invalid";

  // Required: bloodType
  if (data.bloodType == null) return "bloodType is required";
  if (typeof data.bloodType !== "string") return "bloodType must be a string";
  const bloodType = normalizeBloodType(data.bloodType);
  if (!bloodType || !ALLOWED_BLOOD_TYPES.has(bloodType)) {
    return "bloodType must be one of: A+, A-, B+, B-, AB+, AB-, O+, O-";
  }

  // Optional: email (if present, must be valid)
  if (data.email != null) {
    if (typeof data.email !== "string") return "email must be a string";
    if (!isValidEmail(data.email)) return "email is invalid";
  }

  // Optional: emergencyContact (if present, validate fields)
  if (data.emergencyContact != null) {
    if (typeof data.emergencyContact !== "object") return "emergencyContact must be an object";

    const ec = normalizeEmergencyContact(data.emergencyContact);
    if (!ec) return "emergencyContact is invalid";

    if (ec.name != null && ec.name !== "" && !isValidName(ec.name)) {
      return "emergencyContact.name must be at least 2 letters and contain only letters";
    }
    if (ec.phoneNumber != null && ec.phoneNumber !== "" && !isValidPhoneNumber(ec.phoneNumber)) {
      return "emergencyContact.phoneNumber is invalid";
    }
    if (ec.relationship != null && typeof ec.relationship !== "string") {
      return "emergencyContact.relationship must be a string";
    }
  }

  return null;
}

// POST /profile (create or update)
function postProfile(req, res) {
  const userId = req.userId;
  const data = req.body;

  const error = validateProfile(data);
  if (error) return res.status(400).json({ message: error });

  const profile = {
    // Personal Information (required)
    firstName: normalizeName(data.firstName),
    lastName: normalizeName(data.lastName),
    gender: normalizeGender(data.gender),
    dateOfBirth: data.dateOfBirth.trim(),

    // Medical Information (required bloodType; others optional arrays)
    allergies: normalizeStringArray(data.allergies),
    chronicConditions: normalizeStringArray(data.chronicConditions),
    bloodType: normalizeBloodType(data.bloodType),

    // Contact Information
    phoneNumber: normalizePhoneNumber(data.phoneNumber),
    email: data.email != null ? normalizeEmail(data.email) : null,

    // Emergency Contact (optional)
    emergencyContact: normalizeEmergencyContact(data.emergencyContact),

    updatedAt: new Date().toISOString(),
  };

  const saved = saveProfile(userId, profile);
  return res.status(200).json(saved);
}

// GET /profile
function getMyProfile(req, res) {
  const userId = req.userId;
  const profile = getProfile(userId);

  if (!profile) return res.status(404).json({ message: "Profile not found" });

  return res.status(200).json(profile);
}

// GET /profile/emergency-card
function getEmergencyCard(req, res) {
  const userId = req.userId;
  const profile = getProfile(userId);

  if (!profile) return res.status(404).json({ message: "Profile not found" });

  const fullName = `${profile.firstName || ""} ${profile.lastName || ""}`.trim() || "Unknown";

  const allergiesText = profile.allergies?.length ? profile.allergies.join(", ") : "None";
  const conditionsText = profile.chronicConditions?.length ? profile.chronicConditions.join(", ") : "None";
  const bloodText = profile.bloodType ? profile.bloodType : "Unknown";

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
    firstName: profile.firstName,
    lastName: profile.lastName,
    bloodType: profile.bloodType || null,
    allergies: profile.allergies || [],
    chronicConditions: profile.chronicConditions || [],
    emergencyContact: profile.emergencyContact,
    shareText,
  });
}

module.exports = { postProfile, getMyProfile, getEmergencyCard };
