const requireUser = require("../middleware/requireUser");
const express = require("express");

const {
    createSymptom,
    listSymptoms,
} = require("../controllers/symptoms.controller");

const router = express.Router();
router.use(requireUser);

router.post("/", createSymptom);
router.get("/", listSymptoms);

module.exports = router;