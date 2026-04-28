import express from "express";
import requireUser from "../middleware/requireUser.js";
import requireRole from "../middleware/rbac.js";
import requireVerified from "../middleware/requireVerified.js";
import requireDoctorProductAccessIfDoctor from "../middleware/requireDoctorProductAccessIfDoctor.js";
import {
  createAppointment,
  createAppointmentRequest,
  getDoctorAvailability,
  getPatientDoctorAvailability,
  getDoctorSchedule,
  getMyAppointments,
  getRequestableDoctors,
  requestAppointmentReschedule,
  reviewAppointmentReschedule,
  updateAppointment,
  updateAppointmentStatus,
  suggestAlternativeSlot,
  markAppointmentComplete,
} from "../controllers/appointments.controller.js";

const router = express.Router();

router.use(requireUser);
router.use(requireVerified);
router.use(requireDoctorProductAccessIfDoctor);

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
router.post("/requests/:id/suggest-slot", requireRole("doctor"), suggestAlternativeSlot);
router.post("/:id/reschedule", requireRole("doctor", "patient"), requestAppointmentReschedule);
router.post("/:id/reschedule/review", requireRole("doctor", "patient", "caregiver"), reviewAppointmentReschedule);
router.post("/:id/complete", requireRole("doctor", "patient"), markAppointmentComplete);
router.patch("/:id/status", requireRole("doctor", "patient"), updateAppointmentStatus);

export default router;
