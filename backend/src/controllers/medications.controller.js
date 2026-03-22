import Medication from "../models/Medication.js";
import { Op } from "sequelize";
import { CaregiverPatientPermission } from "../models/index.js";

const getAuthUserId = (req) => req.user?.id || req.user?.sub || null;

const resolveMedicationPatientId = async (req) => {
  const authUserId = getAuthUserId(req);
  const role = req.user?.role;

  if (!authUserId) {
    return { error: "Not authenticated", status: 401 };
  }

  if (role === "patient") {
    return { patientId: authUserId };
  }

  if (role === "caregiver") {
    const requestedPatientId =
      req.query?.patientId || req.body?.patientId || req.params?.patientId || null;

    if (requestedPatientId) {
      const permission = await CaregiverPatientPermission.findOne({
        where: {
          caregiverId: authUserId,
          patientId: requestedPatientId,
          canViewMedications: true,
        },
      });

      if (!permission) {
        return { error: "Not authorized for this patient's medications", status: 403 };
      }

      return { patientId: requestedPatientId };
    }

    const permissions = await CaregiverPatientPermission.findAll({
      where: {
        caregiverId: authUserId,
        canViewMedications: true,
      },
      order: [["createdAt", "ASC"]],
    });

    if (!permissions.length) {
      return { error: "No patient medication access found for this caregiver", status: 403 };
    }

    if (permissions.length > 1) {
      return {
        error: "Multiple linked patients found. Please provide patientId.",
        status: 400,
      };
    }

    return { patientId: permissions[0].patientId };
  }

  return { error: "Forbidden", status: 403 };
};
const cleanString = (v) => (typeof v === "string" ? v.trim() : v);
const nullIfEmpty = (v) => {
  if (v == null) return null;
  if (typeof v === "string") {
    const s = v.trim();
    return s.length ? s : null;
  }
  return v;
};
const ADHERENCE_STATUSES = new Set(["taken", "missed", "skipped", "delayed"]);

const normalizeReminderLeadMinutes = (value) => {
  if (value == null || value === "") return 30;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0 || parsed > 1440) {
    return null;
  }
  return parsed;
};

const normalizeAdherenceHistory = (value) => {
  if (value == null) return [];
  if (!Array.isArray(value)) return null;

  const normalized = [];
  for (const item of value) {
    const status = cleanString(item?.status)?.toLowerCase();
    const scheduledFor = cleanString(item?.scheduledFor);
    const recordedAt = cleanString(item?.recordedAt) || new Date().toISOString();
    const notes = nullIfEmpty(item?.notes);
    const delayMinutes =
      item?.delayMinutes == null || item?.delayMinutes === ""
        ? null
        : Number(item.delayMinutes);

    if (!status || !ADHERENCE_STATUSES.has(status) || !scheduledFor) {
      return null;
    }

    normalized.push({
      status,
      scheduledFor,
      recordedAt,
      notes,
      delayMinutes:
        delayMinutes == null || (Number.isInteger(delayMinutes) && delayMinutes >= 0)
          ? delayMinutes
          : null,
    });
  }

  return normalized;
};

export const getAllMedications = async (req, res) => {
  try {
    const resolved = await resolveMedicationPatientId(req);
    if (resolved.error) {
      return res.status(resolved.status).json({ error: resolved.error });
    }
    const { patientId } = resolved;

    const medications = await Medication.findAll({
      where: { patientId },
      order: [["createdAt", "DESC"]],
    });

    return res.json(medications);
  } catch (error) {
    console.error("Error fetching medications:", error);
    return res.status(500).json({ error: "Failed to fetch medications" });
  }
};

export const getMedicationById = async (req, res) => {
  try {
    const resolved = await resolveMedicationPatientId(req);
    if (resolved.error) {
      return res.status(resolved.status).json({ error: resolved.error });
    }
    const { patientId } = resolved;

    const medication = await Medication.findOne({
      where: { id: req.params.id, patientId },
    });

    if (!medication) return res.status(404).json({ error: "Medication not found" });

    return res.json(medication);
  } catch (error) {
    console.error("Error fetching medication:", error);
    return res.status(500).json({ error: "Failed to fetch medication" });
  }
};

