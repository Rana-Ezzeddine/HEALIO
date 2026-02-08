import express from 'express';
import {
  getAllMedications,
  getMedicationById,
  createMedication,
  updateMedication,
  deleteMedication
} from '../controllers/medications.controller.js';

const router = express.Router();

// Routes
router.get('/', getAllMedications);
router.get('/:id', getMedicationById);
router.post('/', createMedication);
router.put('/:id', updateMedication);
router.delete('/:id', deleteMedication);

export default router;