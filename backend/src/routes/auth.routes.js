import express from 'express';
import requireUser from '../middleware/requireUser.js';

import {
  register,
  login,
  me,
  verifyEmail,
  resendVerification,
} from '../controllers/auth.controller.js';

const router = express.Router();

// routes
router.post('/register', register);
router.post('/login', login);
router.post('/verify-email', verifyEmail);
router.get('/verify-email', verifyEmail);
router.post('/resend-verification', resendVerification);
router.get('/me', requireUser, me);

export default router;
