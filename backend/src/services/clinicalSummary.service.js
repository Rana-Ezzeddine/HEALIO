const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

function cleanJsonBlock(text) {
  const trimmed = String(text || "").trim();
  if (!trimmed) return "";
  if (trimmed.startsWith("```")) {
    return trimmed
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```$/i, "")
      .trim();
  }
  return trimmed;
}

function deriveAgeBand(dateOfBirth) {
  if (!dateOfBirth) return "unknown";
  const dob = new Date(dateOfBirth);
  if (Number.isNaN(dob.getTime())) return "unknown";
  const age = Math.floor((Date.now() - dob.getTime()) / (1000 * 60 * 60 * 24 * 365.25));
  if (age < 18) return "<18";
  if (age < 30) return "18-29";
  if (age < 45) return "30-44";
  if (age < 60) return "45-59";
  if (age < 75) return "60-74";
  return "75+";
}

export function buildPrivacyMinimizedDoctorSummaryInput({ overview, timeline }) {
  const profile = overview?.patientProfile || {};
  const medications = (overview?.medications || []).slice(0, 12).map((item) => ({
    name: item.name,
    dosage: item.dosage,
    frequency: item.frequency,
    startDate: item.startDate || null,
    endDate: item.endDate || null,
    notes: item.notes || null,
  }));
  const diagnoses = (overview?.diagnoses || []).slice(0, 10).map((item) => ({
    diagnosisText: item.diagnosisText,
    status: item.status,
    diagnosedAt: item.diagnosedAt,
  }));
  const appointments = (overview?.appointmentsAsPatient || []).slice(0, 8).map((item) => ({
    startsAt: item.startsAt,
    endsAt: item.endsAt,
    status: item.status,
    location: item.location || null,
    notes: item.notes || null,
  }));
  const caregivers = (overview?.caregivers || []).slice(0, 6).map((entry) => ({
    role: "caregiver",
    permissions: entry.permissions || {},
  }));
  const caregiverNotes = (overview?.caregiverNotes || []).slice(0, 6).map((note) => ({
    createdAt: note.createdAt,
    note: note.note,
  }));
  const timelineItems = (timeline || []).slice(0, 12).map((item) => ({
    type: item.type,
    title: item.title,
    detail: item.detail,
    timestamp: item.timestamp,
  }));

  return {
    demographics: {
      ageBand: deriveAgeBand(profile.dateOfBirth),
      sex: profile.sex || "unknown",
      bloodType: profile.bloodType || "unknown",
    },
    emergency: {
      active: !!profile.emergencyStatus,
      updatedAt: profile.emergencyStatusUpdatedAt || null,
    },
    medicalHistory: {
      allergies: Array.isArray(profile.allergies) ? profile.allergies : profile.allergies ? [profile.allergies] : [],
      conditions: Array.isArray(profile.medicalConditions) ? profile.medicalConditions : profile.medicalConditions ? [profile.medicalConditions] : [],
    },
    diagnoses,
    medications,
    appointments,
    caregivers,
    caregiverNotes,
    recentTimeline: timelineItems,
  };
}

export function buildFallbackDoctorSummary(input) {
  const diagnoses = input?.diagnoses || [];
  const medications = input?.medications || [];
  const timeline = input?.recentTimeline || [];
  const appointments = input?.appointments || [];
  const emergency = input?.emergency || {};
  const conditions = input?.medicalHistory?.conditions || [];
  const allergies = input?.medicalHistory?.allergies || [];

  const latestSymptom = timeline.find((item) => item.type === "symptom");
  const upcomingAppointment = appointments.find((item) => item.status === "scheduled") || appointments[0] || null;

  const snapshotParts = [
    `Age band ${input?.demographics?.ageBand || "unknown"}, sex ${input?.demographics?.sex || "unknown"}.`,
    emergency.active ? "An active emergency alert is present." : "No active emergency alert is present.",
    diagnoses.length ? `${diagnoses.length} active diagnoses are currently tracked.` : "No active diagnoses are currently tracked.",
    medications.length ? `${medications.length} active medications are listed.` : "No active medications are listed.",
    latestSymptom ? `Latest symptom context: ${latestSymptom.title} (${latestSymptom.detail || "recent entry"}).` : "No recent symptom event is available.",
    upcomingAppointment ? `Next appointment context: ${upcomingAppointment.status || "scheduled"} visit ${upcomingAppointment.startsAt ? `at ${upcomingAppointment.startsAt}` : "is recorded"}.` : "No upcoming appointment is currently scheduled.",
  ];

  const careRisks = [];
  if (emergency.active) careRisks.push("Active emergency alert should be reviewed promptly.");
  if (conditions.length) careRisks.push(`Chronic condition burden: ${conditions.slice(0, 3).join(", ")}${conditions.length > 3 ? "..." : ""}.`);
  if (allergies.length) careRisks.push(`Allergy context present: ${allergies.slice(0, 3).join(", ")}${allergies.length > 3 ? "..." : ""}.`);
  if (latestSymptom) careRisks.push(`Recent symptom activity: ${latestSymptom.title} (${latestSymptom.detail || "no severity detail"}).`);

  const followUpFocus = [];
  if (!upcomingAppointment) followUpFocus.push("Confirm whether a follow-up appointment should be scheduled.");
  if (medications.length) followUpFocus.push("Review current medication burden and adherence context.");
  if (diagnoses.length) followUpFocus.push("Review active diagnoses and whether current plans remain appropriate.");
  if (!followUpFocus.length) followUpFocus.push("Continue routine clinician review.");

  return {
    clinicalSnapshot: snapshotParts.join(" "),
    careRisks: careRisks.slice(0, 4),
    followUpFocus: followUpFocus.slice(0, 3),
    generatedAt: new Date().toISOString(),
    model: "fallback-local-summary",
  };
}

export async function summarizeDoctorPatientContext(input) {
  if (!process.env.OPENROUTER_API_KEY) {
    throw new Error("OPENROUTER_API_KEY is missing.");
  }

  const prompt = `
You are assisting a doctor with a concise patient-context summary.
This is a doctor-facing summary, not patient-facing.
Do not diagnose new conditions.
Do not invent facts.
Use only the structured data provided.
Return only valid JSON.

Write a concise summary with:
- clinicalSnapshot: 2-4 sentences
- careRisks: up to 4 short bullet-style strings
- followUpFocus: up to 3 short next-step focus points

Data:
${JSON.stringify(input, null, 2)}

Return exactly:
{
  "clinicalSnapshot": "short paragraph",
  "careRisks": ["short item"],
  "followUpFocus": ["short item"]
}
`;

  const response = await fetch(OPENROUTER_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
      "HTTP-Referer": process.env.APP_URL || "http://localhost:5173",
      "X-Title": process.env.APP_NAME || "HEALIO",
    },
    body: JSON.stringify({
      model: process.env.OPENROUTER_MODEL || "openai/gpt-4.1-mini",
      temperature: 0.2,
      messages: [
        {
          role: "system",
          content:
            "You summarize de-identified patient context for doctors. You are concise, factual, and never invent missing information.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
    }),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data?.error?.message || "OpenRouter request failed.");
  }

  const rawText = data?.choices?.[0]?.message?.content;
  if (!rawText) {
    throw new Error("OpenRouter returned no content.");
  }

  const parsed = JSON.parse(cleanJsonBlock(rawText));
  return {
    clinicalSnapshot: String(parsed?.clinicalSnapshot || "").trim(),
    careRisks: Array.isArray(parsed?.careRisks) ? parsed.careRisks.map((item) => String(item || "").trim()).filter(Boolean).slice(0, 4) : [],
    followUpFocus: Array.isArray(parsed?.followUpFocus) ? parsed.followUpFocus.map((item) => String(item || "").trim()).filter(Boolean).slice(0, 3) : [],
    generatedAt: new Date().toISOString(),
    model: process.env.OPENROUTER_MODEL || "openai/gpt-4.1-mini",
  };
}
