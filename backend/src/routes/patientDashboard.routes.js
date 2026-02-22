import express from 'express';
import {
  getPatientDashboard,
  getMedicationStats,
  getActiveMedications,
  getMedicationsByDoctor,
  getUpcomingMedications
} from '../controllers/patientDashboard.controller.js';

const router = express.Router();

// HEAL-37: Patient dashboard - aggregated endpoint
router.get('/patient', getPatientDashboard);

// Additional dashboard endpoints
router.get('/stats', getMedicationStats);
router.get('/active', getActiveMedications);
router.get('/upcoming', getUpcomingMedications);
router.get('/doctor/:doctor', getMedicationsByDoctor);

export default router;