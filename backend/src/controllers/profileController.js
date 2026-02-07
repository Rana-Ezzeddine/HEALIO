const { saveProfile, getProfile } = require("../store/profileStore");

function extractNames(data) {
  // Preferred new fields
  let firstName = typeof data.firstName === "string" ? data.firstName.trim() : "";
  let lastName = typeof data.lastName === "string" ? data.lastName.trim() : "";

  // Backward compatibility: if old client sends fullName, split it
  if ((!firstName || !lastName) && typeof data.fullName === "string") {
    const parts = data.fullName.trim().split(/\s+/).filter(Boolean);
    if (!firstName && parts.length >= 1) firstName = parts[0];
    if (!lastName && parts.length >= 2) lastName = parts.slice(1).join(" ");
  }

  return { firstName, lastName };
}

function validateProfile(data) {
  const { firstName, lastName } = extractNames(data);

  if (!firstName) return "firstName is required";
  if (firstName.length < 2) return "firstName must be at least 2 characters";

  if (!lastName) return "lastName is required";
  if (lastName.length < 2) return "lastName must be at least 2 characters";

  // email (optional, but if present must be valid)
  if (data.email != null) {
    if (typeof data.email !== "string") return "email must be a string";
    const email = data.email.trim();
    if (email.length === 0) return "email cannot be empty";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return "email is invalid";
  }

  // phoneNumber (optional, but if present must be valid)
  if (data.phoneNumber != null) {
    if (typeof data.phoneNumber !== "string") return "phoneNumber must be a string";
    const phone = data.phoneNumber.trim();
    if (phone.length === 0) return "phoneNumber cannot be empty";
    const digits = phone.replace(/\D/g, "");
    if (digits.length < 7) return "phoneNumber is invalid";
  }

  return null;
}

function normalizeStringArray(value) {
  if (!Array.isArray(value)) return [];
  return value
    .filter((x) => typeof x === "string")
    .map((x) => x.trim())
    .filter((x) => x.length > 0);
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

function normalizeEmergencyContact(value) {
  if (!value || typeof value !== "object") return null;

  // Backward compatibility: accept `phone` too
  const rawPhone = value.phoneNumber ?? value.phone;

  return {
    name: typeof value.name === "string" ? value.name.trim() : null,
    relationship: typeof value.relationship === "string" ? value.relationship.trim() : null,
    phoneNumber: typeof rawPhone === "string" ? rawPhone.trim() : null,
  };
}

// POST /profile (create or update)
function postProfile(req, res) {
  const userId = req.userId;
  const data = req.body;

  const error = validateProfile(data);
  if (error) return res.status(400).json({ message: error });

  const { firstName, lastName } = extractNames(data);

  const profile = {
    // Personal Information
    firstName,
    lastName,
    gender: data.gender || null,
    dateOfBirth: data.dateOfBirth || null,

    // Medical Information
    allergies: normalizeStringArray(data.allergies),
    chronicConditions: normalizeStringArray(data.chronicConditions),
    bloodType: data.bloodType || null,

    // Contact Information
    phoneNumber: normalizePhoneNumber(data.phoneNumber),
    email: normalizeEmail(data.email),

    // Emergency Contact
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
