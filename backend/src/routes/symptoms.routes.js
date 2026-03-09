import requireUser from "../middleware/requireUser.js";
import requireVerified from "../middleware/requireVerified.js";
import requireRole from "../middleware/rbac.js";
import express from "express";

import {
    createSymptom,
    listSymptoms,
} from "../controllers/symptoms.controller.js";

const router = express.Router();
router.use(requireUser);
router.use(requireVerified);
router.use(requireRole("patient"));

router.post("/", createSymptom);
router.get("/", listSymptoms);

export default router;
