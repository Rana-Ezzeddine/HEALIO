import test from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';

import app from '../../server.js';
import User from '../../src/models/User.js';
import PendingRegistration from '../../src/models/PendingRegistration.js';
import PasswordResetToken from '../../src/models/PasswordResetToken.js';

const email = `integration_${Date.now()}@example.com`;
const password = 'StrongPass123';
const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

function decodeBase32(input) {
  const normalized = String(input || '')
    .toUpperCase()
    .replace(/[^A-Z2-7]/g, '');

  let bits = 0;
  let value = 0;
  const bytes = [];

  for (const char of normalized) {
    const index = BASE32_ALPHABET.indexOf(char);
    if (index === -1) continue;

    value = (value << 5) | index;
    bits += 5;

    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }

  return Buffer.from(bytes);
}

function createTotpCode(secret, now = Date.now()) {
  const counter = Math.floor(now / 1000 / 30);
  const counterBuffer = Buffer.alloc(8);
  counterBuffer.writeBigUInt64BE(BigInt(counter));
  const hmac = crypto.createHmac('sha1', decodeBase32(secret)).update(counterBuffer).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const binary =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);

  return String(binary % 1_000_000).padStart(6, '0');
}

test('registration issues verification token and blocks login before verification', async () => {
  const registerRes = await request(app)
    .post('/api/auth/register')
    .send({
      firstName: 'Rana',
      lastName: 'Tester',
      email,
      password,
      role: 'patient',
    });

  assert.equal(registerRes.status, 201);
  assert.equal(registerRes.body.user.email, email);
  assert.equal(registerRes.body.user.isVerified, false);
  assert.equal(registerRes.body.verificationRequired, true);
  assert.ok(registerRes.body.verificationToken);

  const loginRes = await request(app)
    .post('/api/auth/login')
    .send({ email, password });

  assert.equal(loginRes.status, 403);
  assert.equal(loginRes.body.code, 'EMAIL_NOT_VERIFIED');
  assert.equal(loginRes.body.email, email);
});

test('repeat registration before verification refreshes the pending signup and latest role', async () => {
  const pendingEmail = `pending_${Date.now()}@example.com`;

  const firstRegisterRes = await request(app)
    .post('/api/auth/register')
    .send({
      firstName: 'Rana',
      lastName: 'Pending',
      email: pendingEmail,
      password,
      role: 'patient',
    });

  assert.equal(firstRegisterRes.status, 201);
  assert.equal(firstRegisterRes.body.user.role, 'patient');

  const secondRegisterRes = await request(app)
    .post('/api/auth/register')
    .send({
      firstName: 'Drana',
      lastName: 'Pending',
      email: pendingEmail,
      password,
      role: 'doctor',
      licenseNb: 'DOC-4421',
    });

  assert.equal(secondRegisterRes.status, 200);
  assert.equal(secondRegisterRes.body.user.role, 'doctor');
  assert.equal(secondRegisterRes.body.user.licenseNb, 'DOC-4421');
  assert.equal(
    secondRegisterRes.body.message,
    'Pending registration updated. Please verify your email using the newest link.'
  );
  assert.ok(secondRegisterRes.body.verificationToken);

  const verifyRes = await request(app)
    .post('/api/auth/verify-email')
    .send({ token: secondRegisterRes.body.verificationToken });

  assert.equal(verifyRes.status, 200);
  assert.equal(verifyRes.body.user.role, 'doctor');
  assert.equal(verifyRes.body.user.licenseNb, 'DOC-4421');
  assert.equal(verifyRes.body.user.doctorApprovalStatus, 'pending_approval');
});

test('verify-email activates account and login succeeds', async () => {
  const registerRes = await request(app)
    .post('/api/auth/register')
    .send({
      firstName: 'Rana',
      lastName: 'Tester',
      email: `verify_${Date.now()}@example.com`,
      password,
      role: 'patient',
    });

  const verificationToken = registerRes.body.verificationToken;
  assert.ok(verificationToken);

  const verifyRes = await request(app)
    .post('/api/auth/verify-email')
    .send({ token: verificationToken });

  assert.equal(verifyRes.status, 200);
  assert.equal(verifyRes.body.user.isVerified, true);

  const loginRes = await request(app)
    .post('/api/auth/login')
    .send({
      email: verifyRes.body.user.email,
      password,
    });

  assert.equal(loginRes.status, 200);
  assert.ok(loginRes.body.token);
});

