function parseDateOnly(dateString) {
  if (!dateString || typeof dateString !== "string") return null;
  const parts = dateString.split("-");
  if (parts.length !== 3) return null;

  const year = Number(parts[0]);
  const month = Number(parts[1]) - 1;
  const day = Number(parts[2]);
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) {
    return null;
  }

  return new Date(year, month, day, 0, 0, 0, 0);
}

export function isActiveMedication(medication, now = new Date()) {
  const start = parseDateOnly(medication?.startDate);
  const end = parseDateOnly(medication?.endDate);

  const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);

  if (start && dayStart < start) return false;
  if (end && dayStart > end) return false;
  return true;
}

function normalizeTimeString(value) {
  if (typeof value !== "string") return null;
  const m = value.trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;

  const hour = Number(m[1]);
  const minute = Number(m[2]);
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;

  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function inferTimesFromFrequency(frequency) {
  const text = (frequency || "").toLowerCase();

  if (text.includes("three") && text.includes("daily")) return ["08:00", "14:00", "20:00"];
  if (text.includes("twice") && text.includes("daily")) return ["08:00", "20:00"];
  if (text.includes("once") && text.includes("daily")) return ["08:00"];
  if (text.includes("daily")) return ["08:00"];

  const everyHoursMatch = text.match(/every\s+(\d+)\s*hour/);
  if (everyHoursMatch) {
    const step = Number(everyHoursMatch[1]);
    if (Number.isInteger(step) && step > 0 && step <= 24) {
      const times = [];
      for (let h = 0; h < 24; h += step) {
        times.push(`${String(h).padStart(2, "0")}:00`);
      }
      return times.length > 0 ? times : ["08:00"];
    }
  }

  return ["08:00"];
}

export function getScheduleTimes(medication) {
  const schedule = medication?.scheduleJson;

  if (Array.isArray(schedule)) {
    const normalized = schedule.map(normalizeTimeString).filter(Boolean);
    if (normalized.length > 0) return normalized;
  }

  if (schedule && typeof schedule === "object" && Array.isArray(schedule.times)) {
    const normalized = schedule.times.map(normalizeTimeString).filter(Boolean);
    if (normalized.length > 0) return normalized;
  }

  return inferTimesFromFrequency(medication?.frequency);
}

function nextDateFromTime(now, timeString) {
  const [hourString, minuteString] = timeString.split(":");
  const hour = Number(hourString);
  const minute = Number(minuteString);

  const candidate = new Date(now);
  candidate.setHours(hour, minute, 0, 0);

  if (candidate <= now) {
    candidate.setDate(candidate.getDate() + 1);
  }
  return candidate;
}

export function formatDoseTime(date) {
  return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

export function getNextMedicationDose(medications, now = new Date()) {
  const list = Array.isArray(medications) ? medications : [];

  let best = null;
  for (const med of list) {
    if (!isActiveMedication(med, now)) continue;

    const times = getScheduleTimes(med);
    for (const time of times) {
      const at = nextDateFromTime(now, time);
      if (!best || at < best.at) {
        best = { medication: med, at };
      }
    }
  }

  return best;
}
