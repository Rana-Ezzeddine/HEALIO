import express from 'express';
import requireUser from '../middleware/requireUser.js';
import requireVerified from '../middleware/requireVerified.js';
import { setEmergencyStatus, triggerDoctorAlert } from '../controllers/emergency.controller.js';

const router = express.Router();

router.use(requireUser);
router.use(requireVerified);

// PATCH /api/emergency/status
router.patch('/status', setEmergencyStatus);

// POST /api/emergency/trigger-alert
router.post('/trigger-alert', triggerDoctorAlert);

export default router;