test('expired verification link returns recovery details and resend issues a replacement token', async () => {
  const expiredEmail = `expired_${Date.now()}@example.com`;
  const rawToken = crypto.randomBytes(32).toString('hex');
  const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

  await PendingRegistration.create({
    firstName: 'Rana',
    lastName: 'Expired',
    email: expiredEmail,
    passwordHash: '$2b$12$IX2f3qUS5xkN9aDymN5lXOUwbl6adPC6EycNIR2A7xv5q9Br8IphK',
    role: 'patient',
    tokenHash,
    expiresAt: new Date(Date.now() - 60_000),
  });

  const verifyRes = await request(app)
    .post('/api/auth/verify-email')
    .send({ token: rawToken });

  assert.equal(verifyRes.status, 400);
  assert.equal(verifyRes.body.code, 'VERIFICATION_TOKEN_EXPIRED');
  assert.equal(verifyRes.body.email, expiredEmail);

  const resendRes = await request(app)
    .post('/api/auth/resend-verification')
    .send({ email: expiredEmail });

  assert.equal(resendRes.status, 200);
  assert.ok(resendRes.body.verificationToken);
});

test('requireVerified middleware blocks unverified token on protected route', async () => {
  const unverifiedUser = await User.create({
    email: `unverified_${Date.now()}@example.com`,
    passwordHash: '$2b$12$IX2f3qUS5xkN9aDymN5lXOUwbl6adPC6EycNIR2A7xv5q9Br8IphK',
    role: 'patient',
    isVerified: false,
  });

  const token = jwt.sign(
    {
      sub: unverifiedUser.id,
      role: unverifiedUser.role,
      isVerified: false,
    },
    process.env.JWT_ACCESS_SECRET,
    { expiresIn: '15m' }
  );

  const res = await request(app)
    .get('/api/medications')
    .set('Authorization', `Bearer ${token}`);

  assert.equal(res.status, 403);
  assert.equal(res.body.code, 'EMAIL_NOT_VERIFIED');
});

test('forgot-password issues a reset token and reset-password accepts a new password', async () => {
  const resetEmail = `reset_${Date.now()}@example.com`;
  await User.create({
    email: resetEmail,
    passwordHash: '$2b$12$IX2f3qUS5xkN9aDymN5lXOUwbl6adPC6EycNIR2A7xv5q9Br8IphK',
    role: 'patient',
    isVerified: true,
    authProvider: 'local',
  });

  const requestRes = await request(app)
    .post('/api/auth/forgot-password')
    .send({ email: resetEmail });

  assert.equal(requestRes.status, 200);
  assert.ok(requestRes.body.resetToken);

  const validateRes = await request(app)
    .get(`/api/auth/reset-password?token=${encodeURIComponent(requestRes.body.resetToken)}`);

  assert.equal(validateRes.status, 200);

  const newPassword = 'NewStrongPass123';
  const resetRes = await request(app)
    .post('/api/auth/reset-password')
    .send({
      token: requestRes.body.resetToken,
      password: newPassword,
    });

  assert.equal(resetRes.status, 200);

  const loginRes = await request(app)
    .post('/api/auth/login')
    .send({
      email: resetEmail,
      password: newPassword,
    });

  assert.equal(loginRes.status, 200);
});

test('expired reset token shows a clear expired state', async () => {
  const resetUser = await User.create({
    email: `reset_expired_${Date.now()}@example.com`,
    passwordHash: '$2b$12$IX2f3qUS5xkN9aDymN5lXOUwbl6adPC6EycNIR2A7xv5q9Br8IphK',
    role: 'patient',
    isVerified: true,
    authProvider: 'local',
  });

  const rawToken = crypto.randomBytes(32).toString('hex');
  const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

  await PasswordResetToken.create({
    userId: resetUser.id,
    tokenHash,
    expiresAt: new Date(Date.now() - 60_000),
  });

  const validateRes = await request(app)
    .get(`/api/auth/reset-password?token=${encodeURIComponent(rawToken)}`);

  assert.equal(validateRes.status, 400);
  assert.equal(validateRes.body.code, 'RESET_TOKEN_EXPIRED');
});

test('forgot-password returns a clear error when the email does not exist', async () => {
  const res = await request(app)
    .post('/api/auth/forgot-password')
    .send({ email: `missing_${Date.now()}@example.com` });

  assert.equal(res.status, 404);
  assert.equal(res.body.code, 'EMAIL_NOT_FOUND');
  assert.equal(res.body.message, 'Email does not exist.');
});

test('doctor registration requires a license number', async () => {
  const res = await request(app)
    .post('/api/auth/register')
    .send({
      firstName: 'Doctor',
      lastName: 'NoLicense',
      email: `doctor_nolicense_${Date.now()}@example.com`,
      password,
      role: 'doctor',
    });

  assert.equal(res.status, 400);
  assert.equal(res.body.message, 'Doctor license number is required.');
});

