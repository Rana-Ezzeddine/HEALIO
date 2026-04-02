import Appointment from '../models/Appointment.js';
import CaregiverPatientPermission from '../models/CaregiverPatientPermission.js';
import DoctorPatientAssignment from '../models/DoctorPatientAssignment.js';
import User from '../models/User.js';


export async function caregiverRequestAppointment(req, res) {
  try {
    if (req.user?.role !== 'caregiver') {
      return res.status(403).json({ message: 'Only caregivers can use this endpoint.' });
    }

    const caregiverId = req.user.id;
    const { patientId } = req.params;
    const { startsAt, endsAt, notes, location } = req.body || {};

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

    if (!startsAt || !endsAt) {
      return res.status(400).json({ message: 'startsAt and endsAt are required.' });
    }

    if (new Date(startsAt) >= new Date(endsAt)) {
      return res.status(400).json({ message: 'endsAt must be after startsAt.' });
    }

    const doctorAssignment = await DoctorPatientAssignment.findOne({
      where: { patientId, status: 'active' },
    });

    if (!doctorAssignment) {
      return res.status(400).json({
        message: 'Patient has no active doctor. An appointment cannot be requested without a linked doctor.',
      });
    }

    
    const appointment = await Appointment.create({
      patientId,
      doctorId: doctorAssignment.doctorId,
      startsAt: new Date(startsAt),
      endsAt: new Date(endsAt),
      status: 'scheduled',
      location: location || null,
      notes: typeof notes === 'string' ? notes.trim() : null,
    });

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