

import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import { randomUUID } from "crypto";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, "../../.env") });

import sequelize from "../../database.js";

// ─── OpenFDA fetch ────────────────────────────────────────────────────────────

const FDA_BASE = "https://api.fda.gov/drug/label.json";

// Drug categories to search — broad enough to get varied results
const SEARCH_TERMS = [
  "ibuprofen",
  "amoxicillin",
  "metformin",
  "lisinopril",
  "atorvastatin",
  "omeprazole",
  "amlodipine",
  "metoprolol",
  "sertraline",
  "albuterol",
  "levothyroxine",
  "azithromycin",
  "paracetamol",
  "aspirin",
  "prednisone",
  "gabapentin",
  "pantoprazole",
  "losartan",
  "hydrochlorothiazide",
  "cetirizine",
];

// Parse a dosage string like "500 mg" or "10 mg/5 mL" into amount + unit
function parseDosage(raw) {
  if (!raw) return { doseAmount: null, doseUnit: null };
  const match = String(raw).match(/(\d+(?:\.\d+)?)\s*(mg|mcg|g|mL|mg\/mL|mg\/5mL|%|IU|units?)/i);
  if (!match) return { doseAmount: null, doseUnit: null };
  return {
    doseAmount: parseFloat(match[1]),
    doseUnit: match[2].toLowerCase(),
  };
}

// Map FDA dosage_and_administration text to readable frequency
function parseFrequency(rawText) {
  if (!rawText) return "Once daily";
  const text = String(rawText).toLowerCase();
  if (/four times|4 times|every 6 hours/.test(text)) return "Four times daily";
  if (/three times|3 times|every 8 hours/.test(text)) return "Three times daily";
  if (/twice daily|two times|every 12 hours|bid/.test(text)) return "Twice daily";
  if (/every 4 hours/.test(text)) return "Every 4 hours";
  if (/every 72 hours|once weekly|weekly/.test(text)) return "Once weekly";
  if (/every 48 hours|every other day/.test(text)) return "Every other day";
  if (/as needed|prn|when needed/.test(text)) return "As needed";
  if (/once daily|once a day|qd|every 24 hours/.test(text)) return "Once daily";
  return "Once daily";
}

// Map frequency string to schedule times
function frequencyToScheduleTimes(frequency) {
  const map = {
    "Four times daily": ["08:00", "12:00", "16:00", "20:00"],
    "Three times daily": ["08:00", "14:00", "20:00"],
    "Twice daily": ["08:00", "20:00"],
    "Every 4 hours": ["06:00", "10:00", "14:00", "18:00", "22:00"],
    "Every 8 hours": ["08:00", "16:00", "00:00"],
    "Once weekly": ["08:00"],
    "Every other day": ["08:00"],
    "As needed": [],
    "Once daily": ["08:00"],
  };
  return map[frequency] || ["08:00"];
}

// Extract the best dosage string from an FDA result
function extractDosageString(result) {
  const description = result.description?.[0] || "";
  const dosageText = result.dosage_and_administration?.[0] || "";
  const combined = description + " " + dosageText;

  const match = combined.match(/\d+(?:\.\d+)?\s*(?:mg|mcg|g|mL|mg\/mL|%|IU|units?)/i);
  return match ? match[0] : null;
}

async function fetchDrugsForTerm(term) {
  try {
    const url = `${FDA_BASE}?search=openfda.generic_name:"${encodeURIComponent(term)}"&limit=5`;
    const res = await fetch(url);
    if (!res.ok) return [];
    const data = await res.json();
    return data.results || [];
  } catch {
    return [];
  }
}

