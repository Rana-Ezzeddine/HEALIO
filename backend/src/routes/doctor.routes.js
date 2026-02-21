import express from "express";
import requireUser from "../middleware/requireUser.js";
import { getAssignedPatients } from "../controllers/doctor.controller.js";

const router = express.Router();

// GET /api/doctors/assigned-patients
router.get("/assigned-patients", requireUser, getAssignedPatients);

export default router;
