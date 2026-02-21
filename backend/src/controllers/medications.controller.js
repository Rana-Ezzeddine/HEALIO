import Medication from '../models/Medication.js';
import { Op } from 'sequelize';

// Get all medications
export const getAllMedications = async (req, res) => {
  try {
    const medications = await Medication.findAll({
      order: [['createdAt', 'DESC']]
    });

    res.json(medications);
  } catch (error) {
    console.error('Error fetching medications:', error);
    res.status(500).json({ error: 'Failed to fetch medications' });
  }
};

// Get single medication by ID
export const getMedicationById = async (req, res) => {
  try {
    const medication = await Medication.findByPk(req.params.id);

    if (!medication) {
      return res.status(404).json({ error: 'Medication not found' });
    }

    res.json(medication);
  } catch (error) {
    console.error('Error fetching medication:', error);
    res.status(500).json({ error: 'Failed to fetch medication' });
  }
};

// Create new medication
export const createMedication = async (req, res) => {
  try {
    const patientId = req.user?.id || req.user?.sub;
    if (!patientId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { name, dosage, frequency, prescribedBy, startDate, notes } = req.body;

    if (!name || !dosage || !frequency) {
      return res.status(400).json({
        error: 'Missing required fields: name, dosage, and frequency are required'
      });
    }

    const medication = await Medication.create({
      patientId,            // ✅ ADD THIS
      name,
      dosage,
      frequency,
      prescribedBy,
      startDate,
      notes
    });

    res.status(201).json(medication);
  } catch (error) {
    if (error.name === 'SequelizeValidationError') {
      const messages = error.errors.map(err => err.message);
      return res.status(400).json({ error: messages.join(', ') });
    }
    console.error('Error creating medication:', error);
    res.status(500).json({ error: 'Failed to create medication' });
  }
};

// Update medication
export const updateMedication = async (req, res) => {
  try {
    const { name, dosage, frequency, prescribedBy, startDate, notes } = req.body;

    if (!name || !dosage || !frequency) {
      return res.status(400).json({
        error: 'Missing required fields: name, dosage, and frequency are required'
      });
    }

    const medication = await Medication.findByPk(req.params.id);

    if (!medication) {
      return res.status(404).json({ error: 'Medication not found' });
    }

    await medication.update({
      name,
      dosage,
      frequency,
      prescribedBy,
      startDate,
      notes
    });

    res.json(medication);
  } catch (error) {
    if (error.name === 'SequelizeValidationError') {
      const messages = error.errors.map(err => err.message);
      return res.status(400).json({ error: messages.join(', ') });
    }
    console.error('Error updating medication:', error);
    res.status(500).json({ error: 'Failed to update medication' });
  }
};

// Delete medication
export const deleteMedication = async (req, res) => {
  try {
    const medication = await Medication.findByPk(req.params.id);

    if (!medication) {
      return res.status(404).json({ error: 'Medication not found' });
    }

    await medication.destroy();

    res.status(204).send();
  } catch (error) {
    console.error('Error deleting medication:', error);
    res.status(500).json({ error: 'Failed to delete medication' });
  }
};

// Search medications
export const searchMedications = async (req, res) => {
  try {
    const { query } = req.params;

    const medications = await Medication.findAll({
      where: {
        [Op.or]: [
          { name: { [Op.iLike]: `%${query}%` } },
          { prescribedBy: { [Op.iLike]: `%${query}%` } }
        ]
      },
      order: [['createdAt', 'DESC']]
    });

    res.json(medications);
  } catch (error) {
    console.error('Error searching medications:', error);
    res.status(500).json({ error: 'Failed to search medications' });
  }
};
