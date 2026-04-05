import { Op } from "sequelize";
import sequelize from "../../database.js";
import User from "../models/User.js";
import DoctorPatientAssignment from "../models/DoctorPatientAssignment.js";
import PatientProfile from "../models/PatientProfile.js";
import Medication from "../models/Medication.js";
import Diagnosis from "../models/Diagnosis.js";
import Appointment from "../models/Appointment.js";
import CaregiverPatientPermission from "../models/CaregiverPatientPermission.js";
import CaregiverNote from "../models/CaregiverNote.js";
import {
  DOCTOR_APPROVAL_STATUS,
  buildDoctorApprovalBlockedPayload,
  isApprovedDoctorUser,
} from "../lib/doctorApproval.js";
import { calculatePatientUrgency } from "../services/urgencyScoring.service.js";
import { buildFallbackDoctorSummary, buildPrivacyMinimizedDoctorSummaryInput, summarizeDoctorPatientContext } from "../services/clinicalSummary.service.js";

async function resolveUserByIdOrEmail({ id, email }) {
  if (id) {
    return User.findByPk(id, { attributes: ["id", "email", "role", "doctorApprovalStatus", "doctorApprovalNotes", "doctorApprovalRequestedInfoAt"] });
  }

  if (email) {
    return User.findOne({
      where: { email: String(email).toLowerCase().trim() },
      attributes: ["id", "email", "role", "doctorApprovalStatus", "doctorApprovalNotes", "doctorApprovalRequestedInfoAt"],
    });
  }

  return null;
}

async function getPatientDisplayProfiles(patientIds) {
  if (!patientIds.length) return new Map();
  const profiles = await PatientProfile.findAll({
    where: { userId: patientIds },
    attributes: ["userId", "firstName", "lastName"],
  });
  return new Map(profiles.map((profile) => [profile.userId, profile]));
}

async function findOtherDoctorLinkForPatient(patientId, excludeDoctorId = null) {
  const where = {
    patientId,
    status: { [Op.in]: ["pending", "active"] },
  };
  if (excludeDoctorId) {
    where.doctorId = { [Op.ne]: excludeDoctorId };
  }

  return DoctorPatientAssignment.findOne({ where });
}

function blockIfDoctorNotApproved(user) {
  if (user?.role !== "doctor" || isApprovedDoctorUser(user)) {
    return null;
  }

  return buildDoctorApprovalBlockedPayload(user);
}

function buildUrgencySnapshot(patient) {
  return {
    emergencyStatus: !!patient.emergencyStatus,
    emergencyStatusUpdatedAt: patient.emergencyStatusUpdatedAt,
    activeMedicationCount: Number(patient.activeMedicationCount || 0),
    symptomsLast7Days: Number(patient.symptomsLast7Days || 0),
    latestSymptom: patient.latestSymptomName
      ? {
          name: patient.latestSymptomName,
          severity: patient.latestSymptomSeverity,
          loggedAt: patient.latestSymptomLoggedAt,
        }
      : null,
    activeDiagnosisCount: Number(patient.activeDiagnosisCount || 0),
    nextAppointmentAt: patient.nextAppointmentAt,
  };
}

async function persistUrgencyScore({ doctorId, patientId, result, snapshot }) {
  const [rows] = await sequelize.query(
    `
    INSERT INTO patient_urgency_scores
      ("patientId", "doctorId", score, level, "recommendedAction", source, "modelVersion", "patientSnapshot", "calculatedAt", "createdAt", "updatedAt")
    VALUES
      (:patientId, :doctorId, :score, :level, :recommendedAction, 'deterministic', :modelVersion, CAST(:patientSnapshot AS jsonb), NOW(), NOW(), NOW())
    ON CONFLICT ("patientId", "doctorId")
    DO UPDATE SET
      score = EXCLUDED.score,
      level = EXCLUDED.level,
      "recommendedAction" = EXCLUDED."recommendedAction",
      source = EXCLUDED.source,
      "modelVersion" = EXCLUDED."modelVersion",
      "patientSnapshot" = EXCLUDED."patientSnapshot",
      "calculatedAt" = EXCLUDED."calculatedAt",
      "updatedAt" = NOW()
    RETURNING id, score, level, "recommendedAction", "modelVersion", "calculatedAt"
    `,
    {
      replacements: {
        patientId,
        doctorId,
        score: result.score,
        level: result.level,
        recommendedAction: result.recommendedAction,
        modelVersion: result.modelVersion,
        patientSnapshot: JSON.stringify(snapshot || {}),
      },
    }
  );

  const urgencyScore = rows[0];

  await sequelize.query(
    `DELETE FROM patient_urgency_evidence WHERE "urgencyScoreId" = :urgencyScoreId`,
    { replacements: { urgencyScoreId: urgencyScore.id } }
  );

  for (const item of result.evidence || []) {
    await sequelize.query(
      `
      INSERT INTO patient_urgency_evidence
        (id, "urgencyScoreId", code, label, detail, points, severity, "createdAt", "updatedAt")
      VALUES
        (gen_random_uuid(), :urgencyScoreId, :code, :label, :detail, :points, :severity, NOW(), NOW())
      `,
      {
        replacements: {
          urgencyScoreId: urgencyScore.id,
          code: item.code,
          label: item.label,
          detail: item.detail || null,
          points: Number(item.points || 0),
          severity: item.severity || "info",
        },
      }
    );
  }

  return urgencyScore;
}

async function getUrgencyReviewMap(doctorId) {
  const [rows] = await sequelize.query(
    `
    SELECT DISTINCT ON (pus."patientId")
      pus."patientId",
      pur.id,
      pur.status,
      pur.note,
      pur."reviewedAt"
    FROM patient_urgency_reviews pur
    JOIN patient_urgency_scores pus ON pus.id = pur."urgencyScoreId"
    WHERE pur."doctorId" = :doctorId
    ORDER BY pus."patientId", pur."reviewedAt" DESC
    `,
    { replacements: { doctorId } }
  );
  return new Map(rows.map((row) => [row.patientId, row]));
}

async function getUrgencyOverrideMap(doctorId) {
  const [rows] = await sequelize.query(
    `
    SELECT DISTINCT ON (pus."patientId")
      pus."patientId",
      puo.id,
      puo.level,
      puo.score,
      puo.reason,
      puo."overriddenAt",
      puo.active
    FROM patient_urgency_overrides puo
    JOIN patient_urgency_scores pus ON pus.id = puo."urgencyScoreId"
    WHERE puo."doctorId" = :doctorId
      AND puo.active = true
    ORDER BY pus."patientId", puo."overriddenAt" DESC
    `,
    { replacements: { doctorId } }
  );
  return new Map(rows.map((row) => [row.patientId, row]));
}

