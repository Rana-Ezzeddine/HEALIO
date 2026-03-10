import express from 'express';
import requireUser from '../middleware/requireUser.js';
import requireVerified from '../middleware/requireVerified.js';
import {
  getPatientDashboard,
  getMedicationStats,
  getActiveMedications,
  getMedicationsByDoctor,
  getUpcomingMedications
} from '../controllers/patientDashboard.controller.js';

const router = express.Router();

router.use(requireUser);
router.use(requireVerified);

// HEAL-37: Patient dashboard - aggregated endpoint
router.get('/patient', getPatientDashboard);

// Additional dashboard endpoints
router.get('/stats', getMedicationStats);
router.get('/active', getActiveMedications);
router.get('/upcoming', getUpcomingMedications);
router.get('/doctor/:doctor', getMedicationsByDoctor);

export default router;
