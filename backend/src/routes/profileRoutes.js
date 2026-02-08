import express from "express";
import requireUser from "../middleware/requireUser.js";
import { postProfile, getMyProfile, getEmergencyCard } from "../controllers/profileController.js";

const router = express.Router();
router.use(requireUser);

router.get("/", requireUser, getMyProfile);
router.post("/", requireUser, postProfile);
router.get("/emergency-card", requireUser, getEmergencyCard);

export default router;