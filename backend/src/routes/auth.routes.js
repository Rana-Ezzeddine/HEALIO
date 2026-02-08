import express from "express";
import requireUser from "../middleware/requireUser.js";
const router = express.Router();

import {
    register,
    login,
    me
} from '../controllers/auth.controller.js'

// routes
router.post("/register", register);
router.post("/login", login);
router.get("/me", requireUser, me);

export default router;
