import { Notification, CommunicationContext } from '../models/index.js';

/**
 * Notification Service
 *
 * Centralized logic for triggering and managing notifications across the platform.
 */
class NotificationService {
  /**
   * Create a standard notification.
   *
   * @param {Object} options
   * @param {string} options.userId - Recipient of the notification.
   * @param {string} options.category - Categorization (e.g., 'appointment_update').
   * @param {string} options.title - Short summary.
   * @param {string} options.message - Detailed explanation.
   * @param {string} [options.type='info'] - Severity level (info, success, warning, error).
   * @param {string} [options.contextId] - Optional link to communication context.
   * @param {Object} [options.metadata={}] - Extra data.
   */
  static async createNotification({
    userId,
    category,
    title,
    message,
    type = 'info',
    contextId = null,
    metadata = {},
  }) {
    return await Notification.create({
      userId,
      category,
      title,
      message,
      type,
      contextId,
      metadata,
    });
  }

  /**
   * Create a context and nested notification in one go.
   *
   * @param {Object} options
   * @param {string} options.type - Context type (e.g., 'appointment').
   * @param {string} options.relatedId - ID of related entity.
   */
  static async createWithContext(contextOptions, notificationOptions) {
    const context = await CommunicationContext.create(contextOptions);
    return await this.createNotification({
      ...notificationOptions,
      contextId: context.id,
    });
  }

  /**
   * Notify a user about an appointment update.
   */
  static async notifyAppointmentUpdate(userId, appointmentId, reason) {
    return await this.createWithContext(
      { type: 'appointment', relatedId: appointmentId },
      {
        userId,
        category: 'appointment_update',
        title: 'Appointment Updated',
        message: `Your appointment status has changed: ${reason}`,
        type: 'info',
      }
    );
  }

  /**
   * Notify a user about a care-team approval event.
   */
  static async notifyCareTeamEvent(userId, careTeamInfo) {
    return await this.createNotification({
      userId,
      category: 'care_team_approval',
      title: 'Care Team Update',
      message: careTeamInfo.message,
      type: 'success',
      metadata: { careTeamId: careTeamInfo.id },
    });
  }

  /**
   * Notify a patient about a medication reminder.
   */
  static async notifyMedicationReminder(userId, medicationId, medName) {
    return await this.createWithContext(
      { type: 'medication', relatedId: medicationId },
      {
        userId,
        category: 'medication_reminder',
        title: 'Medication Time',
        message: `It's time to take your: ${medName}`,
        type: 'warning',
      }
    );
  }
}

export default NotificationService;
