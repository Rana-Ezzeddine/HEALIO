import { Op } from "sequelize";
import Appointment from "../models/Appointment.js";
import User from "../models/User.js";
import DoctorPatientAssignment from "../models/DoctorPatientAssignment.js";

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

async function buildDoctorAvailability({
  doctorId,
  from,
  to,
  slotMinutes,
  startHour,
  endHour,
}) {
  const appointments = await Appointment.findAll({
    where: {
      doctorId,
      status: { [Op.in]: ["requested", "scheduled"] },
      startsAt: { [Op.lt]: to },
      endsAt: { [Op.gt]: from },
    },
    attributes: ["startsAt", "endsAt"],
    order: [["startsAt", "ASC"]],
  });

  const slots = [];
  const cursor = new Date(from);

  while (cursor < to) {
    const dayStart = new Date(cursor);
    dayStart.setHours(startHour, 0, 0, 0);

    const dayEnd = new Date(cursor);
    dayEnd.setHours(endHour, 0, 0, 0);

    if (dayEnd > from && dayStart < to) {
      const first = dayStart < from ? new Date(from) : dayStart;
      let slotStart = new Date(first);

      while (slotStart < dayEnd && slotStart < to) {
        const slotEnd = new Date(slotStart.getTime() + slotMinutes * 60 * 1000);
        if (slotEnd > dayEnd || slotEnd > to) break;

        const overlaps = appointments.some((a) => a.startsAt < slotEnd && a.endsAt > slotStart);

        if (!overlaps) {
          slots.push({
            startsAt: new Date(slotStart),
            endsAt: new Date(slotEnd),
          });
        }

        slotStart = slotEnd;
      }
    }

    cursor.setDate(cursor.getDate() + 1);
    cursor.setHours(0, 0, 0, 0);
  }

  return slots;
}

async function ensureDoctorUser(doctorId) {
  const doctor = await User.findByPk(doctorId);
  if (!doctor || doctor.role !== "doctor") {
    throw new Error("Invalid doctorId");
  }
}