function decorateUrgencyResult(result, override = null) {
  const effectiveLevel = override?.level || result.level;
  const effectiveScore = override?.score ?? result.score;
  return {
    score: result.score,
    level: result.level,
    reasons: result.reasons || [],
    recommendedAction: result.recommendedAction,
    modelVersion: result.modelVersion,
    evidence: result.evidence || [],
    effectiveScore,
    effectiveLevel,
    override: override
      ? {
          level: override.level,
          score: override.score,
          reason: override.reason,
          overriddenAt: override.overriddenAt,
        }
      : null,
  };
}

export const getAssignedPatients = async (req, res) => {
  try {
    if (req.user?.role !== "doctor") {
      return res.status(403).json({ message: "Only doctors can access this." });
    }

    const doctorId = req.user.id;
    const { search, status, sortBy, order } = req.query;

    let query = `
      SELECT
        dpa.status,
        dpa."createdAt" AS "assignedAt",
        u.id,
        u.email,
        u.role,
        u."isVerified",
        pp."firstName",
        pp."lastName"
      FROM doctor_patient_assignments dpa
      JOIN users u ON u.id = dpa."patientId"
      LEFT JOIN patient_profiles pp ON pp."userId" = u.id
      WHERE dpa."doctorId" = :doctorId
    `;

    const replacements = { doctorId };

    if (status) {
      query += ` AND dpa.status = :status`;
      replacements.status = status;
    } else {
      query += ` AND dpa.status IN ('active', 'pending')`;
    }

    if (search) {
      query += ` AND (u.email ILIKE :search OR pp."firstName" ILIKE :search OR pp."lastName" ILIKE :search)`;
      replacements.search = `%${search}%`;
    }

    const validSortFields = {
      assignedAt: 'dpa."createdAt"',
      firstName: 'pp."firstName"',
      lastName: 'pp."lastName"',
      email: 'u.email'
    };
    const sortField = validSortFields[sortBy] || 'dpa."createdAt"';
    const sortOrder = String(order).toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

    query += ` ORDER BY ${sortField} ${sortOrder}`;

    const [rows] = await sequelize.query(query, { replacements });

    return res.json({
      doctorId,
      count: rows.length,
      patients: rows.map((r) => ({
        status: r.status,
        assignedAt: r.assignedAt,
        patient: {
          id: r.id,
          email: r.email,
          role: r.role,
          isVerified: r.isVerified,
          firstName: r.firstName,
          lastName: r.lastName,
          displayName: [r.firstName, r.lastName].filter(Boolean).join(" ").trim() || r.email,
        },
      })),
    });
  } catch (err) {
    console.error("doctor assigned-patients error:", err);
    return res.status(500).json({
      message: "Server error.",
      debug: process.env.NODE_ENV === "development" ? err.message : undefined,
    });
  }
};

export const getAiUrgencyPatients = async (req, res) => {
  try {
    if (req.user?.role !== "doctor") {
      return res.status(403).json({ message: "Only doctors can access this." });
    }

    const doctorId = req.user.id;

    const [patientsRows] = await sequelize.query(
      `
      WITH assigned AS (
        SELECT
          dpa."patientId" AS id,
          dpa.status,
          dpa."createdAt" AS "assignedAt"
        FROM doctor_patient_assignments dpa
        WHERE dpa."doctorId" = :doctorId
          AND dpa.status = 'active'
      )
      SELECT
        a.id,
        a.status,
        a."assignedAt",
        u.email,
        pp."firstName",
        pp."lastName",
        pp."emergencyStatus",
        pp."emergencyStatusUpdatedAt",
        COALESCE(med.active_count, 0) AS "activeMedicationCount",
        COALESCE(sym.symptoms_7d_count, 0) AS "symptomsLast7Days",
        sym.latest_symptom_name AS "latestSymptomName",
        sym.latest_symptom_severity AS "latestSymptomSeverity",
        sym.latest_symptom_logged_at AS "latestSymptomLoggedAt",
        COALESCE(diag.active_diagnosis_count, 0) AS "activeDiagnosisCount",
        appt.next_appointment_at AS "nextAppointmentAt"
      FROM assigned a
      JOIN users u ON u.id = a.id
      LEFT JOIN patient_profiles pp ON pp."userId" = a.id
      LEFT JOIN LATERAL (
        SELECT COUNT(*)::int AS active_count
        FROM medications m
        WHERE m."patientId" = a.id
          AND (m."endDate" IS NULL OR m."endDate" >= CURRENT_DATE)
      ) med ON true
      LEFT JOIN LATERAL (
        SELECT
          COUNT(*) FILTER (
            WHERE s."loggedAt" >= NOW() - INTERVAL '7 days'
          )::int AS symptoms_7d_count,
          (
            SELECT s2.name
            FROM symptoms s2
            WHERE s2."patientId" = a.id
            ORDER BY s2."loggedAt" DESC, s2."createdAt" DESC
            LIMIT 1
          ) AS latest_symptom_name,
          (
            SELECT s2.severity
            FROM symptoms s2
            WHERE s2."patientId" = a.id
            ORDER BY s2."loggedAt" DESC, s2."createdAt" DESC
            LIMIT 1
          ) AS latest_symptom_severity,
          (
            SELECT s2."loggedAt"
            FROM symptoms s2
            WHERE s2."patientId" = a.id
            ORDER BY s2."loggedAt" DESC, s2."createdAt" DESC
            LIMIT 1
          ) AS latest_symptom_logged_at
        FROM symptoms s
        WHERE s."patientId" = a.id
      ) sym ON true
      LEFT JOIN LATERAL (
        SELECT COUNT(*)::int AS active_diagnosis_count
        FROM diagnoses d
        WHERE d."patientId" = a.id
          AND d.status = 'active'
      ) diag ON true
      LEFT JOIN LATERAL (
        SELECT ap."startsAt" AS next_appointment_at
        FROM appointments ap
        WHERE ap."patientId" = a.id
          AND ap."doctorId" = :doctorId
          AND ap."startsAt" >= NOW()
          AND ap.status = 'scheduled'
        ORDER BY ap."startsAt" ASC
        LIMIT 1
      ) appt ON true
      ORDER BY a."assignedAt" DESC
      `,
      { replacements: { doctorId } }
    );

    const scoredPatients = await Promise.all(
      patientsRows.map(async (patient) => {
        const snapshot = buildUrgencySnapshot(patient);
        const urgency = calculatePatientUrgency(snapshot);
        const persistedScore = await persistUrgencyScore({
          doctorId,
          patientId: patient.id,
          result: urgency,
          snapshot,
        });

        return {
          id: patient.id,
          status: patient.status,
          assignedAt: patient.assignedAt,
          patient: {
            id: patient.id,
            email: patient.email,
            firstName: patient.firstName,
            lastName: patient.lastName,
            displayName: [patient.firstName, patient.lastName].filter(Boolean).join(" ").trim() || patient.email,
          },
          snapshot: {
            ...snapshot,
          },
          urgency,
          urgencyScoreId: persistedScore.id,
          calculatedAt: persistedScore.calculatedAt,
        };
      })
    );

    const reviewMap = await getUrgencyReviewMap(doctorId);
    const overrideMap = await getUrgencyOverrideMap(doctorId);

    const normalized = scoredPatients.map((patient) => ({
      ...patient,
      urgency: decorateUrgencyResult(patient.urgency, overrideMap.get(patient.id)),
      review: reviewMap.get(patient.id) || null,
    }));

    return res.json({
      doctorId,
      count: normalized.length,
      patients: normalized.sort((a, b) => (b.urgency?.effectiveScore || 0) - (a.urgency?.effectiveScore || 0)),
    });
  } catch (err) {
    console.error("doctor urgency error:", err);
    return res.status(500).json({
      message: "Server error.",
      debug: process.env.NODE_ENV === "development" ? err.message : undefined,
    });
  }
};

