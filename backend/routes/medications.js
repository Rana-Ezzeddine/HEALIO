import express from 'express';
import Medication from '../models/Medication.js';

const router = express.Router();

// Get all medications
router.get('/', async (req, res) => {
  try {
    const medications = await Medication.findAll({
      order: [['createdAt', 'DESC']]
    });
    res.json(medications);
  } catch (error) {
    console.error('Error fetching medications:', error);
    res.status(500).json({ error: 'Failed to fetch medications' });
  }
});

// Get single medication by ID
router.get('/:id', async (req, res) => {
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
});

// Create new medication
router.post('/', async (req, res) => {
  try {
    const { name, dosage, frequency, prescribedBy, startDate, notes } = req.body;
    
    // Validation
    if (!name || !dosage || !frequency) {
      return res.status(400).json({ 
        error: 'Missing required fields: name, dosage, and frequency are required' 
      });
    }
    
    const medication = await Medication.create({
      name,
      dosage,
      frequency,
      prescribedBy,
      startDate,
      notes
    });
    
    res.status(201).json(medication);
  } catch (error) {
    console.error('Error creating medication:', error);
    res.status(500).json({ error: 'Failed to create medication' });
  }
});

// Update medication
router.put('/:id', async (req, res) => {
  try {
    const { name, dosage, frequency, prescribedBy, startDate, notes } = req.body;
    const { id } = req.params;
    
    const medication = await Medication.findByPk(id);
    
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
      prescribedBy,
      startDate,
      notes
    });
    
    res.json(medication);
  } catch (error) {
    console.error('Error updating medication:', error);
    res.status(500).json({ error: 'Failed to update medication' });
  }
});

// Delete medication
router.delete('/:id', async (req, res) => {
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
});

export default router;