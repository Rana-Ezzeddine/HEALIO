import express from "express";
import requireUser from "../middleware/requireUser.js";
import {
  assignPatientToDoctor,
  getAssignedPatients,
  getDoctorDashboardOverview,
} from "../controllers/doctor.controller.js";

const router = express.Router();

// GET /api/doctors/assigned-patients
router.get("/assigned-patients", requireUser, getAssignedPatients);
// GET /api/doctors/dashboard-overview
router.get("/dashboard-overview", requireUser, getDoctorDashboardOverview);
// POST /api/doctors/assignments
router.post("/assignments", requireUser, assignPatientToDoctor);

export default router;
