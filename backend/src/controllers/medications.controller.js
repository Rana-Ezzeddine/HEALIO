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

// Get all medications for the authenticated patient
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

// Get single medication by ID (must belong to authenticated patient)
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

// Create new medication for the authenticated patient
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
      startDate,
      endDate,
      notes,
    } = req.body;

    const cleanName = cleanString(name);
    const cleanDosage = cleanString(dosage);
    const cleanFrequency = cleanString(frequency);

    if (!cleanName || !cleanDosage || !cleanFrequency) {
      return res.status(400).json({
        error: "Missing required fields: name, dosage, and frequency are required",
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

// Update medication (must belong to authenticated patient)
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
      startDate,
      endDate,
      notes,
    } = req.body;

    const cleanName = cleanString(name);
    const cleanDosage = cleanString(dosage);
    const cleanFrequency = cleanString(frequency);

    if (!cleanName || !cleanDosage || !cleanFrequency) {
      return res.status(400).json({
        error: "Missing required fields: name, dosage, and frequency are required",
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

// Delete medication (must belong to authenticated patient)
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

// Search medications for the authenticated patient
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
