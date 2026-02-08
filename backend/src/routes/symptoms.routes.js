import requireUser from "../middleware/requireUser.js";
import express from "express";

import {
    createSymptom,
    listSymptoms,
} from "../controllers/symptoms.controller.js";

const router = express.Router();
router.use(requireUser);

router.post("/", createSymptom);
router.get("/", listSymptoms);

export default router;