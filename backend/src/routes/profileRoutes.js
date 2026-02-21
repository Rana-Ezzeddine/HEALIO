import express from "express";
import requireUser from "../middleware/requireUser.js";
import requireRole from "../middleware/rbac.js";
import { postProfile, getMyProfile, getEmergencyCard } from "../controllers/profileController.js";

const router = express.Router();
router.use(requireUser);
router.use(requireRole("patient"));

router.get("/", getMyProfile);
router.post("/", postProfile);
router.get("/emergency-card", getEmergencyCard);

export default router;