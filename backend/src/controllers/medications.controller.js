import Medication from '../models/Medication.js';

function getPatientId(req) {
  return req.user?.id || req.user?.sub || null;
}

// Get all medications for the authenticated patient
export const getAllMedications = async (req, res) => {
  try {
    const patientId = getPatientId(req);
    if (!patientId) return res.status(401).json({ error: 'Not authenticated' });

    const medications = await Medication.findAll({
      where: { patientId },
      order: [['createdAt', 'DESC']]
    });
    res.json(medications);
  } catch (error) {
    console.error('Error fetching medications:', error);
    res.status(500).json({ error: 'Failed to fetch medications' });
  }
};

// Get single medication by ID (must belong to authenticated patient)
export const getMedicationById = async (req, res) => {
  try {
    const patientId = getPatientId(req);
    if (!patientId) return res.status(401).json({ error: 'Not authenticated' });

    const medication = await Medication.findOne({
      where: { id: req.params.id, patientId }
    });

    if (!medication) {
      return res.status(404).json({ error: 'Medication not found' });
    }
    
    res.json(medication);
  } catch (error) {
    console.error('Error fetching medication:', error);
    res.status(500).json({ error: 'Failed to fetch medication' });
  }
};

// Create new medication for the authenticated patient
export const createMedication = async (req, res) => {
  try {
    const patientId = getPatientId(req);
    if (!patientId) return res.status(401).json({ error: 'Not authenticated' });

    const { name, dosage, frequency, doseAmount, doseUnit, scheduleJson, startDate, endDate, notes } = req.body;

    if (!name || !dosage || !frequency) {
      return res.status(400).json({ 
        error: 'Missing required fields: name, dosage, and frequency are required' 
      });
    }
    
    const medication = await Medication.create({
      patientId,
      name,
      dosage,
      frequency,
      doseAmount: doseAmount ?? null,
      doseUnit: doseUnit ?? null,
      scheduleJson: scheduleJson ?? null,
      startDate: startDate ?? null,
      endDate: endDate ?? null,
      notes: notes ?? null
    });
    
    res.status(201).json(medication);
  } catch (error) {
    console.error('Error creating medication:', error);
    res.status(500).json({ error: 'Failed to create medication' });
  }
};

// Update medication (must belong to authenticated patient)
export const updateMedication = async (req, res) => {
  try {
    const patientId = getPatientId(req);
    if (!patientId) return res.status(401).json({ error: 'Not authenticated' });

    const { name, dosage, frequency, doseAmount, doseUnit, scheduleJson, startDate, endDate, notes } = req.body;

    if (!name || !dosage || !frequency) {
      return res.status(400).json({
        error: 'Missing required fields: name, dosage, and frequency are required'
      });
    }

    const medication = await Medication.findOne({
      where: { id: req.params.id, patientId }
    });

    if (!medication) {
      return res.status(404).json({ error: 'Medication not found' });
    }
    
    // Validation
    if (!name || !dosage || !frequency) {
      return res.status(400).json({ 
        error: 'Missing required fields: name, dosage, and frequency are required' 
      });
    }
    
    await medication.update({
      name,
      dosage,
      frequency,
      doseAmount: doseAmount ?? null,
      doseUnit: doseUnit ?? null,
      scheduleJson: scheduleJson ?? null,
      startDate: startDate ?? null,
      endDate: endDate ?? null,
      notes: notes ?? null
    });
    
    res.json(medication);
  } catch (error) {
    console.error('Error updating medication:', error);
    res.status(500).json({ error: 'Failed to update medication' });
  }
};

// Delete medication (must belong to authenticated patient)
export const deleteMedication = async (req, res) => {
  try {
    const patientId = getPatientId(req);
    if (!patientId) return res.status(401).json({ error: 'Not authenticated' });

    const medication = await Medication.findOne({
      where: { id: req.params.id, patientId }
    });

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

// Search medications for the authenticated patient
export const searchMedications = async (req, res) => {
  try {
    const patientId = getPatientId(req);
    if (!patientId) return res.status(401).json({ error: 'Not authenticated' });

    const { query } = req.params;

    const medications = await Medication.findAll({
      where: {
        patientId,
        [Op.or]: [
          { name: { [Op.iLike]: `%${query}%` } },
          { notes: { [Op.iLike]: `%${query}%` } }
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