export const reviewPatientUrgency = async (req, res) => {
  try {
    if (req.user?.role !== "doctor") {
      return res.status(403).json({ message: "Only doctors can access this." });
    }

    const doctorId = req.user.id;
    const { patientId } = req.params;
    const status = String(req.body.status || "reviewed").trim();
    const note = String(req.body.note || "").trim() || null;

    if (!["reviewed", "actioned"].includes(status)) {
      return res.status(400).json({ message: "Invalid review status." });
    }

    const [scoreRows] = await sequelize.query(
      `SELECT id FROM patient_urgency_scores WHERE "patientId" = :patientId AND "doctorId" = :doctorId LIMIT 1`,
      { replacements: { patientId, doctorId } }
    );

    if (!scoreRows.length) {
      return res.status(404).json({ message: "Urgency score not found for this patient." });
    }

    const urgencyScoreId = scoreRows[0].id;
    const [rows] = await sequelize.query(
      `
      INSERT INTO patient_urgency_reviews
        (id, "urgencyScoreId", "doctorId", status, note, "reviewedAt", "createdAt", "updatedAt")
      VALUES
        (gen_random_uuid(), :urgencyScoreId, :doctorId, :status, :note, NOW(), NOW(), NOW())
      RETURNING id, status, note, "reviewedAt"
      `,
      {
        replacements: {
          urgencyScoreId,
          doctorId,
          status,
          note,
        },
      }
    );

    return res.status(201).json({ review: rows[0] });
  } catch (err) {
    console.error("review patient urgency error:", err);
    return res.status(500).json({ message: "Server error." });
  }
};

export const overridePatientUrgency = async (req, res) => {
  try {
    if (req.user?.role !== "doctor") {
      return res.status(403).json({ message: "Only doctors can access this." });
    }

    const doctorId = req.user.id;
    const { patientId } = req.params;
    const level = String(req.body.level || "").trim();
    const score = Number(req.body.score);
    const reason = String(req.body.reason || "").trim();

    if (!["stable", "needs_review", "critical"].includes(level)) {
      return res.status(400).json({ message: "Invalid override level." });
    }
    if (!Number.isFinite(score) || score < 0 || score > 100) {
      return res.status(400).json({ message: "Override score must be between 0 and 100." });
    }
    if (!reason) {
      return res.status(400).json({ message: "Override reason is required." });
    }

    const [scoreRows] = await sequelize.query(
      `SELECT id FROM patient_urgency_scores WHERE "patientId" = :patientId AND "doctorId" = :doctorId LIMIT 1`,
      { replacements: { patientId, doctorId } }
    );

    if (!scoreRows.length) {
      return res.status(404).json({ message: "Urgency score not found for this patient." });
    }

    const urgencyScoreId = scoreRows[0].id;
    await sequelize.query(
      `UPDATE patient_urgency_overrides SET active = false, "updatedAt" = NOW() WHERE "urgencyScoreId" = :urgencyScoreId AND "doctorId" = :doctorId AND active = true`,
      { replacements: { urgencyScoreId, doctorId } }
    );

    const [rows] = await sequelize.query(
      `
      INSERT INTO patient_urgency_overrides
        (id, "urgencyScoreId", "doctorId", level, score, reason, "overriddenAt", active, "createdAt", "updatedAt")
      VALUES
        (gen_random_uuid(), :urgencyScoreId, :doctorId, :level, :score, :reason, NOW(), true, NOW(), NOW())
      RETURNING id, level, score, reason, "overriddenAt", active
      `,
      {
        replacements: {
          urgencyScoreId,
          doctorId,
          level,
          score: Math.round(score),
          reason,
        },
      }
    );

    return res.status(201).json({ override: rows[0] });
  } catch (err) {
    console.error("override patient urgency error:", err);
    return res.status(500).json({ message: "Server error." });
  }
};

