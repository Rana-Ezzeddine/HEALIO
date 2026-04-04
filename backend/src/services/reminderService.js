import { Op } from 'sequelize';
import { Reminder, User, CaregiverPatientPermission, Medication, Appointment } from '../models/index.js';
import NotificationService from './notificationService.js';

/**
 * Reminder Service
 *
 * Handles logic for processing due reminders and dispatching notifications.
 */
class ReminderService {
  /**
   * Process all reminders that are 'pending' and whose 'scheduledAt' has passed.
   * This should be called by a background job or interval.
   */
  static async processDueReminders() {
    const now = new Date();
    
    // Find all pending reminders that are due
    const dueReminders = await Reminder.findAll({
      where: {
        status: 'pending',
        scheduledAt: {
          [Op.lte]: now,
        },
      },
      include: [
        {
          model: User,
          as: 'user',
          attributes: ['id', 'email', 'role'],
        },
      ],
    });

    console.log(`[ReminderService] Processing ${dueReminders.length} due reminders.`);

    for (const reminder of dueReminders) {
      await this.handleReminder(reminder);
    }
  }

  /**
   * Handle an individual reminder: send notifications and update status.
   */
  static async handleReminder(reminder) {
    try {
      const { userId, type, relatedId } = reminder;
      let notificationTitle = 'Reminder';
      let notificationMessage = 'You have a scheduled reminder.';
      let category = 'system_reminder';

      // 1. Determine notification content based on type
      if (type === 'medication') {
        const med = await Medication.findByPk(relatedId);
        notificationTitle = 'Medication Time';
        notificationMessage = med 
          ? `It's time to take your: ${med.name} (${med.dosage})` 
          : "It's time to take your medication.";
        category = 'medication_reminder';
      } else if (type === 'appointment') {
        const appt = await Appointment.findByPk(relatedId);
        notificationTitle = 'Upcoming Appointment';
        notificationMessage = appt 
          ? `You have an appointment scheduled at ${appt.startsAt.toLocaleString()}` 
          : "You have an upcoming appointment.";
        category = 'appointment_reminder';
      }

      // 2. Notify the patient
      await NotificationService.createWithContext(
        { type, relatedId },
        {
          userId,
          category,
          title: notificationTitle,
          message: notificationMessage,
          type: 'warning',
        }
      );

      // 3. Notify Caregivers (HEAL-119)
      const permissions = await CaregiverPatientPermission.findAll({
        where: {
          patientId: userId,
          status: 'active',
          canReceiveReminders: true,
        },
      });

      for (const permission of permissions) {
        await NotificationService.createNotification({
          userId: permission.caregiverId,
          category: `caregiver_${category}`,
          title: `Caregiver Alert: ${notificationTitle}`,
          message: `Your patient has a reminder: ${notificationMessage}`,
          type: 'info',
          metadata: { patientId: userId, reminderId: reminder.id },
        });
      }

      // 4. Update reminder status
      await reminder.update({
        status: 'sent',
        sentAt: new Date(),
      });

    } catch (err) {
      console.error(`[ReminderService] Error handling reminder ${reminder.id}:`, err);
    }
  }

  /**
   * Start a simple interval-based poller for reminders.
   * In a production app, this would be a cron job.
   */
  static startPoller(intervalMs = 60000) {
    console.log(`[ReminderService] Poller started with interval ${intervalMs}ms`);
    setInterval(() => {
      this.processDueReminders().catch(err => console.error('[ReminderService] Poller Error:', err));
    }, intervalMs);
  }
}

export default ReminderService;
