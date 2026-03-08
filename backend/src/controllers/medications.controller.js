import Medication from "../models/Medication.js";
import { Op } from "sequelize";

const getPatientId = (req) => req.user?.id || req.user?.sub || null;

export const getAllMedications = async (req, res) => {
  try {
    const patientId = getPatientId(req);
    if (!patientId) return res.status(401).json({ error: "Not authenticated" });

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
    const patientId = getPatientId(req);
    if (!patientId) return res.status(401).json({ error: "Not authenticated" });

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
    const patientId = getPatientId(req);
    if (!patientId) return res.status(401).json({ error: "Not authenticated" });

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

    if (!name || !dosage || !frequency) {
      return res.status(400).json({
        error: "Missing required fields: name, dosage, and frequency are required",
      });
    }

    const medication = await Medication.create({
      patientId,
      name,
      dosage,
      frequency,
      prescribedBy: prescribedBy ?? null,
      doseAmount: doseAmount ?? null,
      doseUnit: doseUnit ?? null,
      scheduleJson: scheduleJson ?? null,
      startDate: startDate ?? null,
      endDate: endDate ?? null,
      notes: notes ?? null,
    });

    return res.status(201).json(medication);
  } catch (error) {
    console.error("Error creating medication:", error);
    return res.status(500).json({ error: "Failed to create medication" });
  }
};

export const updateMedication = async (req, res) => {
  try {
    const patientId = getPatientId(req);
    if (!patientId) return res.status(401).json({ error: "Not authenticated" });

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

    if (!name || !dosage || !frequency) {
      return res.status(400).json({
        error: "Missing required fields: name, dosage, and frequency are required",
      });
    }

    const medication = await Medication.findOne({
      where: { id: req.params.id, patientId },
    });

    if (!medication) return res.status(404).json({ error: "Medication not found" });

    await medication.update({
      name,
      dosage,
      frequency,
      prescribedBy: prescribedBy ?? null,
      doseAmount: doseAmount ?? null,
      doseUnit: doseUnit ?? null,
      scheduleJson: scheduleJson ?? null,
      startDate: startDate ?? null,
      endDate: endDate ?? null,
      notes: notes ?? null,
    });

    return res.json(medication);
  } catch (error) {
    console.error("Error updating medication:", error);
    return res.status(500).json({ error: "Failed to update medication" });
  }
};

export const deleteMedication = async (req, res) => {
  try {
    const patientId = getPatientId(req);
    if (!patientId) return res.status(401).json({ error: "Not authenticated" });

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

export const searchMedications = async (req, res) => {
  try {
    const patientId = getPatientId(req);
    if (!patientId) return res.status(401).json({ error: "Not authenticated" });

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