export const getDoctorDashboardOverview = async (req, res) => {
  try {
    if (req.user?.role !== "doctor") {
      return res.status(403).json({ message: "Only doctors can access this." });
    }

    const doctorId = req.user.id;

    const [patientsRows] = await sequelize.query(
      `
      WITH assigned AS (
        SELECT
          dpa."patientId" AS id,
          dpa.status,
          dpa."createdAt" AS "assignedAt"
        FROM doctor_patient_assignments dpa
        WHERE dpa."doctorId" = :doctorId
          AND dpa.status = 'active'
      )
      SELECT
        a.id,
        a.status,
        a."assignedAt",
        u.email,
        pp."firstName",
        pp."lastName",
        COALESCE(med.active_count, 0) AS "activeMedicationCount",
        COALESCE(sym.symptoms_7d_count, 0) AS "symptomsLast7Days",
        sym.latest_symptom_name AS "latestSymptomName",
        sym.latest_symptom_severity AS "latestSymptomSeverity",
        sym.latest_symptom_logged_at AS "latestSymptomLoggedAt",
        COALESCE(diag.active_diagnosis_count, 0) AS "activeDiagnosisCount",
        appt.next_appointment_at AS "nextAppointmentAt",
        appt.next_appointment_status AS "nextAppointmentStatus",
        note.last_note_at AS "lastMedicalNoteAt"
      FROM assigned a
      JOIN users u ON u.id = a.id
      LEFT JOIN patient_profiles pp ON pp."userId" = a.id
      LEFT JOIN LATERAL (
        SELECT COUNT(*)::int AS active_count
        FROM medications m
        WHERE m."patientId" = a.id
          AND (m."endDate" IS NULL OR m."endDate" >= CURRENT_DATE)
      ) med ON true
      LEFT JOIN LATERAL (
        SELECT
          COUNT(*) FILTER (
            WHERE s."loggedAt" >= NOW() - INTERVAL '7 days'
          )::int AS symptoms_7d_count,
          (
            SELECT s2.name
            FROM symptoms s2
            WHERE s2."patientId" = a.id
            ORDER BY s2."loggedAt" DESC, s2."createdAt" DESC
            LIMIT 1
          ) AS latest_symptom_name,
          (
            SELECT s2.severity
            FROM symptoms s2
            WHERE s2."patientId" = a.id
            ORDER BY s2."loggedAt" DESC, s2."createdAt" DESC
            LIMIT 1
          ) AS latest_symptom_severity,
          (
            SELECT s2."loggedAt"
            FROM symptoms s2
            WHERE s2."patientId" = a.id
            ORDER BY s2."loggedAt" DESC, s2."createdAt" DESC
            LIMIT 1
          ) AS latest_symptom_logged_at
        FROM symptoms s
        WHERE s."patientId" = a.id
      ) sym ON true
      LEFT JOIN LATERAL (
        SELECT COUNT(*)::int AS active_diagnosis_count
        FROM diagnoses d
        WHERE d."patientId" = a.id
          AND d.status = 'active'
      ) diag ON true
      LEFT JOIN LATERAL (
        SELECT
          ap."startsAt" AS next_appointment_at,
          ap.status AS next_appointment_status
        FROM appointments ap
        WHERE ap."patientId" = a.id
          AND ap."doctorId" = :doctorId
          AND ap."startsAt" >= NOW()
          AND ap.status = 'scheduled'
        ORDER BY ap."startsAt" ASC
        LIMIT 1
      ) appt ON true
      LEFT JOIN LATERAL (
        SELECT MAX(mn."createdAt") AS last_note_at
        FROM medical_notes mn
        WHERE mn."patientId" = a.id
          AND mn."doctorId" = :doctorId
      ) note ON true
      ORDER BY a."assignedAt" DESC
      `,
      { replacements: { doctorId } }
    );

    const [summaryRows] = await sequelize.query(
      `
      WITH assigned AS (
        SELECT dpa."patientId" AS id
        FROM doctor_patient_assignments dpa
        WHERE dpa."doctorId" = :doctorId
          AND dpa.status = 'active'
      )
      SELECT
        COUNT(*)::int AS "totalAssignedPatients",
        COALESCE((
          SELECT COUNT(DISTINCT s."patientId")::int
          FROM symptoms s
          JOIN assigned a ON a.id = s."patientId"
          WHERE s."loggedAt" >= NOW() - INTERVAL '7 days'
        ), 0) AS "patientsWithSymptomsLast7Days",
        COALESCE((
          SELECT COUNT(*)::int
          FROM appointments ap
          JOIN assigned a ON a.id = ap."patientId"
          WHERE ap."doctorId" = :doctorId
            AND ap.status = 'scheduled'
            AND ap."startsAt" >= NOW()
            AND ap."startsAt" < NOW() + INTERVAL '7 days'
        ), 0) AS "upcomingAppointmentsNext7Days",
        COALESCE((
          SELECT COUNT(*)::int
          FROM medical_notes mn
          JOIN assigned a ON a.id = mn."patientId"
          WHERE mn."doctorId" = :doctorId
            AND mn."createdAt" >= NOW() - INTERVAL '7 days'
        ), 0) AS "notesAddedLast7Days",
        COALESCE((
          SELECT COUNT(*)::int
          FROM diagnoses d
          JOIN assigned a ON a.id = d."patientId"
          WHERE d.status = 'active'
        ), 0) AS "activeDiagnoses",
        COALESCE((
          SELECT COUNT(*)::int
          FROM doctor_patient_assignments
          WHERE "doctorId" = :doctorId
            AND status = 'pending'
        ), 0) AS "pendingPatientRequestsCount"
      FROM assigned
      `,
      { replacements: { doctorId } }
    );

    const [activityRows] = await sequelize.query(
      `
      WITH assigned AS (
        SELECT dpa."patientId"
        FROM doctor_patient_assignments dpa
        WHERE dpa."doctorId" = :doctorId
          AND dpa.status = 'active'
      ),
      activity AS (
        SELECT
          'symptom_logged' AS type,
          s.id::text AS "entityId",
          s."patientId",
          s."loggedAt" AS "activityAt",
          jsonb_build_object(
            'name', s.name,
            'severity', s.severity
          ) AS details
        FROM symptoms s
        WHERE s."patientId" IN (SELECT "patientId" FROM assigned)

        UNION ALL

        SELECT
          'medical_note_added' AS type,
          mn.id::text AS "entityId",
          mn."patientId",
          mn."createdAt" AS "activityAt",
          jsonb_build_object(
            'preview', LEFT(mn.note, 120)
          ) AS details
        FROM medical_notes mn
        WHERE mn."doctorId" = :doctorId
          AND mn."patientId" IN (SELECT "patientId" FROM assigned)

        UNION ALL

        SELECT
          'diagnosis_updated' AS type,
          d.id::text AS "entityId",
          d."patientId",
          d."diagnosedAt" AS "activityAt",
          jsonb_build_object(
            'status', d.status,
            'preview', LEFT(d."diagnosisText", 120)
          ) AS details
        FROM diagnoses d
        WHERE d."doctorId" = :doctorId
          AND d."patientId" IN (SELECT "patientId" FROM assigned)

        UNION ALL

        SELECT
          'appointment_scheduled' AS type,
          ap.id::text AS "entityId",
          ap."patientId",
          ap."startsAt" AS "activityAt",
          jsonb_build_object(
            'status', ap.status,
            'location', ap.location,
            'startsAt', ap."startsAt",
            'endsAt', ap."endsAt"
          ) AS details
        FROM appointments ap
        WHERE ap."doctorId" = :doctorId
          AND ap."patientId" IN (SELECT "patientId" FROM assigned)
      )
      SELECT
        a.type,
        a."entityId",
        a."patientId",
        u.email AS "patientEmail",
        pp."firstName" AS "patientFirstName",
        pp."lastName" AS "patientLastName",
        a."activityAt",
        a.details
      FROM activity a
      LEFT JOIN users u ON u.id = a."patientId"
      LEFT JOIN patient_profiles pp ON pp."userId" = a."patientId"
      ORDER BY a."activityAt" DESC
      LIMIT 25
      `,
      { replacements: { doctorId } }
    );

    const summary = summaryRows[0] || {
      totalAssignedPatients: 0,
      patientsWithSymptomsLast7Days: 0,
      upcomingAppointmentsNext7Days: 0,
      notesAddedLast7Days: 0,
      activeDiagnoses: 0,
      pendingPatientRequestsCount: 0,
    };

    const [urgentPatientsRows] = await sequelize.query(
      `
      SELECT
        u.id,
        u.email,
        pp."firstName",
        pp."lastName",
        pp."emergencyStatusUpdatedAt"
      FROM users u
      JOIN doctor_patient_assignments dpa ON dpa."patientId" = u.id
      JOIN patient_profiles pp ON pp."userId" = u.id
      WHERE dpa."doctorId" = :doctorId
        AND dpa.status = 'active'
        AND pp."emergencyStatus" = true
      ORDER BY pp."emergencyStatusUpdatedAt" DESC
      `,
      { replacements: { doctorId } }
    );

    return res.json({
      doctorId,
      summary,
      urgentPatients: urgentPatientsRows.map(p => ({
        id: p.id,
        email: p.email,
        firstName: p.firstName,
        lastName: p.lastName,
        displayName: [p.firstName, p.lastName].filter(Boolean).join(" ").trim() || p.email,
        emergencyStatusUpdatedAt: p.emergencyStatusUpdatedAt,
      })),
      assignedPatients: patientsRows.map((p) => ({
        id: p.id,
        email: p.email,
        status: p.status,
        assignedAt: p.assignedAt,
        profile: {
          firstName: p.firstName,
          lastName: p.lastName,
          displayName:
            [p.firstName, p.lastName].filter(Boolean).join(" ").trim() || p.email,
        },
        snapshot: {
          activeMedicationCount: p.activeMedicationCount,
          symptomsLast7Days: p.symptomsLast7Days,
          latestSymptom: p.latestSymptomName
            ? {
                name: p.latestSymptomName,
                severity: p.latestSymptomSeverity,
                loggedAt: p.latestSymptomLoggedAt,
              }
            : null,
          activeDiagnosisCount: p.activeDiagnosisCount,
          nextAppointmentAt: p.nextAppointmentAt,
          nextAppointmentStatus: p.nextAppointmentStatus,
          lastMedicalNoteAt: p.lastMedicalNoteAt,
        },
      })),
      activityOverview: {
        count: activityRows.length,
        items: activityRows.map((item) => ({
          type: item.type,
          entityId: item.entityId,
          patientId: item.patientId,
          patient: {
            email: item.patientEmail,
            firstName: item.patientFirstName,
            lastName: item.patientLastName,
            displayName:
              [item.patientFirstName, item.patientLastName]
                .filter(Boolean)
                .join(" ")
                .trim() || item.patientEmail,
          },
          activityAt: item.activityAt,
          details: item.details,
        })),
      },
    });
  } catch (err) {
    console.error("doctor dashboard-overview error:", err);
    return res.status(500).json({
      message: "Server error.",
      debug: process.env.NODE_ENV === "development" ? err.message : undefined,
    });
  }
};

