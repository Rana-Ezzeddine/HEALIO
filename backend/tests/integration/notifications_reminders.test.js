import test from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';

import app from '../../server.js';
import { User, Notification, ActivityLog, Reminder, Medication, Appointment, DoctorPatientAssignment, Message } from '../../src/models/index.js';
import ReminderService from '../../src/services/reminderService.js';

import sequelize from '../../database.js';

// Helper to create a verified user and token
async function createVerifiedUser(email, role) {
  const user = await User.create({
    email,
    passwordHash: 'hashed',
    role,
    isVerified: true,
  });
  const token = jwt.sign(
    { sub: user.id, role: user.role, isVerified: true },
    process.env.JWT_ACCESS_SECRET,
    { expiresIn: '15m' }
  );
  return { user, token };
}

test('Appointment creation triggers notification and activity log', async () => {
  const { user: doctor, token: doctorToken } = await createVerifiedUser(`doc_${Date.now()}@example.com`, 'doctor');
  const { user: patient } = await createVerifiedUser(`pat_${Date.now()}@example.com`, 'patient');

  // Manually ensure approval status for doctor (hook might handle it, but being explicit)
  await doctor.update({ doctorApprovalStatus: 'approved' });
  await DoctorPatientAssignment.create({
    doctorId: doctor.id,
    patientId: patient.id,
    status: 'active',
  });

  console.log('--- Creating appointment ---');
  const res = await request(app)
    .post('/api/appointments')
    .set('Authorization', `Bearer ${doctorToken}`)
    .send({
      patientId: patient.id,
      startsAt: new Date(Date.now() + 86400000).toISOString(),
      endsAt: new Date(Date.now() + 86400000 + 1800000).toISOString(),
      location: 'Telehealth',
    });

  console.log('--- Appointment status:', res.status, res.body);
  assert.equal(res.status, 201);
  const appointmentId = res.body.id;

  // Verify Notification
  const notification = await Notification.findOne({
    where: { userId: patient.id, category: 'appointment_update' }
  });
  assert.ok(notification);
  assert.match(notification.message, /new appointment/);

  // Verify Activity Log
  const activity = await ActivityLog.findOne({
    where: { userId: doctor.id, path: '/api/appointments', method: 'POST' }
  });
  assert.ok(activity);
});

test('ReminderService processes due reminders and notifies users', async () => {
  const { user: patient } = await createVerifiedUser(`rem_pat_${Date.now()}@example.com`, 'patient');
  const { user: caregiver } = await createVerifiedUser(`rem_car_${Date.now()}@example.com`, 'caregiver');

  // Link caregiver to patient
  const { CaregiverPatientPermission } = await import('../../src/models/index.js');
  await CaregiverPatientPermission.create({
    caregiverId: caregiver.id,
    patientId: patient.id,
    status: 'active',
    canReceiveReminders: true,
  });

  // Create a due reminder
  const reminder = await Reminder.create({
    userId: patient.id,
    type: 'medication',
    relatedId: '00000000-0000-0000-0000-000000000000', // Mock med ID
    scheduledAt: new Date(Date.now() - 10000), // Past
    status: 'pending',
  });

  // Run processing
  await ReminderService.processDueReminders();

  // Verify status update
  await reminder.reload();
  assert.equal(reminder.status, 'sent');

  // Verify patient notification
  const patNotif = await Notification.findOne({
    where: { userId: patient.id, category: 'medication_reminder' }
  });
  assert.ok(patNotif);

  // Verify caregiver notification
  const carNotif = await Notification.findOne({
    where: { userId: caregiver.id, category: 'caregiver_medication_reminder' }
  });
  assert.ok(carNotif);
});

test('Activity History API returns formatted activities', async () => {
  const { user, token } = await createVerifiedUser(`hist_${Date.now()}@example.com`, 'doctor');

  // Create mock logs
  await ActivityLog.create({
    userId: user.id,
    action: 'create_appointment',
    method: 'POST',
    path: '/api/appointments',
    statusCode: 201,
  });

  const res = await request(app)
    .get('/api/history')
    .set('Authorization', `Bearer ${token}`);

  assert.equal(res.status, 200);
  assert.ok(res.body.activities.length > 0);
  
  const found = res.body.activities.find(a => a.description === 'Scheduled a new appointment');
  assert.ok(found, 'Should find the scheduled appointment activity');
});