test('doctor accounts stay pending approval until a reviewer approves them', async () => {
  const reviewerEmail = `reviewer_${Date.now()}@example.com`;
  process.env.DOCTOR_REVIEWER_EMAILS = reviewerEmail;

  const reviewer = await User.create({
    email: reviewerEmail,
    passwordHash: '$2b$12$IX2f3qUS5xkN9aDymN5lXOUwbl6adPC6EycNIR2A7xv5q9Br8IphK',
    role: 'patient',
    isVerified: true,
  });

  const reviewerToken = jwt.sign(
    {
      sub: reviewer.id,
      role: reviewer.role,
      isVerified: true,
    },
    process.env.JWT_ACCESS_SECRET,
    { expiresIn: '15m' }
  );

  const patient = await User.create({
    email: `doctor_flow_patient_${Date.now()}@example.com`,
    passwordHash: '$2b$12$IX2f3qUS5xkN9aDymN5lXOUwbl6adPC6EycNIR2A7xv5q9Br8IphK',
    role: 'patient',
    isVerified: true,
  });

  const patientToken = jwt.sign(
    {
      sub: patient.id,
      role: patient.role,
      isVerified: true,
    },
    process.env.JWT_ACCESS_SECRET,
    { expiresIn: '15m' }
  );

  const doctorEmail = `doctor_pending_${Date.now()}@example.com`;
  const registerRes = await request(app)
    .post('/api/auth/register')
    .send({
      firstName: 'Dana',
      lastName: 'Doctor',
      email: doctorEmail,
      password,
      role: 'doctor',
      licenseNb: 'LIC-2026-001',
    });

  assert.equal(registerRes.status, 201);
  assert.equal(registerRes.body.user.doctorApprovalStatus, 'unverified');
  assert.equal(registerRes.body.user.licenseNb, 'LIC-2026-001');

  const verifyRes = await request(app)
    .post('/api/auth/verify-email')
    .send({ token: registerRes.body.verificationToken });

  assert.equal(verifyRes.status, 200);
  assert.equal(verifyRes.body.user.doctorApprovalStatus, 'pending_approval');
  assert.equal(verifyRes.body.user.licenseNb, 'LIC-2026-001');

  const loginRes = await request(app)
    .post('/api/auth/login')
    .send({
      email: doctorEmail,
      password,
    });

  assert.equal(loginRes.status, 200);
  assert.equal(loginRes.body.user.doctorApprovalStatus, 'pending_approval');
  assert.ok(loginRes.body.token);

  const pendingDoctorToken = loginRes.body.token;
  const blockedDashboardRes = await request(app)
    .get('/api/doctors/dashboard-overview')
    .set('Authorization', `Bearer ${pendingDoctorToken}`);

  assert.equal(blockedDashboardRes.status, 403);
  assert.equal(blockedDashboardRes.body.code, 'DOCTOR_APPROVAL_PENDING');

  const blockedLinkRes = await request(app)
    .post('/api/doctors/assignments')
    .set('Authorization', `Bearer ${patientToken}`)
    .send({ doctorEmail });

  assert.equal(blockedLinkRes.status, 403);
  assert.equal(blockedLinkRes.body.code, 'DOCTOR_NOT_AVAILABLE');

  const listRes = await request(app)
    .get('/api/doctors/review/applications')
    .set('Authorization', `Bearer ${reviewerToken}`);

  assert.equal(listRes.status, 200);
  assert.ok(listRes.body.applications.some((application) => application.email === doctorEmail));

  const doctorRecord = await User.findOne({ where: { email: doctorEmail } });
  assert.ok(doctorRecord);

  const requestInfoRes = await request(app)
    .patch(`/api/doctors/review/applications/${doctorRecord.id}`)
    .set('Authorization', `Bearer ${reviewerToken}`)
    .send({
      decision: 'request_more_info',
      notes: 'Please upload a clearer license scan.',
    });

  assert.equal(requestInfoRes.status, 200);
  assert.equal(requestInfoRes.body.application.status, 'pending_approval');
  assert.equal(requestInfoRes.body.application.requestedMoreInfo, true);

  const statusRes = await request(app)
    .get('/api/doctors/application-status')
    .set('Authorization', `Bearer ${pendingDoctorToken}`);

  assert.equal(statusRes.status, 200);
  assert.equal(statusRes.body.application.status, 'pending_approval');
  assert.equal(statusRes.body.application.requestedMoreInfo, true);
  assert.equal(statusRes.body.application.notes, 'Please upload a clearer license scan.');

  const approveRes = await request(app)
    .patch(`/api/doctors/review/applications/${doctorRecord.id}`)
    .set('Authorization', `Bearer ${reviewerToken}`)
    .send({
      decision: 'approve',
      notes: 'License checked and approved.',
    });

  assert.equal(approveRes.status, 200);
  assert.equal(approveRes.body.application.status, 'approved');

  const approvedDashboardRes = await request(app)
    .get('/api/doctors/dashboard-overview')
    .set('Authorization', `Bearer ${pendingDoctorToken}`);

  assert.equal(approvedDashboardRes.status, 200);

  const allowedLinkRes = await request(app)
    .post('/api/doctors/assignments')
    .set('Authorization', `Bearer ${patientToken}`)
    .send({ doctorEmail });

  assert.equal(allowedLinkRes.status, 201);
});