export const assignPatientToDoctor = async (req, res) => {
  try {
    const actorId = req.user?.id;
    const actorRole = req.user?.role;
    const { patientId, patientEmail, doctorId, doctorEmail } = req.body || {};

    if (actorRole === "patient") {
      const patient = await User.findByPk(actorId, { attributes: ["id", "email", "role"] });
      const doctor = await resolveUserByIdOrEmail({ id: doctorId, email: doctorEmail });

      if (!doctor) {
        return res.status(400).json({ message: "doctorId or doctorEmail is required." });
      }
      if (doctor.role !== "doctor") {
        return res.status(400).json({ message: "Invalid doctor. Must reference a doctor user." });
      }
      if (doctor.doctorApprovalStatus !== DOCTOR_APPROVAL_STATUS.APPROVED) {
        return res.status(403).json({
          code: "DOCTOR_NOT_AVAILABLE",
          message: "This doctor is not available for linking until approval is complete.",
        });
      }
      if (!patient || patient.role !== "patient") {
        return res.status(400).json({ message: "Invalid patient. Must reference a patient user." });
      }

      // Cancel other pending requests so there are no competing pending entries.
      // Active links are intentionally left intact: the current doctor stays linked
      // until the new doctor explicitly approves, at which point the old link is
      // inactivated inside reviewDoctorLinkRequest.
      const replacedPendingCount = await DoctorPatientAssignment.update(
        { status: "inactive" },
        {
          where: {
            patientId: patient.id,
            doctorId: { [Op.ne]: doctor.id },
            status: "pending",
          },
        }
      ).then(([affectedCount]) => affectedCount || 0);

      const [assignment, created] = await DoctorPatientAssignment.findOrCreate({
        where: { doctorId: doctor.id, patientId: patient.id },
        defaults: { doctorId: doctor.id, patientId: patient.id, status: "pending" },
      });

      if (!created && ["rejected", "inactive"].includes(assignment.status)) {
        await assignment.update({ status: "pending" });
      }

      return res.status(created ? 201 : 200).json({
        message:
          assignment.status === "active"
            ? "Doctor already linked."
            : replacedPendingCount > 0
              ? "Doctor link request sent. Previous pending request was cancelled."
              : "Doctor link request sent.",
        assignment: {
          doctorId: doctor.id,
          patientId: patient.id,
          status: assignment.status,
        },
        replacedPendingCount,
        doctor: {
          id: doctor.id,
          email: doctor.email,
        },
        patient: {
          id: patient.id,
          email: patient.email,
        },
      });
    }

    if (actorRole !== "doctor") {
      return res.status(403).json({ message: "Only doctors or patients can create doctor-patient links." });
    }

    const doctor = await User.findByPk(actorId, { attributes: ["id", "email", "role", "doctorApprovalStatus", "doctorApprovalNotes", "doctorApprovalRequestedInfoAt"] });
    const patient = await resolveUserByIdOrEmail({ id: patientId, email: patientEmail });

    if (!patient) {
      return res.status(400).json({ message: "patientId or patientEmail is required." });
    }
    if (!patient || patient.role !== "patient") {
      return res.status(400).json({ message: "Invalid patient. Must reference a patient user." });
    }
    if (!doctor || doctor.role !== "doctor") {
      return res.status(400).json({ message: "Invalid doctor. Must reference a doctor user." });
    }
    const blocked = blockIfDoctorNotApproved(doctor);
    if (blocked) {
      return res.status(blocked.status).json(blocked.body);
    }

    const assignment = await DoctorPatientAssignment.findOne({
      where: { doctorId: doctor.id, patientId: patient.id },
    });
    if (!assignment) {
      return res.status(404).json({ message: "No doctor request found for this patient." });
    }

    const conflictingLink = await findOtherDoctorLinkForPatient(patient.id, doctor.id);
    if (conflictingLink) {
      return res.status(409).json({
        message: "Patient already has another doctor link or pending doctor request.",
      });
    }

    await assignment.update({ status: "active" });

    return res.status(200).json({
      message: "Doctor request approved.",
      assignment: {
        doctorId: doctor.id,
        patientId: patient.id,
        status: "active",
      },
      doctor: {
        id: doctor.id,
        email: doctor.email,
      },
      patient: {
        id: patient.id,
        email: patient.email,
      },
    });
  } catch (err) {
    console.error("doctor assign-patient error:", err);
    return res.status(500).json({
      message: "Server error.",
      debug: process.env.NODE_ENV === "development" ? err.message : undefined,
    });
  }
};