test('Medication creation auto-schedules pending reminder', async () => {
  const { user: patient, token } = await createVerifiedUser(`med_sched_${Date.now()}@example.com`, 'patient');

  const createRes = await request(app)
    .post('/api/medications')
    .set('Authorization', `Bearer ${token}`)
    .send({
      name: 'Metformin',
      dosage: '500mg',
      scheduleJson: { times: ['23:59'] },
      reminderEnabled: true,
      reminderLeadMinutes: 15,
    });

  assert.equal(createRes.status, 201);

  const reminder = await Reminder.findOne({
    where: {
      userId: patient.id,
      type: 'medication',
      relatedId: createRes.body.id,
      status: 'pending',
    },
  });

  assert.ok(reminder, 'Expected a pending medication reminder to be created');
});

test('Appointment scheduling creates and clears pending reminder', async () => {
  const { user: doctor, token: doctorToken } = await createVerifiedUser(`doc_appt_${Date.now()}@example.com`, 'doctor');
  const { user: patient } = await createVerifiedUser(`pat_appt_${Date.now()}@example.com`, 'patient');

  await doctor.update({ doctorApprovalStatus: 'approved' });
  await DoctorPatientAssignment.create({
    doctorId: doctor.id,
    patientId: patient.id,
    status: 'active',
  });

  const startsAt = new Date(Date.now() + 5 * 60 * 60 * 1000).toISOString();
  const endsAt = new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString();

  const createRes = await request(app)
    .post('/api/appointments')
    .set('Authorization', `Bearer ${doctorToken}`)
    .send({
      patientId: patient.id,
      startsAt,
      endsAt,
      location: 'Main Clinic',
    });

  assert.equal(createRes.status, 201);
  const appointmentId = createRes.body.id;

  const pendingReminder = await Reminder.findOne({
    where: {
      userId: patient.id,
      type: 'appointment',
      relatedId: appointmentId,
      status: 'pending',
    },
  });
  assert.ok(pendingReminder, 'Expected appointment reminder after scheduling');

  const cancelRes = await request(app)
    .patch(`/api/appointments/${appointmentId}/status`)
    .set('Authorization', `Bearer ${doctorToken}`)
    .send({ status: 'cancelled' });

  assert.equal(cancelRes.status, 200);

  const clearedReminder = await Reminder.findOne({
    where: {
      userId: patient.id,
      type: 'appointment',
      relatedId: appointmentId,
      status: 'pending',
    },
  });
  assert.equal(clearedReminder, null);
});

test('Messaging API attaches communication context to message', async () => {
  const { user: patient, token: patientToken } = await createVerifiedUser(`ctx_pat_${Date.now()}@example.com`, 'patient');
  const { user: doctor } = await createVerifiedUser(`ctx_doc_${Date.now()}@example.com`, 'doctor');

  await doctor.update({ doctorApprovalStatus: 'approved' });
  await DoctorPatientAssignment.create({
    doctorId: doctor.id,
    patientId: patient.id,
    status: 'active',
  });

  const convoRes = await request(app)
    .post('/api/conversations')
    .set('Authorization', `Bearer ${patientToken}`)
    .send({ recipientId: doctor.id });

  assert.ok(convoRes.status === 201 || convoRes.status === 200);
  const conversationId = convoRes.body.conversation.id;

  const msgRes = await request(app)
    .post(`/api/conversations/${conversationId}/messages`)
    .set('Authorization', `Bearer ${patientToken}`)
    .send({
      body: 'Please review this medication update.',
      contextType: 'medication',
      contextRelatedId: crypto.randomUUID(),
      contextMetadata: { source: 'integration-test' },
    });

  assert.equal(msgRes.status, 201);
  assert.ok(msgRes.body.data.contextId);

  const storedMessage = await Message.findByPk(msgRes.body.data.id);
  assert.ok(storedMessage?.contextId, 'Expected stored message to include contextId');
});
