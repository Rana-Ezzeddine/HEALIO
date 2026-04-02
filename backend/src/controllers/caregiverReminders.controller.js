import Reminder from '../models/Reminder.js';
import CaregiverPatientPermission from '../models/CaregiverPatientPermission.js';
import User from '../models/User.js';

export async function getCaregiverPatientReminders(req, res) {
  try {
    if (req.user?.role !== 'caregiver') {
      return res.status(403).json({ message: 'Only caregivers can view this.' });
    }

    const caregiverId = req.user.id;
    const { patientId } = req.params;

    const link = await CaregiverPatientPermission.findOne({
      where: { caregiverId, patientId },
    });

    if (!link) {
      return res.status(403).json({ message: 'You are not linked to this patient.' });
    }

    if (!link.canReceiveReminders) {
      return res.status(403).json({
        message: 'You do not have permission to view reminders for this patient.',
      });
    }

    
    const reminders = await Reminder.findAll({
      where: {
        userId: patientId,
        status: 'pending',
      },
      order: [['scheduledAt', 'ASC']],
    });

    return res.json({
      patientId,
      caregiverId,
      count: reminders.length,
      reminders: reminders.map((r) => ({
        id: r.id,
        type: r.type,
        relatedId: r.relatedId,
        scheduledAt: r.scheduledAt,
        status: r.status,
      })),
    });
  } catch (err) {
    console.error('getCaregiverPatientReminders error:', err);
    return res.status(500).json({ message: 'Server error.' });
  }
}


export async function dismissReminder(req, res) {
  try {
    if (req.user?.role !== 'caregiver') {
      return res.status(403).json({ message: 'Only caregivers can acknowledge reminders.' });
    }

    const caregiverId = req.user.id;
    const { reminderId } = req.params;

    const reminder = await Reminder.findByPk(reminderId);
    if (!reminder) {
      return res.status(404).json({ message: 'Reminder not found.' });
    }

    const link = await CaregiverPatientPermission.findOne({
      where: { caregiverId, patientId: reminder.userId },
    });

    if (!link || !link.canReceiveReminders) {
      return res.status(403).json({
        message: 'You do not have permission to acknowledge reminders for this patient.',
      });
    }

    if (reminder.status === 'dismissed') {
      return res.status(409).json({ message: 'Reminder already dismissed.' });
    }

    await reminder.update({ status: 'dismissed' });

    return res.json({
      message: 'Reminder acknowledged.',
      reminder: {
        id: reminder.id,
        type: reminder.type,
        scheduledAt: reminder.scheduledAt,
        status: reminder.status, 
      },
    });
  } catch (err) {
    console.error('dismissReminder error:', err);
    return res.status(500).json({ message: 'Server error.' });
  }
}