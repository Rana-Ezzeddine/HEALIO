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
} from "../controllers/doctor.controller.js";
import {
  getDoctorApplicationStatus,
  listDoctorApplications,
  reviewDoctorApplication,
} from "../controllers/doctorReview.controller.js";

const router = express.Router();

// GET /api/doctors/assigned-patients
router.get("/assigned-patients", requireUser, requireVerified, requireDoctorProductAccessIfDoctor, getAssignedPatients);
// GET /api/doctors/dashboard-overview
router.get("/dashboard-overview", requireUser, requireVerified, requireDoctorProductAccessIfDoctor, getDoctorDashboardOverview);
// GET /api/doctors/assignments/mine
router.get("/assignments/mine", requireUser, requireVerified, getMyDoctors);
router.get("/assignments/requests", requireUser, requireVerified, requireDoctorProductAccessIfDoctor, getDoctorLinkRequests);
router.patch("/assignments/requests/:patientId", requireUser, requireVerified, requireDoctorProductAccessIfDoctor, reviewDoctorLinkRequest);
// POST /api/doctors/assignments
router.post("/assignments", requireUser, requireVerified, assignPatientToDoctor);
router.get("/application-status", requireUser, requireVerified, getDoctorApplicationStatus);
router.get("/review/applications", requireUser, requireVerified, requireReviewer, listDoctorApplications);
router.patch("/review/applications/:doctorId", requireUser, requireVerified, requireReviewer, reviewDoctorApplication);

export default router;