test('local user can enable MFA and then must complete a second factor at login', async () => {
  const mfaEmail = `mfa_${Date.now()}@example.com`;

  const registerRes = await request(app)
    .post('/api/auth/register')
    .send({
      firstName: 'Mia',
      lastName: 'Factor',
      email: mfaEmail,
      password,
      role: 'patient',
    });

  assert.equal(registerRes.status, 201);

  const verifyRes = await request(app)
    .post('/api/auth/verify-email')
    .send({ token: registerRes.body.verificationToken });

  assert.equal(verifyRes.status, 200);

  const loginRes = await request(app)
    .post('/api/auth/login')
    .send({ email: mfaEmail, password });

  assert.equal(loginRes.status, 200);
  assert.ok(loginRes.body.token);

  const setupRes = await request(app)
    .post('/api/auth/mfa/setup')
    .set('Authorization', `Bearer ${loginRes.body.token}`)
    .send({ password });

  assert.equal(setupRes.status, 200);
  assert.ok(setupRes.body.setupToken);
  assert.ok(setupRes.body.secret);

  const enableRes = await request(app)
    .post('/api/auth/mfa/enable')
    .set('Authorization', `Bearer ${loginRes.body.token}`)
    .send({
      setupToken: setupRes.body.setupToken,
      code: createTotpCode(setupRes.body.secret),
    });

  assert.equal(enableRes.status, 200);
  assert.equal(enableRes.body.backupCodes.length, 8);

  const mfaLoginRes = await request(app)
    .post('/api/auth/login')
    .send({ email: mfaEmail, password });

  assert.equal(mfaLoginRes.status, 200);
  assert.equal(mfaLoginRes.body.requiresTwoFactor, true);
  assert.ok(mfaLoginRes.body.challengeToken);
  assert.equal(mfaLoginRes.body.user.mfaEnabled, true);
  assert.equal(mfaLoginRes.body.token, undefined);

  const verifyMfaRes = await request(app)
    .post('/api/auth/verify-2fa')
    .send({
      challengeToken: mfaLoginRes.body.challengeToken,
      code: createTotpCode(setupRes.body.secret),
    });

  assert.equal(verifyMfaRes.status, 200);
  assert.ok(verifyMfaRes.body.token);
  assert.equal(verifyMfaRes.body.usedBackupCode, false);
  assert.equal(verifyMfaRes.body.user.mfaEnabled, true);
});

test('backup codes can complete MFA once and are then consumed', async () => {
  const recoveryEmail = `mfa_backup_${Date.now()}@example.com`;

  const registerRes = await request(app)
    .post('/api/auth/register')
    .send({
      firstName: 'Nora',
      lastName: 'Backup',
      email: recoveryEmail,
      password,
      role: 'patient',
    });

  const verifyRes = await request(app)
    .post('/api/auth/verify-email')
    .send({ token: registerRes.body.verificationToken });

  assert.equal(verifyRes.status, 200);

  const loginRes = await request(app)
    .post('/api/auth/login')
    .send({ email: recoveryEmail, password });

  const setupRes = await request(app)
    .post('/api/auth/mfa/setup')
    .set('Authorization', `Bearer ${loginRes.body.token}`)
    .send({ password });

  const enableRes = await request(app)
    .post('/api/auth/mfa/enable')
    .set('Authorization', `Bearer ${loginRes.body.token}`)
    .send({
      setupToken: setupRes.body.setupToken,
      code: createTotpCode(setupRes.body.secret),
    });

  const backupCode = enableRes.body.backupCodes[0];
  assert.ok(backupCode);

  const challengedLoginRes = await request(app)
    .post('/api/auth/login')
    .send({ email: recoveryEmail, password });

  assert.equal(challengedLoginRes.body.requiresTwoFactor, true);

  const backupVerifyRes = await request(app)
    .post('/api/auth/verify-2fa')
    .send({
      challengeToken: challengedLoginRes.body.challengeToken,
      code: backupCode,
    });

  assert.equal(backupVerifyRes.status, 200);
  assert.equal(backupVerifyRes.body.usedBackupCode, true);

  const secondLoginRes = await request(app)
    .post('/api/auth/login')
    .send({ email: recoveryEmail, password });

  const reusedBackupRes = await request(app)
    .post('/api/auth/verify-2fa')
    .send({
      challengeToken: secondLoginRes.body.challengeToken,
      code: backupCode,
    });

  assert.equal(reusedBackupRes.status, 401);
});
