import express from "express";
import requireUser from "../middleware/requireUser.js";
import requireRole from "../middleware/rbac.js";
import {
  createAppointment,
  createAppointmentRequest,
  getDoctorAvailability,
  getPatientDoctorAvailability,
  getDoctorSchedule,
  getMyAppointments,
  getRequestableDoctors,
  updateAppointment,
  updateAppointmentStatus,
} from "../controllers/appointments.controller.js";

const router = express.Router();

router.use(requireUser);

// Shared (doctor + patient + caregiver can view their own side)
router.get("/mine", getMyAppointments);
router.get("/requestable-doctors", requireRole("patient"), getRequestableDoctors);
router.get("/requestable-doctors/:doctorId/availability", requireRole("patient"), getPatientDoctorAvailability);

// Doctor schedule APIs
router.get("/doctor/schedule", requireRole("doctor"), getDoctorSchedule);
router.get("/doctor/availability", requireRole("doctor"), getDoctorAvailability);
router.post("/", requireRole("doctor"), createAppointment);
router.post("/requests", requireRole("patient"), createAppointmentRequest);
router.put("/:id", requireRole("doctor"), updateAppointment);
router.patch("/:id/status", requireRole("doctor"), updateAppointmentStatus);

export default router;
