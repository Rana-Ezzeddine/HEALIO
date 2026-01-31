const { saveProfile, getProfile } = require("../store/profileStore");

function validateProfile(data) {
  if (!data.fullName || typeof data.fullName !== "string") return "fullName is required";
  if (data.fullName.trim().length < 2) return "fullName must be at least 2 characters";
  return null;
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
  return {
    name: typeof value.name === "string" ? value.name.trim() : null,
    phone: typeof value.phone === "string" ? value.phone.trim() : null,
    relationship: typeof value.relationship === "string" ? value.relationship.trim() : null,
  };
}

// POST /profile (create or update)
function postProfile(req, res) {
  const userId = req.userId;
  const data = req.body;

  const error = validateProfile(data);
  if (error) return res.status(400).json({ message: error });

  const profile = {
    fullName: data.fullName.trim(),
    dateOfBirth: data.dateOfBirth || null,
    gender: data.gender || null,
    bloodType: data.bloodType || null,
    allergies: normalizeStringArray(data.allergies),
    chronicConditions: normalizeStringArray(data.chronicConditions),
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

  const allergiesText = profile.allergies.length ? profile.allergies.join(", ") : "None";
  const conditionsText = profile.chronicConditions.length ? profile.chronicConditions.join(", ") : "None";
  const bloodText = profile.bloodType ? profile.bloodType : "Unknown";

  const contact = profile.emergencyContact || {};
  const contactName = contact.name || "Unknown";
  const contactRel = contact.relationship || "Unknown";
  const contactPhone = contact.phone || "Unknown";

  const shareText =
    `EMERGENCY INFO — ${profile.fullName} | ` +
    `Blood: ${bloodText} | ` +
    `Allergies: ${allergiesText} | ` +
    `Conditions: ${conditionsText} | ` +
    `Contact: ${contactName} (${contactRel}) ${contactPhone}`;

  return res.status(200).json({
    fullName: profile.fullName,
    bloodType: profile.bloodType || null,
    allergies: profile.allergies,
    chronicConditions: profile.chronicConditions,
    emergencyContact: profile.emergencyContact,
    shareText,
  });
}

module.exports = { postProfile, getMyProfile, getEmergencyCard };