async function fetchAllDrugs() {
  console.log("🔍 Fetching drug data from OpenFDA...\n");
  const allDrugs = [];

  for (const term of SEARCH_TERMS) {
    process.stdout.write(`  Fetching: ${term}...`);
    const results = await fetchDrugsForTerm(term);

    for (const result of results) {
      const brandNames = result.openfda?.brand_name || [];
      const genericNames = result.openfda?.generic_name || [];
      const dosageForms = result.openfda?.dosage_form || [];
      const routes = result.openfda?.route || [];

      const rawName =
        brandNames[0] || genericNames[0] || term;
      const name =
        rawName.charAt(0).toUpperCase() + rawName.slice(1).toLowerCase();

      const rawDosage = extractDosageString(result);
      const dosageStr = rawDosage || dosageForms[0] || "See label";
      const { doseAmount, doseUnit } = parseDosage(rawDosage);

      const rawFreqText = result.dosage_and_administration?.[0] || "";
      const frequency = parseFrequency(rawFreqText);
      const scheduleTimes = frequencyToScheduleTimes(frequency);

      const form = dosageForms[0] || "";
      const route = routes[0] || "";

      const notes = [
        result.warnings_and_cautions?.[0]?.slice(0, 120) ||
          result.warnings?.[0]?.slice(0, 120) ||
          null,
      ]
        .filter(Boolean)
        .join(" ")
        .trim() || null;

      allDrugs.push({
        name,
        dosage: dosageStr,
        frequency,
        doseAmount,
        doseUnit,
        scheduleJson: scheduleTimes.length > 0 ? { times: scheduleTimes } : null,
        form,
        route,
        notes,
      });

      // Stop at one good result per term to keep variety
      break;
    }

    console.log(results.length > 0 ? ` ✓` : ` (no results)`);

    // Respect FDA rate limit — 4 requests/second max
    await new Promise((r) => setTimeout(r, 300));
  }

  // Deduplicate by name
  const seen = new Set();
  return allDrugs.filter((d) => {
    const key = d.name.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// ─── DB helpers ───────────────────────────────────────────────────────────────

async function getPatientIds() {
  const [rows] = await sequelize.query(`
    SELECT id FROM users
    WHERE role = 'patient' AND "isVerified" = true
    ORDER BY "createdAt" ASC
  `);
  return rows.map((r) => r.id);
}

async function getDoctorsByPatient(patientId) {
  const [rows] = await sequelize.query(`
    SELECT u.id, pp."firstName", pp."lastName", u.email
    FROM doctor_patient_assignments dpa
    JOIN users u ON u.id = dpa."doctorId"
    LEFT JOIN patient_profiles pp ON pp."userId" = u.id
    WHERE dpa."patientId" = :patientId
      AND dpa.status = 'active'
    LIMIT 3
  `, { replacements: { patientId } });
  return rows;
}

async function medicationExistsForPatient(patientId, name) {
  const [rows] = await sequelize.query(`
    SELECT id FROM medications
    WHERE "patientId" = :patientId
      AND LOWER(name) = LOWER(:name)
    LIMIT 1
  `, { replacements: { patientId, name } });
  return rows.length > 0;
}

async function insertMedication(record) {
  await sequelize.query(`
    INSERT INTO medications (
      id, "patientId", name, dosage, frequency, "prescribedBy",
      "doseAmount", "doseUnit", "scheduleJson", "adherenceHistory",
      "reminderEnabled", "reminderLeadMinutes",
      "startDate", "endDate", notes, "createdAt", "updatedAt"
    ) VALUES (
      :id, :patientId, :name, :dosage, :frequency, :prescribedBy,
      :doseAmount, :doseUnit, :scheduleJson::jsonb, :adherenceHistory::jsonb,
      :reminderEnabled, :reminderLeadMinutes,
      :startDate, :endDate, :notes, NOW(), NOW()
    )
  `, {
    replacements: {
      id: randomUUID(),
      patientId: record.patientId,
      name: record.name,
      dosage: record.dosage,
      frequency: record.frequency,
      prescribedBy: record.prescribedBy,
      doseAmount: record.doseAmount,
      doseUnit: record.doseUnit,
      // Cast JSONB as string
      scheduleJson: record.scheduleJson
        ? JSON.stringify(record.scheduleJson)
        : null,
      adherenceHistory: JSON.stringify([]),
      reminderEnabled: true,
      reminderLeadMinutes: 30,
      startDate: record.startDate,
      endDate: record.endDate,
      notes: record.notes,
    },
  });
}

// ─── Date helpers ─────────────────────────────────────────────────────────────

function randomStartDate() {
  // Random start date between 6 months ago and today
  const now = new Date();
  const past = new Date();
  past.setMonth(past.getMonth() - 6);
  const diff = now.getTime() - past.getTime();
  const start = new Date(past.getTime() + Math.random() * diff);
  return start.toISOString().slice(0, 10);
}

function randomEndDate(startDate) {
  // 30% chance of no end date (ongoing medication)
  if (Math.random() < 0.3) return null;
  // End date between 30 and 365 days after start
  const start = new Date(startDate);
  const days = Math.floor(Math.random() * 335) + 30;
  const end = new Date(start);
  end.setDate(end.getDate() + days);
  return end.toISOString().slice(0, 10);
}

function formatDoctorName(doctor) {
  if (!doctor) return null;
  const name = [doctor.firstName, doctor.lastName].filter(Boolean).join(" ").trim();
  return name || doctor.email || null;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log("╔════════════════════════════════════════╗");
  console.log("║     HEALIO Medication Seeder           ║");
  console.log("║     Source: OpenFDA Drug Database      ║");
  console.log("╚════════════════════════════════════════╝\n");

  // Connect to DB
  const connected = await sequelize.authenticate().then(() => true).catch(() => false);
  if (!connected) {
    console.error("✗ Could not connect to database. Check your .env file.");
    process.exit(1);
  }
  console.log("✓ Database connected\n");

  // Get all verified patients
  const patientIds = await getPatientIds();
  if (patientIds.length === 0) {
    console.error("✗ No verified patients found. Create patient accounts first.");
    process.exit(1);
  }
  console.log(`✓ Found ${patientIds.length} patient(s)\n`);

  // Fetch drugs from OpenFDA
  const drugs = await fetchAllDrugs();
  console.log(`\n✓ Fetched ${drugs.length} unique drugs from OpenFDA\n`);

  if (drugs.length === 0) {
    console.error("✗ No drugs fetched. Check your internet connection.");
    process.exit(1);
  }

  // Seed medications
  console.log("💊 Seeding medications...\n");

  let totalInserted = 0;
  let totalSkipped = 0;

  for (const patientId of patientIds) {
    // Get this patient's active doctors for prescribedBy field
    const doctors = await getDoctorsByPatient(patientId);

    // Assign 3–6 random medications per patient
    const count = Math.floor(Math.random() * 4) + 3;
    const shuffled = [...drugs].sort(() => Math.random() - 0.5).slice(0, count);

    console.log(`  Patient ${patientId.slice(0, 8)}... → assigning ${shuffled.length} medications`);

    for (const drug of shuffled) {
      // Skip if this patient already has this medication
      const exists = await medicationExistsForPatient(patientId, drug.name);
      if (exists) {
        process.stdout.write(`    ⊘ ${drug.name} (already exists)\n`);
        totalSkipped++;
        continue;
      }

      // Pick a random doctor as prescriber (or null if no doctors linked)
      const doctor = doctors.length > 0
        ? doctors[Math.floor(Math.random() * doctors.length)]
        : null;

      const startDate = randomStartDate();
      const endDate = randomEndDate(startDate);

      await insertMedication({
        patientId,
        name: drug.name,
        dosage: drug.dosage,
        frequency: drug.frequency,
        prescribedBy: formatDoctorName(doctor),
        doseAmount: drug.doseAmount,
        doseUnit: drug.doseUnit,
        scheduleJson: drug.scheduleJson,
        startDate,
        endDate,
        notes: drug.notes,
      });

      process.stdout.write(`    ✓ ${drug.name} (${drug.dosage}, ${drug.frequency})\n`);
      totalInserted++;
    }

    console.log();
  }

  // Summary
  console.log("╔════════════════════════════════════════╗");
  console.log("║              Seed Complete             ║");
  console.log("╠════════════════════════════════════════╣");
  console.log(`║  Inserted : ${String(totalInserted).padEnd(27)}║`);
  console.log(`║  Skipped  : ${String(totalSkipped).padEnd(27)}║`);
  console.log(`║  Patients : ${String(patientIds.length).padEnd(27)}║`);
  console.log(`║  Drugs    : ${String(drugs.length).padEnd(27)}║`);
  console.log("╚════════════════════════════════════════╝");

  await sequelize.close();
  process.exit(0);
}

main().catch((err) => {
  console.error("\n✗ Seeder failed:", err.message);
  console.error(err);
  process.exit(1);
});