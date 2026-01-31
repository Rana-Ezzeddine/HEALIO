const express = require("express");
const requireUser = require("../middleware/requireUser");
const { postProfile, getMyProfile, getEmergencyCard } = require("../controllers/profileController");

const router = express.Router();

router.get("/", requireUser, getMyProfile);
router.post("/", requireUser, postProfile);
router.get("/emergency-card", requireUser, getEmergencyCard);

module.exports = router;