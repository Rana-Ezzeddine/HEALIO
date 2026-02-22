// backend/src/controllers/profileController.js

import PatientProfile from "../models/PatientProfile.js";

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
  if (!s) return { value: null };
  const ok = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
  if (!ok) return { error: "email must be a valid email address" };
  return { value: s };
}

function normalizePhoneNumber(value, fieldName = "phoneNumber", required = true) {
  const s = normString(value);
  if (!s) return required ? { error: `${fieldName} is required` } : { value: null };
  if (!/^[+\d\s()-]+$/.test(s)) return { error: `${fieldName} must contain only digits and optional +, spaces, (), -` };
  const digits = s.replace(/[^\d]/g, "");
  if (digits.length < 8 || digits.length > 15) return { error: `${fieldName} must have 8 to 15 digits` };
  const normalized = s.trim().startsWith("+") ? `+${digits}` : digits;
  return { value: normalized };
}

function normalizeStringArray(value) {
  if (Array.isArray(value)) {
    return value.filter((x) => typeof x === "string").map((x) => x.trim()).filter((x) => x.length > 0);
  }
  if (typeof value === "string") {
    return value.split(",").map((x) => x.trim()).filter((x) => x.length > 0);
  }
  return [];
}

function normalizeEmergencyContact(value) {
  if (!value || typeof value !== "object") return { value: null };
  const name = normString(value.name);
  const relationship = normString(value.relationship);
  const phoneRes = normalizePhoneNumber(value.phoneNumber, "emergencyContact.phoneNumber", false);
  const anyProvided = !!(name || relationship || phoneRes.value);
  if (!anyProvided) return { value: null };
  if (!name) return { error: "emergencyContact.name is required (if providing emergency contact)" };
  if (!relationship) return { error: "emergencyContact.relationship is required (if providing emergency contact)" };
  if (phoneRes.error) return { error: phoneRes.error };
  if (!phoneRes.value) return { error: "emergencyContact.phoneNumber is required (if providing emergency contact)" };
  return { value: { name, relationship, phoneNumber: phoneRes.value } };
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
      sex: genderRes.value,                               // mapped to 'sex' to match PatientProfile model
      dateOfBirth: dobRes.value,
      allergies: normalizeStringArray(data.allergies).join(", "),         // stored as TEXT
      medicalConditions: normalizeStringArray(data.chronicConditions).join(", "), // stored as TEXT
      bloodType: bloodRes.value,
      phoneNumber: phoneRes.value,
      email: emailRes.value,
      emergencyContact: emergencyRes.value
        ? JSON.stringify(emergencyRes.value)
        : null,                                            // stored as JSON string in TEXT column
    },
  };
}

// POST /api/profile (create or update)
export async function postProfile(req, res) {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ message: "Unauthorized" });

  const data = req.body || {};
  const { error, normalized } = validateProfile(data);
  if (error) return res.status(400).json({ message: error });

  try {
    const [profile, created] = await PatientProfile.upsert({
      userId,
      ...normalized,
    });

    return res.status(200).json(profile);
  } catch (err) {
    console.error("postProfile error:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
}

// GET /api/profile
export async function getMyProfile(req, res) {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ message: "Unauthorized" });

  try {
    const profile = await PatientProfile.findOne({ where: { userId } });
    if (!profile) return res.status(404).json({ message: "Profile not found" });

    return res.status(200).json(profile);
  } catch (err) {
    console.error("getMyProfile error:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
}

// GET /api/profile/emergency-card
export async function getEmergencyCard(req, res) {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ message: "Unauthorized" });

  try {
    const profile = await PatientProfile.findOne({ where: { userId } });
    if (!profile) return res.status(404).json({ message: "Profile not found" });

    const fullName = `${profile.firstName} ${profile.lastName}`;

    const allergiesList = profile.allergies ? profile.allergies.split(",").map((s) => s.trim()).filter(Boolean) : [];
    const conditionsList = profile.medicalConditions ? profile.medicalConditions.split(",").map((s) => s.trim()).filter(Boolean) : [];

    const allergiesText = allergiesList.length ? allergiesList.join(", ") : "None";
    const conditionsText = conditionsList.length ? conditionsList.join(", ") : "None";
    const bloodText = profile.bloodType || "Unknown";

    const contact = profile.emergencyContact ? JSON.parse(profile.emergencyContact) : {};
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
      gender: profile.sex,
      dateOfBirth: profile.dateOfBirth,
      bloodType: profile.bloodType,
      allergies: allergiesList,
      chronicConditions: conditionsList,
      phoneNumber: profile.phoneNumber,
      email: profile.email,
      emergencyContact: contact.name ? contact : null,
      shareText,
    });
  } catch (err) {
    console.error("getEmergencyCard error:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
}