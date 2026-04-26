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
  verifyTwoFactor,
  getMfaStatus,
  beginMfaSetup,
  enableMfa,
  disableMfa,
  regenerateMfaRecoveryCodes,
  startGoogleAuth,
  googleCallback,
  startAppleAuth,
  appleCallback,
} from '../controllers/auth.controller.js';

const router = express.Router();

// routes
router.post('/register', register);
router.post('/login', login);
router.post('/verify-2fa', verifyTwoFactor);
router.get('/google/start', startGoogleAuth);
router.get('/google/callback', googleCallback);
router.get('/apple/start', startAppleAuth);
router.post('/apple/callback', appleCallback);
router.get('/apple/callback', appleCallback);
router.post('/verify-email', verifyEmail);
router.get('/verify-email', verifyEmail);
router.post('/resend-verification', resendVerification);
router.post('/forgot-password', requestPasswordReset);
router.get('/reset-password', validatePasswordResetToken);
router.post('/reset-password', resetPassword);
router.get('/me', requireUser, me);
router.get('/mfa/status', requireUser, getMfaStatus);
router.post('/mfa/setup', requireUser, beginMfaSetup);
router.post('/mfa/enable', requireUser, enableMfa);
router.post('/mfa/disable', requireUser, disableMfa);
router.post('/mfa/recovery-codes', requireUser, regenerateMfaRecoveryCodes);

export default router;
