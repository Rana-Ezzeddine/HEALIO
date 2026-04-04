import express from 'express';
import requireUser from '../middleware/requireUser.js';
import { getMyActivityHistory } from '../controllers/activityHistoryController.js';

const router = express.Router();
router.use(requireUser);

router.get('/', getMyActivityHistory);

export default router;
