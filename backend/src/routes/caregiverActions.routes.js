import express from 'express';
import requireUser from '../middleware/requireUser.js';
import requireRole from '../middleware/rbac.js';

import {
  logMedicationSupportAction,
  getMedicationAdherenceHistory,
} from '../controllers/caregiverMedicationActions.controller.js';

import {
  caregiverLogSymptom,
  getCaregiverPatientSymptomsLabeled,
} from '../controllers/caregiverSymptoms.controller.js';

import {
  getCaregiverPatientReminders,
  dismissReminder,
} from '../controllers/caregiverReminders.controller.js';

import {
  caregiverRequestAppointment,
} from '../controllers/caregiverAppointments.controller.js';

import {
  sendCareConcern,
} from '../controllers/caregiverCareConcern.controller.js';

const router = express.Router();
router.use(requireUser);
router.use(requireRole('caregiver'));

router.post(
  '/medications/:medicationId/support-action',
  logMedicationSupportAction
);
router.get(
  '/medications/:medicationId/adherence-history',
  getMedicationAdherenceHistory
);

router.post('/symptoms', caregiverLogSymptom);
router.get('/symptoms/patients/:patientId', getCaregiverPatientSymptomsLabeled);


router.get('/reminders/patients/:patientId', getCaregiverPatientReminders);
router.patch('/reminders/:reminderId/dismiss', dismissReminder);

router.post(
  '/appointments/patients/:patientId/request',
  caregiverRequestAppointment
);

router.post('/care-concerns', sendCareConcern);

export default router;