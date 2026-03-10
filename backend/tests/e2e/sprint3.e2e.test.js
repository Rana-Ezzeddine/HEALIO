import test from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import bcrypt from 'bcrypt';

import app from '../../server.js';
import User from '../../src/models/User.js';
import DoctorPatientAssignment from '../../src/models/DoctorPatientAssignment.js';

const password = 'StrongPass123';

let patientToken = null;
let patientId = null;
let doctorId = null;

let patientEmail = `e2e_patient_${Date.now()}@example.com`;
let doctorEmail = `e2e_doctor_${Date.now()}@example.com`;

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