export const getDoctorLinkRequests = async (req, res) => {
  try {
    if (req.user?.role === "doctor") {
      const links = await DoctorPatientAssignment.findAll({
        where: { doctorId: req.user.id, status: "pending" },
        order: [["createdAt", "DESC"]],
      });
      const patientIds = links.map((link) => link.patientId);
      const patients = patientIds.length
        ? await User.findAll({
            where: { id: patientIds },
            attributes: ["id", "email", "role"],
          })
        : [];
      const patientMap = new Map(patients.map((patient) => [patient.id, patient]));
      const profileMap = await getPatientDisplayProfiles(patientIds);

      return res.json({
        requests: links.map((link) => {
          const patient = patientMap.get(link.patientId);
          const profile = profileMap.get(link.patientId);
          return {
            patientId: link.patientId,
            doctorId: link.doctorId,
            status: link.status,
            createdAt: link.createdAt,
            patient: patient
              ? {
                  id: patient.id,
                  email: patient.email,
                  role: patient.role,
                  firstName: profile?.firstName || null,
                  lastName: profile?.lastName || null,
                  displayName:
                    [profile?.firstName, profile?.lastName].filter(Boolean).join(" ").trim() ||
                    patient.email,
                }
              : null,
          };
        }),
      });
    }

    if (req.user?.role === "patient") {
      const includeDecisions = String(req.query?.includeDecisions || "false").toLowerCase() === "true";
      const statuses = includeDecisions ? ["pending", "active", "rejected"] : ["pending"];
      const links = await DoctorPatientAssignment.findAll({
        where: {
          patientId: req.user.id,
          status: { [Op.in]: statuses },
        },
        order: [[includeDecisions ? "updatedAt" : "createdAt", "DESC"]],
      });
      const doctorIds = links.map((link) => link.doctorId);
      const doctors = doctorIds.length
        ? await User.findAll({
            where: { id: doctorIds, doctorApprovalStatus: DOCTOR_APPROVAL_STATUS.APPROVED },
            attributes: ["id", "email", "role", "doctorApprovalStatus"],
          })
        : [];
      const profileMap = await getPatientDisplayProfiles(doctorIds);
      const doctorMap = new Map(doctors.map((doctor) => [doctor.id, doctor]));

      return res.json({
        requests: links.map((link) => {
          const doctor = doctorMap.get(link.doctorId);
          const profile = profileMap.get(link.doctorId);
          return {
            doctorId: link.doctorId,
            patientId: link.patientId,
            status: link.status,
            createdAt: link.createdAt,
            updatedAt: link.updatedAt,
            doctor: doctor
              ? {
                  id: doctor.id,
                  email: doctor.email,
                  role: doctor.role,
                  firstName: profile?.firstName || null,
                  lastName: profile?.lastName || null,
                  displayName:
                    [profile?.firstName, profile?.lastName].filter(Boolean).join(" ").trim() ||
                    doctor.email,
                }
              : null,
          };
        }),
      });
    }

    return res.status(403).json({ message: "Only doctors or patients can view doctor link requests." });
  } catch (err) {
    console.error("doctor link requests error:", err);
    return res.status(500).json({ message: "Server error." });
  }
};

export const reviewDoctorLinkRequest = async (req, res) => {
  try {
    if (req.user?.role !== "doctor") {
      return res.status(403).json({ message: "Only doctors can review doctor link requests." });
    }

    const { patientId } = req.params;
    const decision = String(req.body?.status || "").toLowerCase().trim();
    if (!["active", "rejected"].includes(decision)) {
      return res.status(400).json({ message: "status must be active or rejected." });
    }

    const assignment = await DoctorPatientAssignment.findOne({
      where: { doctorId: req.user.id, patientId, status: "pending" },
    });
    if (!assignment) {
      return res.status(404).json({ message: "Pending doctor request not found." });
    }

    if (decision === "active") {
      // Inactivate any existing active doctor link for this patient so the newly
      // approved doctor becomes the sole active link.
      await DoctorPatientAssignment.update(
        { status: "inactive" },
        {
          where: {
            patientId,
            doctorId: { [Op.ne]: req.user.id },
            status: "active",
          },
        }
      );
    }

    await assignment.update({ status: decision });
    return res.json({
      message: decision === "active" ? "Doctor request approved." : "Doctor request rejected.",
      assignment,
    });
  } catch (err) {
    console.error("doctor review request error:", err);
    return res.status(500).json({ message: "Server error." });
  }
};

