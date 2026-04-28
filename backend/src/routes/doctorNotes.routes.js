import express from 'express';
import {
  createPatientDoctorNote,
  getPatientDoctorNotes,
  getPatientTreatmentPlans,
  getPatientClinicalInformation,
  getDoctorNoteById,
  getTreatmentPlanById,
  searchDoctorNotes
} from '../controllers/doctorNotesController.js';
import requireUser from '../middleware/requireUser.js';
import requireVerified from '../middleware/requireVerified.js';
import requireDoctorProductAccessIfDoctor from '../middleware/requireDoctorProductAccessIfDoctor.js';

const router = express.Router();

router.use(requireUser);
router.use(requireVerified);
router.use(requireDoctorProductAccessIfDoctor);

//Patient view of doctor notes and treatment plans


// Get all doctor notes for a patient
router.post('/patient/:patientId/notes', createPatientDoctorNote);
router.get('/patient/:patientId/notes', getPatientDoctorNotes);

// Get all treatment plans for a patient
router.get('/patient/:patientId/treatment-plans', getPatientTreatmentPlans);

// Get combined clinical information (notes + plans)
router.get('/patient/:patientId/clinical-info', getPatientClinicalInformation);

// Get single note by ID
router.get('/patient/:patientId/notes/:noteId', getDoctorNoteById);

// Get single treatment plan by ID
router.get('/patient/:patientId/treatment-plans/:planId', getTreatmentPlanById);

// Search doctor notes
router.get('/patient/:patientId/notes/search', searchDoctorNotes);
export default router;
