function hasText(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function normalizeEmergencyContact(value) {
  if (!value) return {};
  if (typeof value === "object") return value;
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch {
      return {};
    }
  }
  return {};
}

export function getProfileCompletion(profile = {}) {
  const emergencyContact = normalizeEmergencyContact(profile.emergencyContact);
  const phoneNumber = profile.phoneNumber || profile.phone;
  const checks = [
    { key: "firstName", label: "First name", done: hasText(profile.firstName) },
    { key: "lastName", label: "Last name", done: hasText(profile.lastName) },
    { key: "dateOfBirth", label: "Date of birth", done: hasText(profile.dateOfBirth) },
    { key: "gender", label: "Gender", done: hasText(profile.gender || profile.sex) },
    { key: "phoneNumber", label: "Phone number", done: hasText(phoneNumber) },
    { key: "bloodType", label: "Blood type", done: hasText(profile.bloodType) },
    {
      key: "emergencyContact",
      label: "Emergency contact",
      done:
        hasText(emergencyContact.name) &&
        hasText(emergencyContact.relationship) &&
        hasText(emergencyContact.phoneNumber),
    },
  ];

  const doneCount = checks.filter((item) => item.done).length;
  return {
    checks,
    doneCount,
    totalCount: checks.length,
    percent: Math.round((doneCount / checks.length) * 100),
    missing: checks.filter((item) => !item.done),
    complete: doneCount === checks.length,
  };
}

export function buildPatientSetupChecklist({
  profile,
  doctorCount = 0,
  caregiverCount = 0,
  medicationCount = 0,
  symptomCount = 0,
  appointmentCount = 0,
}) {
  const profileStatus = getProfileCompletion(profile);
  const tasks = [
    {
      key: "profile",
      label: "Complete your profile",
      description: "Add personal details, contact info, and your emergency contact.",
      done: profileStatus.complete,
      href: "/profilePatient",
    },
    {
      key: "doctor",
      label: "Connect a doctor",
      description: "Link a doctor so appointment requests and treatment coordination become available.",
      done: doctorCount > 0,
      href: "/care-team",
    },
    {
      key: "caregiver",
      label: "Connect a caregiver",
      description: "Invite a caregiver if someone helps manage your day-to-day care.",
      done: caregiverCount > 0,
      href: "/care-team",
    },
    {
      key: "medication",
      label: "Add a medication",
      description: "Track your treatment plan and upcoming doses.",
      done: medicationCount > 0,
      href: "/medication",
    },
    {
      key: "symptom",
      label: "Log your first symptom",
      description: "Capture how you feel so your trend history starts building.",
      done: symptomCount > 0,
      href: "/symptoms",
    },
    {
      key: "appointment",
      label: "Request your first appointment",
      description: "Send an appointment request to one of your linked doctors.",
      done: appointmentCount > 0,
      href: "/patientAppointments",
    },
  ];

  return {
    tasks,
    doneCount: tasks.filter((task) => task.done).length,
    totalCount: tasks.length,
    profileStatus,
  };
}
