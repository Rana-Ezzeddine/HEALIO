import express from 'express';
import requireUser from '../middleware/requireUser.js';

import {
  register,
  login,
  me,
  verifyEmail,
  resendVerification,
  requestPasswordReset,
  validatePasswordResetToken,
  resetPassword,
  startGoogleAuth,
  googleCallback,
} from '../controllers/auth.controller.js';

const router = express.Router();

// routes
router.post('/register', register);
router.post('/login', login);
router.get('/google/start', startGoogleAuth);
router.get('/google/callback', googleCallback);
router.post('/verify-email', verifyEmail);
router.get('/verify-email', verifyEmail);
router.post('/resend-verification', resendVerification);
router.post('/forgot-password', requestPasswordReset);
router.get('/reset-password', validatePasswordResetToken);
router.post('/reset-password', resetPassword);
router.get('/me', requireUser, me);

export default router;
