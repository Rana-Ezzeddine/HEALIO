

import express from 'express';
import requireUser from '../middleware/requireUser.js';
import requireRole from '../middleware/rbac.js';
import {
  generateInviteLink,
  listMyInvites,
  resolveInvite,
  acceptInvite,
  rejectInvite,
} from '../controllers/caregiverInvite.controller.js';

const router = express.Router();

router.post('/generate', requireUser, requireRole('patient'), generateInviteLink);

router.get('/mine', requireUser, requireRole('patient'), listMyInvites);

router.get('/:token', resolveInvite);

router.post('/:token/accept', requireUser, requireRole('caregiver'), acceptInvite);

router.post('/:token/reject', requireUser, requireRole('caregiver'), rejectInvite);

export default router;