import Appointment from '../models/Appointment.js';
import CaregiverPatientPermission from '../models/CaregiverPatientPermission.js';
import DoctorPatientAssignment from '../models/DoctorPatientAssignment.js';
import NotificationService from '../services/notificationService.js';
import { buildDoctorAvailability, ensureAppointmentSchemaReady } from './appointments.controller.js';


export async function caregiverRequestAppointment(req, res) {
  try {
    await ensureAppointmentSchemaReady();

    if (req.user?.role !== 'caregiver') {
      return res.status(403).json({ message: 'Only caregivers can use this endpoint.' });
    }

    const caregiverId = req.user.id;
    const { patientId } = req.params;
    const { doctorId, startsAt, endsAt, notes, location } = req.body || {};

    const link = await CaregiverPatientPermission.findOne({
      where: { caregiverId, patientId },
    });

    if (!link) {
      return res.status(403).json({ message: 'You are not linked to this patient.' });
    }

    if (!link.canViewAppointments) {
      return res.status(403).json({
        message: 'You do not have permission to manage appointments for this patient.',
      });
    }

    if (!doctorId) {
      return res.status(400).json({ message: 'doctorId is required.' });
    }

    if (!startsAt || !endsAt) {
      return res.status(400).json({ message: 'startsAt and endsAt are required.' });
    }

    const start = new Date(startsAt);
    const end = new Date(endsAt);

    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      return res.status(400).json({ message: 'startsAt and endsAt must be valid ISO date-times.' });
    }

    if (start >= end) {
      return res.status(400).json({ message: 'endsAt must be after startsAt.' });
    }

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    if (start < todayStart) {
      return res.status(400).json({ message: 'Cannot request appointments in the past.' });
    }

    const doctorAssignment = await DoctorPatientAssignment.findOne({
      where: { patientId, doctorId, status: 'active' },
    });

    if (!doctorAssignment) {
      return res.status(400).json({
        message: 'Selected doctor is not actively linked to this patient.',
      });
    }

    const slotMinutes = Math.round((end.getTime() - start.getTime()) / 60000);
    if (!Number.isInteger(slotMinutes) || slotMinutes <= 0) {
      return res.status(400).json({
        message: 'Requested appointment duration is invalid.',
      });
    }

    const slotFrom = new Date(start);
    slotFrom.setHours(0, 0, 0, 0);
    const slotTo = new Date(slotFrom);
    slotTo.setDate(slotTo.getDate() + 1);

    const availableSlots = await buildDoctorAvailability({
      doctorId: doctorAssignment.doctorId,
      from: slotFrom,
      to: slotTo,
      slotMinutes,
    });

    const isValidSlot = availableSlots.some(
      (slot) => slot.startsAt.getTime() === start.getTime() && slot.endsAt.getTime() === end.getTime()
    );

    if (!isValidSlot) {
      return res.status(400).json({
        message: 'Requested time does not match any available slots for this doctor.',
      });
    }

    const appointment = await Appointment.create({
      patientId,
      doctorId: doctorAssignment.doctorId,
      startsAt: start,
      endsAt: end,
      status: 'requested',
      requestSource: 'caregiver',
      location: location || null,
      notes: typeof notes === 'string' ? notes.trim() : null,
    });

    await NotificationService.createWithContext(
      { type: 'appointment', relatedId: appointment.id },
      {
        userId: doctorAssignment.doctorId,
        category: 'appointment_request',
        title: 'New Appointment Request',
        message: `A caregiver requested an appointment for a patient on ${start.toLocaleString()}`,
        type: 'info',
      }
    );

    return res.status(201).json({
      message: 'Appointment requested on behalf of patient.',
      requestedBy: 'caregiver',
      caregiverId,
      appointment: {
        id: appointment.id,
        patientId: appointment.patientId,
        doctorId: appointment.doctorId,
        startsAt: appointment.startsAt,
        endsAt: appointment.endsAt,
        status: appointment.status,
        location: appointment.location,
        notes: appointment.notes,
      },
    });
  } catch (err) {
    console.error('caregiverRequestAppointment error:', err);
    return res.status(500).json({ message: 'Server error.' });
  }
}