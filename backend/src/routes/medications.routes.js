import express from "express";
import requireUser from "../middleware/requireUser.js";
import requireVerified from "../middleware/requireVerified.js";
import requireRole from "../middleware/rbac.js";

import {
  getAllMedications,
  getMedicationById,
  createMedication,
  updateMedication,
  deleteMedication,
  searchMedications,
} from "../controllers/medications.controller.js";

const router = express.Router();

router.use(requireUser);
router.use(requireVerified);

router.get("/search/:query", searchMedications);
router.get("/", getAllMedications);
router.get("/:id", getMedicationById);
router.post("/", requireRole("patient", "doctor"), createMedication);
router.put("/:id", requireRole("patient", "doctor"), updateMedication);
router.delete("/:id", requireRole("patient", "doctor"), deleteMedication);

export default router;
