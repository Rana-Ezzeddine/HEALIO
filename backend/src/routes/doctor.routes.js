import express from "express";
import requireUser from "../middleware/requireUser.js";
import requireVerified from "../middleware/requireVerified.js";
import requireDoctorProductAccessIfDoctor from "../middleware/requireDoctorProductAccessIfDoctor.js";
import requireReviewer from "../middleware/requireReviewer.js";
import {
  assignPatientToDoctor,
  getAssignedPatients,
  getDoctorDashboardOverview,
  getDoctorLinkRequests,
  getMyDoctors,
  reviewDoctorLinkRequest,
  getDoctorProfile,
  getPatientWorkspace,
  getPatientOverview,
  getPatientTimeline,
  getPatientActivity,
  getPatientUpdates,
} from "../controllers/doctor.controller.js";
import {
  getDoctorApplicationStatus,
  listDoctorApplications,
  reviewDoctorApplication,
} from "../controllers/doctorReview.controller.js";
import {
  createAvailability,
  getMyAvailability,
  updateAvailability,
  deleteAvailability,
} from "../controllers/doctorAvailability.controller.js";

const router = express.Router();

// GET /api/doctors/assigned-patients
router.get("/assigned-patients", requireUser, requireVerified, requireDoctorProductAccessIfDoctor, getAssignedPatients);
// GET /api/doctors/dashboard-overview
router.get("/dashboard-overview", requireUser, requireVerified, requireDoctorProductAccessIfDoctor, getDoctorDashboardOverview);

// Availability CRUD
router.get("/availability", requireUser, requireVerified, requireDoctorProductAccessIfDoctor, getMyAvailability);
router.post("/availability", requireUser, requireVerified, requireDoctorProductAccessIfDoctor, createAvailability);
router.put("/availability/:id", requireUser, requireVerified, requireDoctorProductAccessIfDoctor, updateAvailability);
router.delete("/availability/:id", requireUser, requireVerified, requireDoctorProductAccessIfDoctor, deleteAvailability);
// GET /api/doctors/assignments/mine
router.get("/assignments/mine", requireUser, requireVerified, getMyDoctors);
router.get("/assignments/requests", requireUser, requireVerified, requireDoctorProductAccessIfDoctor, getDoctorLinkRequests);
router.patch("/assignments/requests/:patientId", requireUser, requireVerified, requireDoctorProductAccessIfDoctor, reviewDoctorLinkRequest);
// POST /api/doctors/assignments
router.post("/assignments", requireUser, requireVerified, assignPatientToDoctor);

// Profile & Workspace
router.get("/me/profile", requireUser, requireVerified, requireDoctorProductAccessIfDoctor, getDoctorProfile);
router.get("/patients/:patientId/workspace", requireUser, requireVerified, requireDoctorProductAccessIfDoctor, getPatientWorkspace);
router.get("/patients/:patientId/overview", requireUser, requireVerified, requireDoctorProductAccessIfDoctor, getPatientOverview);
router.get("/patients/:patientId/timeline", requireUser, requireVerified, requireDoctorProductAccessIfDoctor, getPatientTimeline);
router.get("/patients/:patientId/activity", requireUser, requireVerified, requireDoctorProductAccessIfDoctor, getPatientActivity);
router.get("/patients/:patientId/updates", requireUser, requireVerified, requireDoctorProductAccessIfDoctor, getPatientUpdates);


router.get("/application-status", requireUser, requireVerified, getDoctorApplicationStatus);

router.get("/review/applications", requireUser, requireVerified, requireReviewer, listDoctorApplications);
router.patch("/review/applications/:doctorId", requireUser, requireVerified, requireReviewer, reviewDoctorApplication);

export default router;
