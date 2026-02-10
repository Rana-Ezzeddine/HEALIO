import express from 'express';
import {
  getAllMedications,
  getMedicationById,
  createMedication,
  updateMedication,
  deleteMedication,
  searchMedications
} from '../controllers/medications.controller.js';

const router = express.Router();

router.get('/search/:query', searchMedications);
router.get('/',              getAllMedications);
router.get('/:id',           getMedicationById);
router.post('/',             createMedication);
router.put('/:id',           updateMedication);
router.delete('/:id',        deleteMedication);

export default router;