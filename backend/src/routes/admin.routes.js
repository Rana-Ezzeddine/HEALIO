import express from "express";
import requireUser from "../middleware/requireUser.js";
import requireVerified from "../middleware/requireVerified.js";
import requireAdmin from "../middleware/requireAdmin.js";
import {
  createAdminAccount,
  listAdminAccounts,
} from "../controllers/admin.controller.js";

const router = express.Router();

router.use(requireUser);
router.use(requireVerified);
router.use(requireAdmin);

router.get("/admins", listAdminAccounts);
router.post("/admins", createAdminAccount);

export default router;
