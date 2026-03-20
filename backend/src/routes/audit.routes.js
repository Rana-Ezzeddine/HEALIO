import express from 'express';
import requireUser from '../middleware/requireUser.js';
import requireVerified from '../middleware/requireVerified.js';
import requireDoctorProductAccessIfDoctor from '../middleware/requireDoctorProductAccessIfDoctor.js';
import { getAuditLogs } from '../controllers/audit.controller.js';

const router = express.Router();

router.use(requireUser);
router.use(requireVerified);
router.use(requireDoctorProductAccessIfDoctor);

// GET /api/audit/logs?userId=<uuid>&action=<text>&limit=50&offset=0
router.get('/logs', getAuditLogs);

export default router;
