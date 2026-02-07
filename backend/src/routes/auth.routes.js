const express = require("express");
const router = express.Router();

const authController = require("../controllers/auth.controller");
const requireUser = require("../middleware/requireUser");

// routes
router.post("/register", authController.register);
router.post("/login", authController.login);
router.get("/me", requireUser, authController.me);

module.exports = router;
