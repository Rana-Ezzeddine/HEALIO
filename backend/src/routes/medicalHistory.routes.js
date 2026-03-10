import express from "express";
import requireUser from "../middleware/requireUser.js";
import requireVerified from "../middleware/requireVerified.js";
import { getMyMedicalHistory } from "../controllers/medicalHistory.controller.js";

const router = express.Router();

// GET /api/medical-history/me
router.get("/me", requireUser, requireVerified, getMyMedicalHistory);

export default router;
