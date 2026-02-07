const profiles = new Map();

function saveProfile(userId, profile) {
  profiles.set(userId, profile);
  return profiles.get(userId);
}

function getProfile(userId) {
  return profiles.get(userId);
}

module.exports = { saveProfile, getProfile };