export const getMyDoctors = async (req, res) => {
  try {
    if (req.user?.role !== "patient") {
      return res.status(403).json({ message: "Only patients can access this." });
    }

    const patientId = req.user.id;
    const links = await DoctorPatientAssignment.findAll({
      where: { patientId, status: "active" },
      order: [["createdAt", "DESC"]],
    });

    const doctorIds = links.map((link) => link.doctorId);
    const doctors = doctorIds.length
      ? await User.findAll({
          where: { id: doctorIds },
          attributes: ["id", "email", "role", "isVerified", "doctorApprovalStatus"],
        })
      : [];
    const profiles = doctorIds.length
      ? await PatientProfile.findAll({
          where: { userId: doctorIds },
          attributes: ["userId", "firstName", "lastName"],
        })
      : [];

    const doctorMap = new Map(doctors.map((doctor) => [doctor.id, doctor]));
    const profileMap = new Map(profiles.map((profile) => [profile.userId, profile]));

    return res.json({
      patientId,
      doctors: links.map((link) => {
        const doctor = doctorMap.get(link.doctorId);
        const profile = profileMap.get(link.doctorId);
        return {
          status: link.status,
          assignedAt: link.createdAt,
          doctor: doctor
            ? {
                id: doctor.id,
                email: doctor.email,
                role: doctor.role,
                isVerified: doctor.isVerified,
                doctorApprovalStatus: doctor.doctorApprovalStatus,
                firstName: profile?.firstName || null,
                lastName: profile?.lastName || null,
                displayName:
                  [profile?.firstName, profile?.lastName].filter(Boolean).join(" ").trim() ||
                  doctor.email,
              }
            : {
                id: link.doctorId,
                email: null,
                role: "doctor",
                isVerified: false,
                firstName: null,
                lastName: null,
                displayName: "Doctor",
              },
        };
      }),
    });
  } catch (err) {
    console.error("patient linked-doctors error:", err);
    return res.status(500).json({
      message: "Server error.",
      debug: process.env.NODE_ENV === "development" ? err.message : undefined,
    });
  }
};

export const getDoctorProfile = async (req, res) => {
  try {
    const doctorId = req.user.id;
    const user = await User.findByPk(doctorId, {
      attributes: ["id", "email", "role", "isVerified", "doctorApprovalStatus"],
      include: [{
        model: PatientProfile,
        as: "patientProfile",
      }]
    });

    if (!user) return res.status(404).json({ message: "Doctor not found." });

    return res.json(user);
  } catch (err) {
    console.error("get-doctor-profile error:", err);
    return res.status(500).json({ message: "Server error." });
  }
};

export const getPatientOverview = async (req, res) => {
  try {
    const doctorId = req.user.id;
    const { patientId } = req.params;

    const assignment = await DoctorPatientAssignment.findOne({
      where: { doctorId, patientId, status: "active" }
    });
    if (!assignment) return res.status(403).json({ message: "Access denied or patient not assigned." });

    const patient = await User.findByPk(patientId, {
      attributes: ["id", "email", "role"],
      include: [
        { model: PatientProfile, as: "patientProfile" },
        { 
          model: Medication, 
          as: "medications",
          where: { [Op.or]: [{ endDate: null }, { endDate: { [Op.gte]: new Date() } }] },
          required: false
        },
        { model: Diagnosis, as: "diagnoses", where: { status: "active" }, required: false },
        { model: Appointment, as: "appointmentsAsPatient", where: { doctorId, startsAt: { [Op.gte]: new Date() } }, limit: 5, required: false }
      ]
    });

    const caregiverLinks = await CaregiverPatientPermission.findAll({
      where: { patientId, status: "active" },
      order: [["createdAt", "DESC"]],
    });

    const caregiverIds = caregiverLinks.map((link) => link.caregiverId);
    const caregivers = caregiverIds.length
      ? await User.findAll({
          where: { id: { [Op.in]: caregiverIds } },
          attributes: ["id", "email", "role"],
        })
      : [];
    const caregiverProfiles = caregiverIds.length
      ? await PatientProfile.findAll({
          where: { userId: { [Op.in]: caregiverIds } },
          attributes: ["userId", "firstName", "lastName"],
        })
      : [];
    const caregiverNotes = await CaregiverNote.findAll({
      where: { patientId },
      order: [["updatedAt", "DESC"]],
      limit: 8,
    });

    const caregiverMap = new Map(caregivers.map((caregiver) => [caregiver.id, caregiver]));
    const caregiverProfileMap = new Map(caregiverProfiles.map((profile) => [profile.userId, profile]));

    const caregiverNotesWithAuthors = caregiverNotes.map((note) => {
      const caregiver = caregiverMap.get(note.caregiverId) || null;
      const profile = caregiverProfileMap.get(note.caregiverId) || null;
      return {
        id: note.id,
        note: note.note,
        createdAt: note.createdAt,
        updatedAt: note.updatedAt,
        caregiverId: note.caregiverId,
        caregiver: caregiver
          ? {
              id: caregiver.id,
              email: caregiver.email,
              role: caregiver.role,
              firstName: profile?.firstName || null,
              lastName: profile?.lastName || null,
              displayName:
                [profile?.firstName, profile?.lastName].filter(Boolean).join(" ").trim() ||
                caregiver.email,
            }
          : null,
      };
    });

    const payload = patient.toJSON();
    payload.caregivers = caregiverLinks.map((link) => {
      const caregiver = caregiverMap.get(link.caregiverId) || null;
      const profile = caregiverProfileMap.get(link.caregiverId) || null;
      return {
        caregiverId: link.caregiverId,
        patientId: link.patientId,
        status: link.status,
        createdAt: link.createdAt,
        caregiver: caregiver
          ? {
              id: caregiver.id,
              email: caregiver.email,
              role: caregiver.role,
              firstName: profile?.firstName || null,
              lastName: profile?.lastName || null,
              displayName:
                [profile?.firstName, profile?.lastName].filter(Boolean).join(" ").trim() ||
                caregiver.email,
            }
          : null,
        permissions: {
          canViewMedications: link.canViewMedications,
          canViewSymptoms: link.canViewSymptoms,
          canViewAppointments: link.canViewAppointments,
          canMessageDoctor: link.canMessageDoctor,
          canReceiveReminders: link.canReceiveReminders,
        },
      };
    });
    payload.caregiverNotes = caregiverNotesWithAuthors;

    return res.json(payload);
  } catch (err) {
    console.error("get-patient-overview error:", err);
    return res.status(500).json({ message: "Server error." });
  }
};

