const profiles = new Map();

export function saveProfile(userId, profile) {
  profiles.set(userId, profile);
  return profiles.get(userId);
}

export function getProfile(userId) {
  return profiles.get(userId);
}