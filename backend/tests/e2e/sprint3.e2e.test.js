import test from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

import app from '../../server.js';
import User from '../../src/models/User.js';
import DoctorPatientAssignment from '../../src/models/DoctorPatientAssignment.js';
import CaregiverPatientPermission from '../../src/models/CaregiverPatientPermission.js';
import PatientProfile from '../../src/models/PatientProfile.js';

const password = 'StrongPass123';

let patientToken = null;
let patientId = null;
let doctorId = null;
let caregiverId = null;
let reviewerToken = null;

let patientEmail = `e2e_patient_${Date.now()}@example.com`;
let doctorEmail = `e2e_doctor_${Date.now()}@example.com`;

function tokenForUser(user) {
  return jwt.sign(
    { sub: user.id, role: user.role, isVerified: user.isVerified },
    process.env.JWT_ACCESS_SECRET,
    { expiresIn: '15m' }
  );
}

test('E2E: register -> verify -> login (patient)', async () => {
  const registerRes = await request(app)
    .post('/api/auth/register')
    .send({
      firstName: 'Rana',
      lastName: 'Patient',
      email: patientEmail,
      password,
      role: 'patient',
    });

  assert.equal(registerRes.status, 201);
  assert.ok(registerRes.body.verificationToken);

  const verifyRes = await request(app)
    .post('/api/auth/verify-email')
    .send({ token: registerRes.body.verificationToken });

  assert.equal(verifyRes.status, 200);
  assert.equal(verifyRes.body.user.isVerified, true);
  patientId = verifyRes.body.user.id;

  const loginRes = await request(app)
    .post('/api/auth/login')
    .send({ email: patientEmail, password });

  assert.equal(loginRes.status, 200);
  assert.ok(loginRes.body.token);
  patientToken = loginRes.body.token;
});

test('E2E: create doctor, assignment, and trigger emergency flow', async () => {
  const doctor = await User.create({
    email: doctorEmail,
    passwordHash: await bcrypt.hash(password, 12),
    role: 'doctor',
    isVerified: true,
  });

  doctorId = doctor.id;

  await DoctorPatientAssignment.create({
    doctorId,
    patientId,
    status: 'active',
  });

  const statusRes = await request(app)
    .patch('/api/emergency/status')
    .set('Authorization', `Bearer ${patientToken}`)
    .send({ isEmergency: true });

  assert.equal(statusRes.status, 200);
  assert.equal(statusRes.body.emergencyStatus, true);

  const triggerRes = await request(app)
    .post('/api/emergency/trigger-alert')
    .set('Authorization', `Bearer ${patientToken}`)
    .send({ reason: 'Severe chest pain' });

  assert.equal(triggerRes.status, 200);
  assert.equal(triggerRes.body.assignedDoctors, 1);
});

test('E2E: caregiver invite flow (patient -> caregiver accept)', async () => {
  const caregiver = await User.create({
    email: `e2e_caregiver_${Date.now()}@example.com`,
    passwordHash: await bcrypt.hash(password, 12),
    role: 'caregiver',
    isVerified: true,
  });
  caregiverId = caregiver.id;
  const caregiverToken = tokenForUser(caregiver);

  const inviteRes = await request(app)
    .post('/api/caregiver-invites/generate')
    .set('Authorization', `Bearer ${patientToken}`)
    .send({});

  assert.equal(inviteRes.status, 201);
  assert.ok(inviteRes.body.token);

  const acceptRes = await request(app)
    .post(`/api/caregiver-invites/${inviteRes.body.token}/accept`)
    .set('Authorization', `Bearer ${caregiverToken}`)
    .send({});

  assert.ok(acceptRes.status === 201 || acceptRes.status === 200);
  assert.equal(acceptRes.body.status, 'active');

  const link = await CaregiverPatientPermission.findOne({
    where: { caregiverId, patientId },
  });
  assert.ok(link);
});

test('E2E: reviewer journey approves pending doctor application', async () => {
  const reviewer = await User.create({
    email: `e2e_reviewer_${Date.now()}@example.com`,
    passwordHash: await bcrypt.hash(password, 12),
    role: 'patient',
    isVerified: true,
  });
  reviewerToken = tokenForUser(reviewer);
  process.env.DOCTOR_REVIEWER_IDS = [process.env.DOCTOR_REVIEWER_IDS, reviewer.id].filter(Boolean).join(',');

  const pendingDoctor = await User.create({
    email: `e2e_pending_doc_${Date.now()}@example.com`,
    passwordHash: await bcrypt.hash(password, 12),
    role: 'doctor',
    isVerified: true,
    doctorApprovalStatus: 'pending_approval',
  });

  await PatientProfile.create({
    userId: pendingDoctor.id,
    firstName: 'Pending',
    lastName: 'Doctor',
    licenseNb: 'LIC-TEST-001',
  });

  const listRes = await request(app)
    .get('/api/doctors/review/applications?status=pending_approval')
    .set('Authorization', `Bearer ${reviewerToken}`);

  assert.equal(listRes.status, 200);
  assert.ok(listRes.body.applications.some((a) => a.id === pendingDoctor.id));

  const approveRes = await request(app)
    .patch(`/api/doctors/review/applications/${pendingDoctor.id}`)
    .set('Authorization', `Bearer ${reviewerToken}`)
    .send({ decision: 'approve', notes: 'All checks passed.' });

  assert.equal(approveRes.status, 200);
  assert.equal(approveRes.body.application.status, 'approved');
});

test('E2E: audit endpoint returns emergency activity entries', async () => {
  const auditRes = await request(app)
    .get('/api/audit/logs')
    .set('Authorization', `Bearer ${patientToken}`);

  assert.equal(auditRes.status, 200);
  assert.ok(auditRes.body.total >= 2);

  const actions = auditRes.body.rows.map((row) => row.action);
  assert.ok(actions.includes('emergency.status.updated'));
  assert.ok(actions.includes('emergency.alert.triggered'));
});
