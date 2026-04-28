import express from "express";
import requireUser from "../middleware/requireUser.js";
import requireRole from "../middleware/rbac.js";
import {
  assignCaregiver,
  getCaregiverPatientHealthData,
  getCaregiverPatientAppointments,
  getCaregiverPatientDoctors,
  getCaregiverPatientAppointmentAvailability,
  getCaregiverPatientMedications,
  getCaregiverPatientSymptoms,
  listCaregiverRequests,
  listMyCaregivers,
  listPatientsUnderCare,
  removeCaregiverAssignment,
  reviewCaregiverRequest,
  updateCaregiverPermissions,
  getCaregiverDashboardData,
} from "../controllers/caregiver.controller.js";

const router = express.Router();
router.use(requireUser);

// Patient-managed assignment and permission control
router.post("/assignments", requireRole("patient"), assignCaregiver);
router.get("/assignments/mine", requireRole("patient"), listMyCaregivers);
router.get("/assignments/requests", listCaregiverRequests);
router.patch("/assignments/requests/:patientId", requireRole("caregiver"), reviewCaregiverRequest);
router.patch("/assignments/:caregiverId", requireRole("patient"), updateCaregiverPermissions);
router.delete("/assignments/:caregiverId", requireRole("patient"), removeCaregiverAssignment);

// Caregiver access with permission enforcement
router.get("/patients", requireRole("caregiver"), listPatientsUnderCare);
router.get(
  "/patients/:patientId/medications",
  requireRole("caregiver"),
  getCaregiverPatientMedications
);
router.get(
  "/patients/:patientId/symptoms",
  requireRole("caregiver"),
  getCaregiverPatientSymptoms
);
router.get(
  "/patients/:patientId/appointments",
  requireRole("caregiver"),
  getCaregiverPatientAppointments
);
router.get(
  "/patients/:patientId/doctors",
  requireRole("caregiver"),
  getCaregiverPatientDoctors
);
router.get(
  "/patients/:patientId/appointments/availability",
  requireRole("caregiver"),
  getCaregiverPatientAppointmentAvailability
);
router.get(
  "/patients/:patientId/health-data",
  requireRole("caregiver"),
  getCaregiverPatientHealthData
);
router.get(
  '/patients/:patientId/dashboard',
  requireRole('caregiver'),
  getCaregiverDashboardData
);

export default router;