async function hasDoctorConflict(doctorId, startsAt, endsAt, excludeAppointmentId = null) {
  const where = {
    doctorId,
    status: { [Op.in]: ["requested", "scheduled"] },
    startsAt: { [Op.lt]: endsAt },
    endsAt: { [Op.gt]: startsAt },
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

export async function getDoctorSchedule(req, res) {
  try {
    const doctorId = req.user.id;
    const { from, to } = parseRange(req);
    const includeCancelled = String(req.query.includeCancelled || "false").toLowerCase() === "true";

    const where = {
      doctorId,
      startsAt: { [Op.lt]: to },
      endsAt: { [Op.gt]: from },
    };

    if (!includeCancelled) {
      where.status = { [Op.in]: ["scheduled", "completed"] };
    }

    const appointments = await Appointment.findAll({
      where,
      include: [
        {
          model: User,
          as: "patient",
          attributes: ["id", "email"],
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
        patient: a.patient
          ? {
              id: a.patient.id,
              email: a.patient.email,
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
      location: typeof location === "string" ? location.trim() || null : null,
      notes: typeof notes === "string" ? notes.trim() || null : null,
      status: "scheduled",
    });

    return res.status(201).json(created);
  } catch (err) {
    const status = err.message?.includes("patient") || err.message?.includes("startsAt") ? 400 : 500;
    return res.status(status).json({ message: err.message || "Failed to create appointment." });
  }
}

export async function createAppointmentRequest(req, res) {
  try {
    const patientId = req.user.id;
    const { doctorId, startsAt, endsAt, location, notes } = req.body || {};

    if (!doctorId || !startsAt || !endsAt) {
      return res.status(400).json({
        message: "doctorId, startsAt, and endsAt are required",
      });
    }

    const start = parseISODate(startsAt, "startsAt");
    const end = parseISODate(endsAt, "endsAt");

    if (start >= end) {
      return res.status(400).json({ message: "startsAt must be before endsAt" });
    }

    if (start < new Date()) {
      return res.status(400).json({ message: "Cannot request appointments in the past" });
    }

    await ensureDoctorUser(doctorId);
    await validateDoctorPatientLink(doctorId, patientId);

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
      location: typeof location === "string" ? location.trim() || null : null,
      notes: typeof notes === "string" ? notes.trim() || null : null,
      status: "requested",
    });

    return res.status(201).json(created);
  } catch (err) {
    const status = err.message?.includes("doctor") || err.message?.includes("startsAt") ? 400 : 500;
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
      attributes: ["id", "email"],
      joinTableAttributes: [],
      through: { where: { status: "active" } },
    });

    return res.json({
      count: doctors.length,
      doctors: doctors.map((doctor) => ({
        id: doctor.id,
        email: doctor.email,
        displayName: buildDisplayName(doctor.email, null, null),
      })),
    });
  } catch (err) {
    return res.status(500).json({ message: err.message || "Failed to fetch requestable doctors." });
  }
}

export async function updateAppointment(req, res) {
  try {
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

    return res.json(appt);
  } catch (err) {
    const status = err.message?.includes("startsAt") ? 400 : 500;
    return res.status(status).json({ message: err.message || "Failed to update appointment." });
  }
}

export async function updateAppointmentStatus(req, res) {
  try {
    const doctorId = req.user.id;
    const { id } = req.params;
    const { status, notes } = req.body || {};
    const allowed = new Set(["requested", "scheduled", "cancelled", "completed", "denied"]);

    if (!allowed.has(status)) {
      return res.status(400).json({
        message: "status must be one of: requested, scheduled, cancelled, completed, denied",
      });
    }

    const appt = await Appointment.findOne({
      where: { id, doctorId },
    });
    if (!appt) {
      return res.status(404).json({ message: "Appointment not found" });
    }

    const transitions = {
      requested: new Set(["scheduled", "denied", "cancelled"]),
      scheduled: new Set(["completed", "cancelled"]),
      completed: new Set(),
      cancelled: new Set(),
      denied: new Set(),
    };

    if (!transitions[appt.status]?.has(status)) {
      return res.status(400).json({
        message: `Cannot change appointment status from ${appt.status} to ${status}`,
      });
    }

    await appt.update({
      status,
      notes: typeof notes === "string" ? notes.trim() || appt.notes : appt.notes,
    });
    return res.json(appt);
  } catch (err) {
    return res.status(500).json({ message: err.message || "Failed to update appointment status." });
  }
}

export async function getDoctorAvailability(req, res) {
  try {
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
      startHour,
      endHour,
    });

    return res.json({
      doctorId,
      from,
      to,
      slotMinutes,
      workingHours: { startHour, endHour },
      count: slots.length,
      slots,
    });
  } catch (err) {
    const status = err.message?.includes("from") || err.message?.includes("Range") ? 400 : 500;
    return res.status(status).json({ message: err.message || "Failed to fetch availability." });
  }
}

export async function getPatientDoctorAvailability(req, res) {
  try {
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
      startHour,
      endHour,
    });

    return res.json({
      doctorId,
      patientId,
      from,
      to,
      slotMinutes,
      workingHours: { startHour, endHour },
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
    const userId = req.user.id;
    const role = req.user.role;
    const where = role === "doctor" ? { doctorId: userId } : { patientId: userId };

    const appointments = await Appointment.findAll({
      where,
      include: [
        { model: User, as: "doctor", attributes: ["id", "email"] },
        { model: User, as: "patient", attributes: ["id", "email"] },
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
        location: a.location,
        notes: a.notes,
        doctor: a.doctor
          ? {
              id: a.doctor.id,
              email: a.doctor.email,
              displayName: buildDisplayName(a.doctor.email, null, null),
            }
          : null,
        patient: a.patient
          ? {
              id: a.patient.id,
              email: a.patient.email,
              displayName: buildDisplayName(a.patient.email, null, null),
            }
          : null,
      })),
    });
  } catch (err) {
    return res.status(500).json({ message: err.message || "Failed to fetch appointments." });
  }
}
