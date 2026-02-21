import express from 'express';
import requireUser from "../middleware/requireUser.js"; // ADD

import {
  getAllMedications,
  getMedicationById,
  createMedication,
  updateMedication,
  deleteMedication,
  searchMedications
} from '../controllers/medications.controller.js';

const router = express.Router();

router.use(requireUser); // ADD (so req.user exists)

router.get('/search/:query', searchMedications);
router.get('/',              getAllMedications);
router.get('/:id',           getMedicationById);
router.post('/',             createMedication);
router.put('/:id',           updateMedication);
router.delete('/:id',        deleteMedication);

export default router;