import express from "express";
import requireUser from "../middleware/requireUser.js";
import requireRole from "../middleware/rbac.js";
import {
    createCaregiverNote,
    updateCaregiverNote,
    getCaregiverNotesForPatient,
    getMyCaregiverNotes,
} from "../controllers/caregiverNotes.controller.js";

const router = express.Router();

router.use(requireUser);
router.use(requireRole("caregiver"));

router.post("/", createCaregiverNote);
router.patch("/:id", updateCaregiverNote);
router.get("/mine", getMyCaregiverNotes);
router.get("/patients/:patientId", getCaregiverNotesForPatient);

export default router;