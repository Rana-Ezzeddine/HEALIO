import express from 'express';
import {
  getPatientMedicalHistory,
  getMedicalHistorySummary
} from '../controllers/patientmedHistoryController.js';

import requireUser from '../middleware/requireUser.js';
import requireVerified from '../middleware/requireVerified.js';
import requireDoctorProductAccessIfDoctor from '../middleware/requireDoctorProductAccessIfDoctor.js';

const router = express.Router();

router.use(requireUser);
router.use(requireVerified);
router.use(requireDoctorProductAccessIfDoctor);

// PBI-25: Patient medical history endpoints
router.get('/patient/:patientId', getPatientMedicalHistory);
router.get('/patient/:patientId/summary', getMedicalHistorySummary);


export default router;