export const getPatientTimeline = async (req, res) => {
  try {
    const doctorId = req.user.id;
    const { patientId } = req.params;

    const assignment = await DoctorPatientAssignment.findOne({
      where: { doctorId, patientId, status: "active" }
    });
    if (!assignment) return res.status(403).json({ message: "Access denied or patient not assigned." });

    const [events] = await sequelize.query(`
      SELECT 'symptom' as type, id, name as title, severity::text as detail, "loggedAt" as "timestamp"
      FROM symptoms WHERE "patientId" = :patientId
      UNION ALL
      SELECT 'note' as type, id, 'Medical Note' as title, LEFT(note, 100) as detail, "createdAt" as "timestamp"
      FROM medical_notes WHERE "patientId" = :patientId AND "doctorId" = :doctorId
      UNION ALL
      SELECT 'appointment' as type, id, 'Appointment' as title, status::text as detail, "startsAt" as "timestamp"
      FROM appointments WHERE "patientId" = :patientId AND "doctorId" = :doctorId
      UNION ALL
      SELECT 'diagnosis' as type, id, 'Diagnosis' as title, "diagnosisText" as detail, "diagnosedAt" as "timestamp"
      FROM diagnoses WHERE "patientId" = :patientId
      ORDER BY "timestamp" DESC
      LIMIT 50
    `, { replacements: { patientId, doctorId } });

    return res.json({ patientId, events });
  } catch (err) {
    console.error("get-patient-timeline error:", err);
    return res.status(500).json({ message: "Server error." });
  }
};

export const getPatientActivity = async (req, res) => {
  return getPatientTimeline(req, res);
};

export const getPatientUpdates = async (req, res) => {
  try {
    const doctorId = req.user.id;
    const { patientId } = req.params;

    const assignment = await DoctorPatientAssignment.findOne({
      where: { doctorId, patientId, status: "active" }
    });
    if (!assignment) return res.status(403).json({ message: "Access denied or patient not assigned." });

    const [updates] = await sequelize.query(`
      SELECT 'medication' as type, id, name as title, 'Updated' as detail, "updatedAt" as "timestamp"
      FROM medications WHERE "patientId" = :patientId AND "updatedAt" >= NOW() - INTERVAL '7 days'
      UNION ALL
      SELECT 'symptom' as type, id, name as title, 'New Log' as detail, "createdAt" as "timestamp"
      FROM symptoms WHERE "patientId" = :patientId AND "createdAt" >= NOW() - INTERVAL '7 days'
      ORDER BY "timestamp" DESC
      LIMIT 20
    `, { replacements: { patientId } });

    return res.json({ patientId, updates });
  } catch (err) {
    console.error("get-patient-updates error:", err);
    return res.status(500).json({ message: "Server error." });
  }
};

export const getPatientAiSummary = async (req, res) => {
  try {
    const doctorId = req.user.id;
    const { patientId } = req.params;

    const assignment = await DoctorPatientAssignment.findOne({
      where: { doctorId, patientId, status: "active" }
    });
    if (!assignment) return res.status(403).json({ message: "Access denied or patient not assigned." });

    const patient = await User.findByPk(patientId, {
      attributes: ["id", "email", "role"],
      include: [
        { model: PatientProfile, as: "patientProfile" },
        {
          model: Medication,
          as: "medications",
          where: { [Op.or]: [{ endDate: null }, { endDate: { [Op.gte]: new Date() } }] },
          required: false
        },
        { model: Diagnosis, as: "diagnoses", where: { status: "active" }, required: false },
        { model: Appointment, as: "appointmentsAsPatient", where: { doctorId, startsAt: { [Op.gte]: new Date(Date.now() - 1000 * 60 * 60 * 24 * 14) } }, limit: 8, required: false }
      ]
    });

    const caregiverLinks = await CaregiverPatientPermission.findAll({
      where: { patientId, status: "active" },
      order: [["createdAt", "DESC"]],
    });

    const caregiverIds = caregiverLinks.map((link) => link.caregiverId);
    const caregiverNotes = await CaregiverNote.findAll({
      where: { patientId },
      order: [["updatedAt", "DESC"]],
      limit: 8,
    });

    const payload = patient.toJSON();
    payload.caregivers = caregiverLinks.map((link) => ({
      caregiverId: link.caregiverId,
      permissions: {
        canViewMedications: link.canViewMedications,
        canViewSymptoms: link.canViewSymptoms,
        canViewAppointments: link.canViewAppointments,
        canMessageDoctor: link.canMessageDoctor,
        canReceiveReminders: link.canReceiveReminders,
      },
    }));
    payload.caregiverNotes = caregiverNotes.map((note) => ({
      note: note.note,
      createdAt: note.createdAt,
      updatedAt: note.updatedAt,
    }));

    const [timelineRows] = await sequelize.query(`
      SELECT 'symptom' as type, id, name as title, severity::text as detail, "loggedAt" as "timestamp"
      FROM symptoms WHERE "patientId" = :patientId
      UNION ALL
      SELECT 'note' as type, id, 'Medical Note' as title, LEFT(note, 100) as detail, "createdAt" as "timestamp"
      FROM medical_notes WHERE "patientId" = :patientId AND "doctorId" = :doctorId
      UNION ALL
      SELECT 'appointment' as type, id, 'Appointment' as title, status::text as detail, "startsAt" as "timestamp"
      FROM appointments WHERE "patientId" = :patientId AND "doctorId" = :doctorId
      UNION ALL
      SELECT 'diagnosis' as type, id, 'Diagnosis' as title, "diagnosisText" as detail, "diagnosedAt" as "timestamp"
      FROM diagnoses WHERE "patientId" = :patientId
      ORDER BY "timestamp" DESC
      LIMIT 20
    `, { replacements: { patientId, doctorId } });

    const summaryInput = buildPrivacyMinimizedDoctorSummaryInput({
      overview: payload,
      timeline: timelineRows,
    });
    let summary;
    let source = "openrouter";
    try {
      summary = await summarizeDoctorPatientContext(summaryInput);
    } catch (err) {
      console.warn("get-patient-ai-summary fallback:", err.message);
      summary = buildFallbackDoctorSummary(summaryInput);
      source = "fallback";
    }

    return res.json({
      patientId,
      summary,
      inputPreview: summaryInput,
      source,
      note: "AI summary uses a privacy-minimized clinical snapshot and does not replace clinical judgment.",
    });
  } catch (err) {
    console.error("get-patient-ai-summary error:", err);
    return res.status(500).json({ message: "Server error." });
  }
};
