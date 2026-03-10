import express from 'express';
import {
  getPatientMedicalHistory,
  getMedicalHistorySummary
} from '../controllers/patientmedHistoryController.js';

const router = express.Router();

// PBI-25: Patient medical history endpoints
router.get('/patient/:patientId', getPatientMedicalHistory);
router.get('/patient/:patientId/summary', getMedicalHistorySummary);

export default router;