import Medication from '../models/Medication.js';

// Get all medications
export const getAllMedications = async (req, res) => {
  try {
    const medications = await Medication.find()
      .sort({ createdAt: -1 })
      .lean();

    res.json(medications);
  } catch (error) {
    console.error('Error fetching medications:', error);
    res.status(500).json({ error: 'Failed to fetch medications' });
  }
};

// Get single medication by ID
export const getMedicationById = async (req, res) => {
  try {
    const medication = await Medication.findById(req.params.id);

    if (!medication) {
      return res.status(404).json({ error: 'Medication not found' });
    }

    res.json(medication);
  } catch (error) {
    if (error.name === 'CastError') {
      return res.status(400).json({ error: 'Invalid medication ID format' });
    }
    console.error('Error fetching medication:', error);
    res.status(500).json({ error: 'Failed to fetch medication' });
  }
};

// Create new medication
export const createMedication = async (req, res) => {
  try {
    const { name, dosage, frequency, prescribedBy, startDate, notes } = req.body;

    if (!name || !dosage || !frequency) {
      return res.status(400).json({
        error: 'Missing required fields: name, dosage, and frequency are required'
      });
    }

    const medication = new Medication({
      name,
      dosage,
      frequency,
      prescribedBy,
      startDate,
      notes
    });

    await medication.save();

    res.status(201).json(medication);
  } catch (error) {
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(err => err.message);
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

    const medication = await Medication.findByIdAndUpdate(
      req.params.id,
      { name, dosage, frequency, prescribedBy, startDate, notes },
      { new: true, runValidators: true }
    );

    if (!medication) {
      return res.status(404).json({ error: 'Medication not found' });
    }

    res.json(medication);
  } catch (error) {
    if (error.name === 'CastError') {
      return res.status(400).json({ error: 'Invalid medication ID format' });
    }
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({ error: messages.join(', ') });
    }
    console.error('Error updating medication:', error);
    res.status(500).json({ error: 'Failed to update medication' });
  }
};

// Delete medication
export const deleteMedication = async (req, res) => {
  try {
    const medication = await Medication.findByIdAndDelete(req.params.id);

    if (!medication) {
      return res.status(404).json({ error: 'Medication not found' });
    }

    res.status(204).send();
  } catch (error) {
    if (error.name === 'CastError') {
      return res.status(400).json({ error: 'Invalid medication ID format' });
    }
    console.error('Error deleting medication:', error);
    res.status(500).json({ error: 'Failed to delete medication' });
  }
};

// Search medications
export const searchMedications = async (req, res) => {
  try {
    const { query } = req.params;

    const medications = await Medication.find({
      $or: [
        { name: new RegExp(query, 'i') },
        { prescribedBy: new RegExp(query, 'i') }
      ]
    }).sort({ createdAt: -1 });

    res.json(medications);
  } catch (error) {
    console.error('Error searching medications:', error);
    res.status(500).json({ error: 'Failed to search medications' });
  }
};