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
