import { Op } from "sequelize";
import Appointment from "../models/Appointment.js";
import Availability from "../models/Availability.js";
import User from "../models/User.js";
import DoctorPatientAssignment from "../models/DoctorPatientAssignment.js";
import PatientProfile from "../models/PatientProfile.js";
import CaregiverPatientPermission from "../models/CaregiverPatientPermission.js";
import { DOCTOR_APPROVAL_STATUS, isApprovedDoctorUser } from "../lib/doctorApproval.js";
import NotificationService from "../services/notificationService.js";
import ContextService from "../services/ContextService.js";
import ReminderSchedulerService from "../services/reminderSchedulerService.js";

function parseISODate(value, fieldName) {
  const d = new Date(value);
  if (!value || Number.isNaN(d.getTime())) {
    throw new Error(`${fieldName} must be a valid ISO date-time`);
  }
  return d;
}

function parseRange(req) {
  const from = parseISODate(req.query.from, "from");
  const to = parseISODate(req.query.to, "to");
  if (from >= to) {
    throw new Error("from must be before to");
  }

  const days = (to - from) / (1000 * 60 * 60 * 24);
  if (days > 31) {
    throw new Error("Range cannot exceed 31 days");
  }

  return { from, to };
}

function toLocalDateKey(dateLike) {
  const date = new Date(dateLike);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

async function ensureAvailabilityTableReady() {
  try {
    await Availability.sequelize.getQueryInterface().describeTable(Availability.getTableName());
  } catch (error) {
    if (error?.original?.code === "42P01" || /does not exist/i.test(error?.message || "")) {
      await Availability.sync();
      return;
    }
    throw error;
  }
}

async function ensureAppointmentRequestSourceColumnReady() {
  const queryInterface = Appointment.sequelize.getQueryInterface();
  const table = await queryInterface.describeTable(Appointment.getTableName());
  if (!table.requestSource) {
    await queryInterface.addColumn(Appointment.getTableName(), "requestSource", {
      type: Appointment.sequelize.Sequelize.STRING,
      allowNull: true,
    });
  }
}

async function ensureAppointmentRescheduleColumnsReady() {
  const queryInterface = Appointment.sequelize.getQueryInterface();
  await Appointment.sequelize.query(`
    ALTER TYPE "enum_appointments_status" ADD VALUE IF NOT EXISTS 'reschedule_requested';
  `);
  const table = await queryInterface.describeTable(Appointment.getTableName());

  if (!table.proposedStartsAt) {
    await queryInterface.addColumn(Appointment.getTableName(), "proposedStartsAt", {
      type: Appointment.sequelize.Sequelize.DATE,
      allowNull: true,
    });
  }
  if (!table.proposedEndsAt) {
    await queryInterface.addColumn(Appointment.getTableName(), "proposedEndsAt", {
      type: Appointment.sequelize.Sequelize.DATE,
      allowNull: true,
    });
  }
  if (!table.proposedLocation) {
    await queryInterface.addColumn(Appointment.getTableName(), "proposedLocation", {
      type: Appointment.sequelize.Sequelize.STRING,
      allowNull: true,
    });
  }
  if (!table.rescheduleRequestedBy) {
    await queryInterface.addColumn(Appointment.getTableName(), "rescheduleRequestedBy", {
      type: Appointment.sequelize.Sequelize.STRING,
      allowNull: true,
    });
  }
  if (!table.rescheduleNotes) {
    await queryInterface.addColumn(Appointment.getTableName(), "rescheduleNotes", {
      type: Appointment.sequelize.Sequelize.TEXT,
      allowNull: true,
    });
  }
}

export async function ensureAppointmentSchemaReady() {
  await ensureAppointmentRequestSourceColumnReady();
  await ensureAppointmentRescheduleColumnsReady();
}

async function validateDoctorPatientLink(doctorId, patientId) {
  const assignment = await DoctorPatientAssignment.findOne({
    where: { doctorId, patientId, status: "active" },
  });

  if (!assignment) {
    throw new Error("Patient is not actively assigned to this doctor");
  }
}

async function ensurePatientUser(patientId) {
  const patient = await User.findByPk(patientId);
  if (!patient || patient.role !== "patient") {
    throw new Error("Invalid patientId");
  }
}

export async function buildDoctorAvailability({
  doctorId,
  from,
  to,
  slotMinutes,
}) {
  await ensureAvailabilityTableReady();
  await ensureAppointmentSchemaReady();

  const [availabilities, appointments] = await Promise.all([
    Availability.findAll({
      where: {
        doctorId,
        [Op.or]: [
          { type: 'workHours' },
          {
            type: { [Op.in]: ['break', 'blocked'] },
            specificDate: { [Op.between]: [from.toISOString().split('T')[0], to.toISOString().split('T')[0]] }
          }
        ]
      }
    }),
    Appointment.findAll({
      where: {
        doctorId,
        [Op.or]: [
          {
            status: { [Op.in]: ["requested", "scheduled", "reschedule_requested"] },
            startsAt: { [Op.lt]: to },
            endsAt: { [Op.gt]: from },
          },
          {
            status: "reschedule_requested",
            proposedStartsAt: { [Op.lt]: to },
            proposedEndsAt: { [Op.gt]: from },
          },
        ],
      },
      attributes: ["startsAt", "endsAt", "status", "proposedStartsAt", "proposedEndsAt"],
    })
  ]);

  const workHours = availabilities.filter(a => a.type === 'workHours');
  const blocks = availabilities.filter(a => a.type !== 'workHours');

  const slots = [];
  const cursor = new Date(from);
  cursor.setHours(0, 0, 0, 0);

  while (cursor < to) {
    const dayOfWeek = cursor.getDay();
    const dateStr = toLocalDateKey(cursor);
    
    // Find work hours for this day of week
    const todayWorkHours = workHours.filter(wh => wh.dayOfWeek === dayOfWeek);
    
    for (const wh of todayWorkHours) {
      let [startH, startM] = wh.startTime.split(':').map(Number);
      let [endH, endM] = wh.endTime.split(':').map(Number);

      const dayStart = new Date(cursor);
      dayStart.setHours(startH, startM, 0, 0);

      const dayEnd = new Date(cursor);
      dayEnd.setHours(endH, endM, 0, 0);

      // Only process if the work period overlaps with requested range [from, to]
      if (dayEnd > from && dayStart < to) {
        const actualStart = dayStart < from ? new Date(from) : dayStart;
        const actualEnd = dayEnd > to ? new Date(to) : dayEnd;
        
        let slotStart = new Date(actualStart);

        while (slotStart < actualEnd) {
          const slotEnd = new Date(slotStart.getTime() + slotMinutes * 60 * 1000);
          if (slotEnd > actualEnd) break;

          // Check for overlaps with appointments
          const hasApptOverlap = appointments.some((a) => {
            const originalOverlap = a.startsAt < slotEnd && a.endsAt > slotStart;
            const proposedOverlap =
              a.status === "reschedule_requested" &&
              a.proposedStartsAt &&
              a.proposedEndsAt &&
              a.proposedStartsAt < slotEnd &&
              a.proposedEndsAt > slotStart;
            return originalOverlap || proposedOverlap;
          });
          
          // Check for overlaps with breaks/blocked
          const hasBlockOverlap = blocks.some(b => {
             if (b.specificDate !== dateStr) return false;
             let [bSH, bSM] = b.startTime.split(':').map(Number);
             let [bEH, bEM] = b.endTime.split(':').map(Number);
             const bStart = new Date(cursor); bStart.setHours(bSH, bSM, 0, 0);
             const bEnd = new Date(cursor); bEnd.setHours(bEH, bEM, 0, 0);
             return bStart < slotEnd && bEnd > slotStart;
          });

          if (!hasApptOverlap && !hasBlockOverlap) {
            slots.push({
              startsAt: new Date(slotStart),
              endsAt: new Date(slotEnd),
            });
          }

          slotStart = slotEnd;
        }
      }
    }

    cursor.setDate(cursor.getDate() + 1);
    cursor.setHours(0, 0, 0, 0);
  }

  return slots;
}

async function ensureDoctorUser(doctorId) {
  const doctor = await User.findByPk(doctorId, {
    attributes: ["id", "email", "role", "doctorApprovalStatus"],
  });
  if (!doctor || doctor.role !== "doctor") {
    throw new Error("Invalid doctorId");
  }
  if (!isApprovedDoctorUser(doctor)) {
    throw new Error("Doctor is not currently available");
  }
}

async function hasDoctorConflict(doctorId, startsAt, endsAt, excludeAppointmentId = null) {
  await ensureAppointmentSchemaReady();
  const where = {
    doctorId,
    [Op.or]: [
      {
        status: { [Op.in]: ["requested", "scheduled", "reschedule_requested"] },
        startsAt: { [Op.lt]: endsAt },
        endsAt: { [Op.gt]: startsAt },
      },
      {
        status: "reschedule_requested",
        proposedStartsAt: { [Op.lt]: endsAt },
        proposedEndsAt: { [Op.gt]: startsAt },
      },
    ],
  };

  if (excludeAppointmentId) {
    where.id = { [Op.ne]: excludeAppointmentId };
  }

  const conflict = await Appointment.findOne({ where, attributes: ["id"] });
  return Boolean(conflict);
}

function buildDisplayName(email, firstName, lastName) {
  return [firstName, lastName].filter(Boolean).join(" ").trim() || email;
}

function parsePreferredRequestDate(value) {
  const normalized = String(value || "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
    throw new Error("preferredDate must be in YYYY-MM-DD format");
  }

  const parsed = new Date(`${normalized}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error("preferredDate must be a valid date");
  }

  return parsed;
}

function isDateOnlyRequestSlot(startsAt) {
  const date = new Date(startsAt);
  return date.getHours() === 0 && date.getMinutes() === 0;
}

export async function getDoctorSchedule(req, res) {
  try {
    await ensureAppointmentSchemaReady();
    const doctorId = req.user.id;
    const { from, to } = parseRange(req);
    const includeCancelled = String(req.query.includeCancelled || "false").toLowerCase() === "true";

    const where = {
      doctorId,
      startsAt: { [Op.lt]: to },
      endsAt: { [Op.gt]: from },
    };

    if (!includeCancelled) {
      where.status = { [Op.in]: ["scheduled", "completed", "reschedule_requested"] };
    }

    const appointments = await Appointment.findAll({
      where,
      include: [
        {
          model: User,
          as: "patient",
          attributes: ["id", "email"],
          include: [{ model: PatientProfile, as: "patientProfile", attributes: ["firstName", "lastName"] }],
        },
      ],
      order: [["startsAt", "ASC"]],
    });

    return res.json({
      doctorId,
      from,
      to,
      count: appointments.length,
      appointments: appointments.map((a) => ({
        id: a.id,
        patientId: a.patientId,
        startsAt: a.startsAt,
        endsAt: a.endsAt,
        location: a.location,
        status: a.status,
        notes: a.notes,
        proposedStartsAt: a.proposedStartsAt || null,
        proposedEndsAt: a.proposedEndsAt || null,
        proposedLocation: a.proposedLocation || null,
        rescheduleRequestedBy: a.rescheduleRequestedBy || null,
        rescheduleNotes: a.rescheduleNotes || null,
        patient: a.patient
          ? {
              id: a.patient.id,
              email: a.patient.email,
              displayName: buildDisplayName(
                a.patient.email,
                a.patient.patientProfile?.firstName,
                a.patient.patientProfile?.lastName
              ),
            }
          : null,
      })),
    });
  } catch (err) {
    const status = err.message?.includes("from") || err.message?.includes("Range") ? 400 : 500;
    return res.status(status).json({ message: err.message || "Failed to fetch doctor schedule." });
  }
}

export async function createAppointment(req, res) {
  try {
    await ensureAppointmentSchemaReady();
    const doctorId = req.user.id;
    const { patientId, startsAt, endsAt, location, notes } = req.body || {};

    if (!patientId || !startsAt || !endsAt) {
      return res.status(400).json({
        message: "patientId, startsAt, and endsAt are required",
      });
    }

    const start = parseISODate(startsAt, "startsAt");
    const end = parseISODate(endsAt, "endsAt");

    if (start >= end) {
      return res.status(400).json({ message: "startsAt must be before endsAt" });
    }

    if (start < new Date()) {
      return res.status(400).json({ message: "Cannot create appointments in the past" });
    }

    await ensurePatientUser(patientId);
    await validateDoctorPatientLink(doctorId, patientId);

    const preFill = await ContextService.getPreFillData(patientId, 'appointment');

    const conflict = await hasDoctorConflict(doctorId, start, end);
    if (conflict) {
      return res.status(409).json({
        message: "Doctor is not available in this time window",
      });
    }

    const created = await Appointment.create({
      doctorId,
      patientId,
      startsAt: start,
      endsAt: end,
      location:
        typeof location === "string"
          ? location.trim() || preFill.defaultLocation || null
          : preFill.defaultLocation || null,
      notes: typeof notes === "string" ? notes.trim() || null : null,
      status: "requested",
      requestSource: "doctor",
    });

    await NotificationService.notifyAppointmentUpdate(
      patientId,
      created.id,
      "Your doctor proposed a new appointment request for your review."
    );

    return res.status(201).json(created);
  } catch (err) {
    const status = err.message?.includes("patient") || err.message?.includes("startsAt") ? 400 : 500;
    return res.status(status).json({ message: err.message || "Failed to create appointment." });
  }
}

export async function createAppointmentRequest(req, res) {
  try {
    await ensureAppointmentSchemaReady();
    const patientId = req.user.id;
    const { doctorId, startsAt, endsAt, preferredDate, durationMinutes, location, notes } = req.body || {};

    if (!doctorId) {
      return res.status(400).json({
        message: "doctorId is required",
      });
    }

    let start;
    let end;
    let slotMinutes;

    if (startsAt && endsAt) {
      start = parseISODate(startsAt, "startsAt");
      end = parseISODate(endsAt, "endsAt");
      slotMinutes = Math.round((end.getTime() - start.getTime()) / 60000);
    } else {
      if (!preferredDate || !durationMinutes) {
        return res.status(400).json({
          message: "Either startsAt/endsAt or preferredDate/durationMinutes are required",
        });
      }

      start = parsePreferredRequestDate(preferredDate);
      slotMinutes = Number(durationMinutes);
      if (!Number.isInteger(slotMinutes) || slotMinutes <= 0) {
        return res.status(400).json({
          message: "durationMinutes must be a positive integer",
        });
      }
      end = new Date(start.getTime() + slotMinutes * 60000);
    }

    if (start >= end) {
      return res.status(400).json({ message: "startsAt must be before endsAt" });
    }

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    if (start < todayStart) {
      return res.status(400).json({ message: "Cannot request appointments in the past" });
    }

    await ensureDoctorUser(doctorId);
    await validateDoctorPatientLink(doctorId, patientId);

    const preFill = await ContextService.getPreFillData(patientId, 'appointment');

    if (!isDateOnlyRequestSlot(start)) {
      const slotFrom = new Date(start);
      slotFrom.setHours(0, 0, 0, 0);
      const slotTo = new Date(slotFrom);
      slotTo.setDate(slotTo.getDate() + 1);

      if (!Number.isInteger(slotMinutes) || slotMinutes <= 0) {
        return res.status(400).json({
          message: "Requested appointment duration is invalid",
        });
      }

      const availableSlots = await buildDoctorAvailability({
        doctorId,
        from: slotFrom,
        to: slotTo,
        slotMinutes,
      });

      const isValidSlot = availableSlots.some(
        (s) => s.startsAt.getTime() === start.getTime() && s.endsAt.getTime() === end.getTime()
      );

      if (!isValidSlot) {
        return res.status(400).json({
          message: "Requested time does not match any available slots for this doctor",
        });
      }

      const conflict = await hasDoctorConflict(doctorId, start, end);
      if (conflict) {
        return res.status(409).json({
          message: "Doctor is not available in this time window",
        });
      }
    }

    const created = await Appointment.create({
      doctorId,
      patientId,
      startsAt: start,
      endsAt: end,
      location:
        typeof location === "string"
          ? location.trim() || preFill.defaultLocation || null
          : preFill.defaultLocation || null,
      notes: typeof notes === "string" ? notes.trim() || null : null,
      status: "requested",
      requestSource: "patient",
    });

    await NotificationService.createWithContext(
      { type: 'appointment', relatedId: created.id },
      {
        userId: doctorId,
        category: 'appointment_request',
        title: 'New Appointment Request',
        message: isDateOnlyRequestSlot(start)
          ? `A patient has requested an appointment on ${start.toLocaleDateString()} and needs you to choose a slot.`
          : `A patient has requested an appointment on ${start.toLocaleString()}`,
        type: 'info',
      }
    );

    return res.status(201).json(created);
  } catch (err) {
    const status = err.message?.includes("doctor") || err.message?.includes("startsAt") || err.message?.includes("preferredDate") ? 400 : 500;
    return res.status(status).json({ message: err.message || "Failed to create appointment request." });
  }
}

export async function getRequestableDoctors(req, res) {
  try {
    const patientId = req.user.id;
    const patient = await User.findByPk(patientId);
    if (!patient) {
      return res.status(404).json({ message: "Patient not found." });
    }

    const doctors = await patient.getDoctors({
      attributes: ["id", "email", "role", "doctorApprovalStatus"],
      include: [{ model: PatientProfile, as: "patientProfile", attributes: ["firstName", "lastName"] }],
      joinTableAttributes: [],
      through: { where: { status: "active" } },
    });

    return res.json({
      count: doctors.filter((doctor) => isApprovedDoctorUser(doctor)).length,
      doctors: doctors.filter((doctor) => isApprovedDoctorUser(doctor)).map((doctor) => ({
        id: doctor.id,
        email: doctor.email,
        displayName: buildDisplayName(
          doctor.email,
          doctor.patientProfile?.firstName,
          doctor.patientProfile?.lastName
        ),
      })),
    });
  } catch (err) {
    return res.status(500).json({ message: err.message || "Failed to fetch requestable doctors." });
  }
}

export async function updateAppointment(req, res) {
  try {
    await ensureAppointmentSchemaReady();
    const doctorId = req.user.id;
    const { id } = req.params;
    const { startsAt, endsAt, location, notes } = req.body || {};

    const appt = await Appointment.findOne({
      where: { id, doctorId },
    });

    if (!appt) {
      return res.status(404).json({ message: "Appointment not found" });
    }

    if (appt.status !== "scheduled") {
      return res.status(400).json({
        message: "Only scheduled appointments can be updated",
      });
    }

    const nextStart = startsAt ? parseISODate(startsAt, "startsAt") : appt.startsAt;
    const nextEnd = endsAt ? parseISODate(endsAt, "endsAt") : appt.endsAt;

    if (nextStart >= nextEnd) {
      return res.status(400).json({ message: "startsAt must be before endsAt" });
    }

    const conflict = await hasDoctorConflict(doctorId, nextStart, nextEnd, appt.id);
    if (conflict) {
      return res.status(409).json({
        message: "Doctor is not available in this time window",
      });
    }

    await appt.update({
      startsAt: nextStart,
      endsAt: nextEnd,
      location: typeof location === "string" ? location.trim() || null : appt.location,
      notes: typeof notes === "string" ? notes.trim() || null : appt.notes,
    });

    await ReminderSchedulerService.scheduleAppointmentReminder(appt);
    await NotificationService.notifyAppointmentUpdate(appt.patientId, appt.id, "Your appointment details (time or location) have been updated.");

    return res.json(appt);
  } catch (err) {
    const status = err.message?.includes("startsAt") ? 400 : 500;
    return res.status(status).json({ message: err.message || "Failed to update appointment." });
  }
}

export async function updateAppointmentStatus(req, res) {
  try {
    await ensureAppointmentSchemaReady();
    const actorId = req.user.id;
    const actorRole = req.user.role;
    const { id } = req.params;
    const { status, notes } = req.body || {};
    const allowed = new Set(["requested", "scheduled", "cancelled", "completed", "denied"]);

    if (!allowed.has(status)) {
      return res.status(400).json({
        message: "status must be one of: requested, scheduled, cancelled, completed, denied",
      });
    }

    const appt = await Appointment.findOne({ where: { id } });
    if (!appt) {
      return res.status(404).json({ message: "Appointment not found" });
    }

    const requestSource = appt.requestSource || "patient";
    const isDoctorActor = actorRole === "doctor" && appt.doctorId === actorId;
    const isPatientActor = actorRole === "patient" && appt.patientId === actorId;
    if (!isDoctorActor && !isPatientActor) {
      return res.status(403).json({ message: "You are not allowed to update this appointment." });
    }

    if (appt.status === "requested") {
      if (requestSource === "patient" && !isDoctorActor) {
        return res.status(403).json({ message: "Only the doctor can review a patient-created appointment request." });
      }
      if (requestSource === "doctor" && !isPatientActor) {
        return res.status(403).json({ message: "Only the patient can review a doctor-created appointment request." });
      }
    }

    const transitionsByRole = {
      doctor: {
        requested: new Set(["scheduled", "denied", "cancelled"]),
        reschedule_requested: new Set(),
        scheduled: new Set(["completed", "cancelled"]),
        completed: new Set(),
        cancelled: new Set(),
        denied: new Set(),
      },
      patient: {
        requested: new Set(["scheduled", "denied", "cancelled"]),
        reschedule_requested: new Set(),
        scheduled: new Set(["cancelled"]),
        completed: new Set(),
        cancelled: new Set(),
        denied: new Set(),
      },
    };

    const transitionRole = isDoctorActor ? "doctor" : "patient";
    const transitions = transitionsByRole[transitionRole] || {
      requested: new Set(),
      scheduled: new Set(),
      completed: new Set(),
      cancelled: new Set(),
      denied: new Set(),
    };

    if (!transitions[appt.status]?.has(status)) {
      return res.status(400).json({
        message: `Cannot change appointment status from ${appt.status} to ${status}`,
      });
    }

    if (status === "scheduled") {
      const conflict = await hasDoctorConflict(appt.doctorId, appt.startsAt, appt.endsAt, appt.id);
      if (conflict) {
        return res.status(409).json({
          message: "Doctor is no longer available in this time window (schedule conflict)",
        });
      }
    }

    await appt.update({
      status,
      notes: typeof notes === "string" ? notes.trim() || appt.notes : appt.notes,
    });

    if (status === 'scheduled') {
      await ReminderSchedulerService.scheduleAppointmentReminder(appt);
    }

    if (status === 'cancelled' || status === 'completed' || status === 'denied') {
      await ReminderSchedulerService.clearPendingReminders({
        userId: appt.patientId,
        type: 'appointment',
        relatedId: appt.id,
      });
    }

    if (isDoctorActor) {
      await NotificationService.notifyAppointmentUpdate(appt.patientId, appt.id, `Your appointment status has been updated to ${status}.`);
    } else if (isPatientActor) {
      await NotificationService.notifyAppointmentUpdate(appt.doctorId, appt.id, `A patient has updated the appointment status to ${status}.`);
    }

    return res.json(appt);
  } catch (err) {
    return res.status(500).json({ message: err.message || "Failed to update appointment status." });
  }
}

export async function getDoctorAvailability(req, res) {
  try {
    await ensureAppointmentSchemaReady();
    const doctorId = req.user.id;
    const { from, to } = parseRange(req);
    const slotMinutes = Number(req.query.slotMinutes || 30);
    const startHour = Number(req.query.startHour || 9);
    const endHour = Number(req.query.endHour || 17);

    if (!Number.isInteger(slotMinutes) || slotMinutes <= 0 || slotMinutes > 240) {
      return res.status(400).json({ message: "slotMinutes must be an integer between 1 and 240" });
    }
    if (
      !Number.isInteger(startHour) ||
      !Number.isInteger(endHour) ||
      startHour < 0 ||
      endHour > 24 ||
      startHour >= endHour
    ) {
      return res.status(400).json({ message: "startHour/endHour are invalid" });
    }

    const slots = await buildDoctorAvailability({
      doctorId,
      from,
      to,
      slotMinutes,
    });

    return res.json({
      doctorId,
      from,
      to,
      slotMinutes,
      count: slots.length,
      slots,
    });
  } catch (err) {
    const status = err.message?.includes("from") || err.message?.includes("Range") ? 400 : 500;
    return res.status(status).json({ message: err.message || "Failed to fetch availability." });
  }
}

export async function suggestAlternativeSlot(req, res) {
  try {
    await ensureAppointmentSchemaReady();
    const doctorId = req.user.id;
    const { id } = req.params;
    const { startsAt, endsAt, notes } = req.body || {};

    if (!startsAt || !endsAt) {
      return res.status(400).json({ message: "startsAt and endsAt are required" });
    }

    const start = parseISODate(startsAt, "startsAt");
    const end = parseISODate(endsAt, "endsAt");

    if (start >= end) {
      return res.status(400).json({ message: "startsAt must be before endsAt" });
    }

    const appt = await Appointment.findOne({
      where: { id, doctorId, status: "requested" },
    });

    if (!appt) {
      return res.status(404).json({ message: "Appointment request not found" });
    }

    const conflict = await hasDoctorConflict(doctorId, start, end, appt.id);
    if (conflict) {
      return res.status(409).json({
        message: "Doctor has a conflict in the suggested time window",
      });
    }

    await appt.update({
      startsAt: start,
      endsAt: end,
      notes: notes ? `Suggesting alternative: ${notes}` : appt.notes,
      // Keep status as requested, but doctor has updated the time
    });

    return res.json(appt);
  } catch (err) {
    const status = err.message?.includes("startsAt") ? 400 : 500;
    return res.status(status).json({ message: err.message || "Failed to suggest alternative slot." });
  }
}

export async function getPatientDoctorAvailability(req, res) {
  try {
    await ensureAppointmentSchemaReady();
    const patientId = req.user.id;
    const doctorId = req.params.doctorId;
    const { from, to } = parseRange(req);
    const slotMinutes = Number(req.query.slotMinutes || 30);
    const startHour = Number(req.query.startHour || 9);
    const endHour = Number(req.query.endHour || 17);

    if (!Number.isInteger(slotMinutes) || slotMinutes <= 0 || slotMinutes > 240) {
      return res.status(400).json({ message: "slotMinutes must be an integer between 1 and 240" });
    }
    if (
      !Number.isInteger(startHour) ||
      !Number.isInteger(endHour) ||
      startHour < 0 ||
      endHour > 24 ||
      startHour >= endHour
    ) {
      return res.status(400).json({ message: "startHour/endHour are invalid" });
    }

    await ensureDoctorUser(doctorId);
    await validateDoctorPatientLink(doctorId, patientId);

    const slots = await buildDoctorAvailability({
      doctorId,
      from,
      to,
      slotMinutes,
    });

    return res.json({
      doctorId,
      patientId,
      from,
      to,
      slotMinutes,
      count: slots.length,
      slots,
    });
  } catch (err) {
    const status =
      err.message?.includes("doctor") ||
      err.message?.includes("patient") ||
      err.message?.includes("from") ||
      err.message?.includes("Range")
        ? 400
        : 500;
    return res.status(status).json({ message: err.message || "Failed to fetch availability." });
  }
}

export async function getMyAppointments(req, res) {
  try {
    await ensureAppointmentSchemaReady();
    const userId = req.user.id;
    const role = req.user.role;
    const where = role === "doctor" ? { doctorId: userId } : { patientId: userId };

    const appointments = await Appointment.findAll({
      where,
      include: [
        {
          model: User,
          as: "doctor",
          attributes: ["id", "email"],
          include: [{ model: PatientProfile, as: "patientProfile", attributes: ["firstName", "lastName"] }],
        },
        {
          model: User,
          as: "patient",
          attributes: ["id", "email"],
          include: [{ model: PatientProfile, as: "patientProfile", attributes: ["firstName", "lastName"] }],
        },
      ],
      order: [["startsAt", "ASC"]],
      limit: 200,
    });

    return res.json({
      count: appointments.length,
      appointments: appointments.map((a) => ({
        id: a.id,
        startsAt: a.startsAt,
        endsAt: a.endsAt,
        status: a.status,
        requestSource: a.requestSource || null,
        location: a.location,
        notes: a.notes,
        proposedStartsAt: a.proposedStartsAt || null,
        proposedEndsAt: a.proposedEndsAt || null,
        proposedLocation: a.proposedLocation || null,
        rescheduleRequestedBy: a.rescheduleRequestedBy || null,
        rescheduleNotes: a.rescheduleNotes || null,
        doctor: a.doctor
          ? {
              id: a.doctor.id,
              email: a.doctor.email,
              displayName: buildDisplayName(
                a.doctor.email,
                a.doctor.patientProfile?.firstName,
                a.doctor.patientProfile?.lastName
              ),
            }
          : null,
        patient: a.patient
          ? {
              id: a.patient.id,
              email: a.patient.email,
              displayName: buildDisplayName(
                a.patient.email,
                a.patient.patientProfile?.firstName,
                a.patient.patientProfile?.lastName
              ),
            }
          : null,
      })),
    });
  } catch (err) {
    return res.status(500).json({ message: err.message || "Failed to fetch appointments." });
  }
}

export async function requestAppointmentReschedule(req, res) {
  try {
    await ensureAppointmentSchemaReady();
    const actorId = req.user.id;
    const actorRole = req.user.role;
    const { id } = req.params;
    const { startsAt, endsAt, location, notes } = req.body || {};

    if (!startsAt || !endsAt) {
      return res.status(400).json({ message: "startsAt and endsAt are required." });
    }

    const start = parseISODate(startsAt, "startsAt");
    const end = parseISODate(endsAt, "endsAt");

    if (start >= end) {
      return res.status(400).json({ message: "startsAt must be before endsAt" });
    }
    if (start < new Date()) {
      return res.status(400).json({ message: "Cannot reschedule into the past" });
    }

    const appt = await Appointment.findByPk(id);
    if (!appt) {
      return res.status(404).json({ message: "Appointment not found" });
    }

    const isDoctorActor = actorRole === "doctor" && appt.doctorId === actorId;
    const isPatientActor = actorRole === "patient" && appt.patientId === actorId;
    if (!isDoctorActor && !isPatientActor) {
      return res.status(403).json({ message: "You are not allowed to reschedule this appointment." });
    }
    if (appt.status !== "scheduled") {
      return res.status(400).json({ message: "Only scheduled appointments can be rescheduled." });
    }

    const conflict = await hasDoctorConflict(appt.doctorId, start, end, appt.id);
    if (conflict) {
      return res.status(409).json({ message: "Doctor is not available in this time window" });
    }

    await appt.update({
      status: "reschedule_requested",
      proposedStartsAt: start,
      proposedEndsAt: end,
      proposedLocation: typeof location === "string" ? location.trim() || appt.location : appt.location,
      rescheduleRequestedBy: actorRole,
      rescheduleNotes: typeof notes === "string" ? notes.trim() || null : null,
    });

    const recipientId = isDoctorActor ? appt.patientId : appt.doctorId;
    const requesterLabel = isDoctorActor ? "doctor" : "patient";
    await NotificationService.notifyAppointmentUpdate(
      recipientId,
      appt.id,
      `A ${requesterLabel} requested to reschedule this appointment for ${start.toLocaleString()}.`
    );

    return res.json(appt);
  } catch (err) {
    const status = err.message?.includes("startsAt") ? 400 : 500;
    return res.status(status).json({ message: err.message || "Failed to request appointment reschedule." });
  }
}

export async function reviewAppointmentReschedule(req, res) {
  try {
    await ensureAppointmentSchemaReady();
    const actorId = req.user.id;
    const actorRole = req.user.role;
    const { id } = req.params;
    const decision = String(req.body?.decision || "").trim().toLowerCase();
    const note = String(req.body?.note || "").trim();

    if (!["approve", "deny"].includes(decision)) {
      return res.status(400).json({ message: "decision must be approve or deny" });
    }

    const appt = await Appointment.findByPk(id);
    if (!appt) {
      return res.status(404).json({ message: "Appointment not found" });
    }
    if (appt.status !== "reschedule_requested") {
      return res.status(400).json({ message: "This appointment has no pending reschedule request." });
    }

    const isDoctorActor = actorRole === "doctor" && appt.doctorId === actorId;
    const isPatientActor = actorRole === "patient" && appt.patientId === actorId;
    
    // Check if caregiver has permission to manage this patient's appointments
    let isCaregiverActor = false;
    if (actorRole === "caregiver") {
      const caregiverPerm = await CaregiverPatientPermission.findOne({
        where: {
          caregiverId: actorId,
          patientId: appt.patientId,
          canViewAppointments: true
        }
      });
      isCaregiverActor = !!caregiverPerm;
    }
    
    if (!isDoctorActor && !isPatientActor && !isCaregiverActor) {
      return res.status(403).json({ message: "You are not allowed to review this reschedule request." });
    }
    
    // Only the party that did NOT request the reschedule can review it
    // Caregiver acts on behalf of patient, so if doctor requested, caregiver can approve/deny
    if ((appt.rescheduleRequestedBy === "doctor" && isDoctorActor) || (appt.rescheduleRequestedBy === "patient" && isPatientActor)) {
      return res.status(403).json({ message: "The other party must review this reschedule request." });
    }

    if (decision === "approve") {
      const conflict = await hasDoctorConflict(appt.doctorId, appt.proposedStartsAt, appt.proposedEndsAt, appt.id);
      if (conflict) {
        return res.status(409).json({ message: "Doctor is no longer available in the proposed time window." });
      }

      await appt.update({
        startsAt: appt.proposedStartsAt,
        endsAt: appt.proposedEndsAt,
        location: appt.proposedLocation || appt.location,
        status: "scheduled",
        proposedStartsAt: null,
        proposedEndsAt: null,
        proposedLocation: null,
        rescheduleRequestedBy: null,
        rescheduleNotes: null,
      });

      await ReminderSchedulerService.scheduleAppointmentReminder(appt);
      // Determine who to notify: if doctor or caregiver acted, notify patient; if patient acted, notify doctor
      const recipientId = (isDoctorActor || isCaregiverActor) ? appt.patientId : appt.doctorId;
      await NotificationService.notifyAppointmentUpdate(
        recipientId,
        appt.id,
        `The reschedule request was approved. The appointment is now set for ${appt.startsAt.toLocaleString()}.`
      );
    } else {
      await appt.update({
        status: "scheduled",
        proposedStartsAt: null,
        proposedEndsAt: null,
        proposedLocation: null,
        rescheduleRequestedBy: null,
        rescheduleNotes: null,
      });

      // Determine who to notify: if doctor or caregiver acted, notify patient; if patient acted, notify doctor
      const recipientId = (isDoctorActor || isCaregiverActor) ? appt.patientId : appt.doctorId;
      await NotificationService.notifyAppointmentUpdate(
        recipientId,
        appt.id,
        note || "The reschedule request was declined and the original appointment remains unchanged."
      );
    }

    return res.json(appt);
  } catch (err) {
    return res.status(500).json({ message: err.message || "Failed to review appointment reschedule." });
  }
}

export async function markAppointmentComplete(req, res) {
  try {
    await ensureAppointmentSchemaReady();
    const actorId = req.user.id;
    const actorRole = req.user.role;
    const { id } = req.params;

    const appt = await Appointment.findByPk(id);
    if (!appt) {
      return res.status(404).json({ message: "Appointment not found" });
    }

    const isDoctorActor = actorRole === "doctor" && appt.doctorId === actorId;
    const isPatientActor = actorRole === "patient" && appt.patientId === actorId;

    // Only doctor or patient can mark as complete
    if (!isDoctorActor && !isPatientActor) {
      return res.status(403).json({ message: "You are not allowed to mark this appointment as complete." });
    }

    if (appt.status === "completed") {
      return res.status(400).json({ message: "This appointment is already marked as completed." });
    }

    // Only scheduled or requested appointments can be marked complete
    if (!["scheduled", "requested"].includes(appt.status)) {
      return res.status(400).json({ message: "Only scheduled or requested appointments can be marked complete." });
    }

    await appt.update({ status: "completed" });
    return res.json(appt);
  } catch (err) {
    return res.status(500).json({ message: err.message || "Failed to mark appointment as complete." });
  }
}
