import sequelize from "../../database.js";
import User from "../models/User.js";
import DoctorPatientAssignment from "../models/DoctorPatientAssignment.js";

export const getAssignedPatients = async (req, res) => {
  try {
    if (req.user?.role !== "doctor") {
      return res.status(403).json({ message: "Only doctors can access this." });
    }

    const doctorId = req.user.id;

    const [rows] = await sequelize.query(
      `
      SELECT
        dpa.status,
        dpa."createdAt" AS "assignedAt",
        u.id,
        u.email,
        u.role,
        u."isVerified"
      FROM doctor_patient_assignments dpa
      JOIN users u ON u.id = dpa."patientId"
      WHERE dpa."doctorId" = :doctorId
        AND dpa.status = 'active'
      ORDER BY dpa."createdAt" DESC
      `,
      { replacements: { doctorId } }
    );

    return res.json({
      doctorId,
      patients: rows.map((r) => ({
        status: r.status,
        assignedAt: r.assignedAt,
        patient: {
          id: r.id,
          email: r.email,
          role: r.role,
          isVerified: r.isVerified,
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
        ), 0) AS "activeDiagnoses"
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
    };

    return res.json({
      doctorId,
      summary,
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
    if (req.user?.role !== "doctor") {
      return res.status(403).json({ message: "Only doctors can access this." });
    }

    const doctorId = req.user.id;
    const { patientId } = req.body || {};

    if (!patientId) {
      return res.status(400).json({ message: "patientId is required." });
    }

    const patient = await User.findByPk(patientId, { attributes: ["id", "email", "role"] });
    if (!patient || patient.role !== "patient") {
      return res.status(400).json({ message: "Invalid patientId. Must reference a patient user." });
    }

    const [assignment, created] = await DoctorPatientAssignment.findOrCreate({
      where: { doctorId, patientId },
      defaults: { doctorId, patientId, status: "active" },
    });

    if (!created && assignment.status !== "active") {
      await assignment.update({ status: "active" });
    }

    return res.status(created ? 201 : 200).json({
      message: created ? "Patient assigned to doctor." : "Patient already assigned (active).",
      assignment: {
        doctorId,
        patientId,
        status: "active",
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