export const createMedication = async (req, res) => {
  try {
    const resolved = await resolveMedicationPatientId(req);
    if (resolved.error) {
      return res.status(resolved.status).json({ error: resolved.error });
    }
    const { patientId } = resolved;

    const {
      name,
      dosage,
      frequency,
      prescribedBy,
      doseAmount,
      doseUnit,
      scheduleJson,
      adherenceHistory,
      reminderEnabled,
      reminderLeadMinutes,
      startDate,
      endDate,
      notes,
    } = req.body;

    const cleanName = cleanString(name);
    const cleanDosage = cleanString(dosage);
    const cleanFrequency = cleanString(frequency);
    const cleanAdherenceHistory = normalizeAdherenceHistory(adherenceHistory);
    const cleanReminderLeadMinutes = normalizeReminderLeadMinutes(reminderLeadMinutes);

    if (!cleanName || !cleanDosage || !cleanFrequency) {
      return res.status(400).json({
        error: "Missing required fields: name, dosage, and frequency are required",
      });
    }
    if (cleanAdherenceHistory === null) {
      return res.status(400).json({
        error: "adherenceHistory must be an array of valid medication status entries",
      });
    }
    if (cleanReminderLeadMinutes === null) {
      return res.status(400).json({
        error: "reminderLeadMinutes must be an integer between 0 and 1440",
      });
    }

    const medication = await Medication.create({
      patientId,
      name: cleanName,
      dosage: cleanDosage,
      frequency: cleanFrequency,
      prescribedBy: nullIfEmpty(prescribedBy),
      doseAmount: doseAmount ?? null,
      doseUnit: nullIfEmpty(doseUnit),
      scheduleJson: scheduleJson ?? null,
      adherenceHistory: cleanAdherenceHistory,
      reminderEnabled: reminderEnabled !== false,
      reminderLeadMinutes: cleanReminderLeadMinutes,
      startDate: nullIfEmpty(startDate),
      endDate: nullIfEmpty(endDate),
      notes: nullIfEmpty(notes),
    });

    return res.status(201).json(medication);
  } catch (error) {
    console.error("Error creating medication:", error);
    return res.status(500).json({
      error: "Failed to create medication",
      details: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

export const updateMedication = async (req, res) => {
  try {
    const resolved = await resolveMedicationPatientId(req);
    if (resolved.error) {
      return res.status(resolved.status).json({ error: resolved.error });
    }
    const { patientId } = resolved;

    const {
      name,
      dosage,
      frequency,
      prescribedBy,
      doseAmount,
      doseUnit,
      scheduleJson,
      adherenceHistory,
      reminderEnabled,
      reminderLeadMinutes,
      startDate,
      endDate,
      notes,
    } = req.body;

    const cleanName = cleanString(name);
    const cleanDosage = cleanString(dosage);
    const cleanFrequency = cleanString(frequency);
    const cleanAdherenceHistory = normalizeAdherenceHistory(adherenceHistory);
    const cleanReminderLeadMinutes = normalizeReminderLeadMinutes(reminderLeadMinutes);

    if (!cleanName || !cleanDosage || !cleanFrequency) {
      return res.status(400).json({
        error: "Missing required fields: name, dosage, and frequency are required",
      });
    }
    if (cleanAdherenceHistory === null) {
      return res.status(400).json({
        error: "adherenceHistory must be an array of valid medication status entries",
      });
    }
    if (cleanReminderLeadMinutes === null) {
      return res.status(400).json({
        error: "reminderLeadMinutes must be an integer between 0 and 1440",
      });
    }

    const medication = await Medication.findOne({
      where: { id: req.params.id, patientId },
    });

    if (!medication) return res.status(404).json({ error: "Medication not found" });

    await medication.update({
      name: cleanName,
      dosage: cleanDosage,
      frequency: cleanFrequency,
      prescribedBy: nullIfEmpty(prescribedBy),
      doseAmount: doseAmount ?? null,
      doseUnit: nullIfEmpty(doseUnit),
      scheduleJson: scheduleJson ?? null,
      adherenceHistory: cleanAdherenceHistory,
      reminderEnabled: reminderEnabled !== false,
      reminderLeadMinutes: cleanReminderLeadMinutes,
      startDate: nullIfEmpty(startDate),
      endDate: nullIfEmpty(endDate),
      notes: nullIfEmpty(notes),
    });

    return res.json(medication);
  } catch (error) {
    console.error("Error updating medication:", error);
    return res.status(500).json({
      error: "Failed to update medication",
      details: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

export const deleteMedication = async (req, res) => {
  try {
    const resolved = await resolveMedicationPatientId(req);
    if (resolved.error) {
      return res.status(resolved.status).json({ error: resolved.error });
    }
    const { patientId } = resolved;

    const medication = await Medication.findOne({
      where: { id: req.params.id, patientId },
    });

    if (!medication) return res.status(404).json({ error: "Medication not found" });

    await medication.destroy();
    return res.status(204).send();
  } catch (error) {
    console.error("Error deleting medication:", error);
    return res.status(500).json({ error: "Failed to delete medication" });
  }
};

export const logMedicationAdherence = async (req, res) => {
  try {
    const resolved = await resolveMedicationPatientId(req);
    if (resolved.error) {
      return res.status(resolved.status).json({ error: resolved.error });
    }
    const { patientId } = resolved;

    const medication = await Medication.findOne({
      where: { id: req.params.id, patientId },
    });

    if (!medication) return res.status(404).json({ error: "Medication not found" });

    const status = cleanString(req.body?.status)?.toLowerCase();
    const scheduledFor = cleanString(req.body?.scheduledFor);
    const notes = nullIfEmpty(req.body?.notes);
    const delayMinutes =
      req.body?.delayMinutes == null || req.body?.delayMinutes === ""
        ? null
        : Number(req.body.delayMinutes);

    if (!status || !ADHERENCE_STATUSES.has(status)) {
      return res.status(400).json({
        error: "status must be one of taken, missed, skipped, or delayed",
      });
    }

    if (!scheduledFor) {
      return res.status(400).json({ error: "scheduledFor is required" });
    }

    if (
      delayMinutes != null &&
      (!Number.isInteger(delayMinutes) || delayMinutes < 0 || status !== "delayed")
    ) {
      return res.status(400).json({
        error: "delayMinutes must be a non-negative integer when status is delayed",
      });
    }

    const currentHistory = Array.isArray(medication.adherenceHistory)
      ? medication.adherenceHistory
      : [];

    const nextEntry = {
      status,
      scheduledFor,
      recordedAt: new Date().toISOString(),
      notes,
      delayMinutes: status === "delayed" ? delayMinutes ?? 0 : null,
    };

    await medication.update({
      adherenceHistory: [nextEntry, ...currentHistory].slice(0, 100),
    });

    return res.json(medication);
  } catch (error) {
    console.error("Error logging medication adherence:", error);
    return res.status(500).json({ error: "Failed to log medication adherence" });
  }
};

export const searchMedications = async (req, res) => {
  try {
    const resolved = await resolveMedicationPatientId(req);
    if (resolved.error) {
      return res.status(resolved.status).json({ error: resolved.error });
    }
    const { patientId } = resolved;

    const { query } = req.params;

    const medications = await Medication.findAll({
      where: {
        patientId,
        [Op.or]: [
          { name: { [Op.iLike]: `%${query}%` } },
          { prescribedBy: { [Op.iLike]: `%${query}%` } },
          { notes: { [Op.iLike]: `%${query}%` } },
        ],
      },
      order: [["createdAt", "DESC"]],
    });

    return res.json(medications);
  } catch (error) {
    console.error("Error searching medications:", error);
    return res.status(500).json({ error: "Failed to search medications" });
  }
};
