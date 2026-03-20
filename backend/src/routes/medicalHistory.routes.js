import express from "express";
import requireUser from "../middleware/requireUser.js";
import requireVerified from "../middleware/requireVerified.js";
import requireDoctorProductAccessIfDoctor from "../middleware/requireDoctorProductAccessIfDoctor.js";
import { getMyMedicalHistory } from "../controllers/medicalHistory.controller.js";

const router = express.Router();

// GET /api/medical-history/me
router.get("/me", requireUser, requireVerified, requireDoctorProductAccessIfDoctor, getMyMedicalHistory);

export default router;
