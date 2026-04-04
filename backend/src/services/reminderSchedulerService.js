import { Reminder } from '../models/index.js';

function toDate(value) {
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function parseClock(value) {
  if (typeof value !== 'string') return null;
  const [h, m] = value.split(':').map(Number);
  if (!Number.isInteger(h) || !Number.isInteger(m)) return null;
  if (h < 0 || h > 23 || m < 0 || m > 59) return null;
  return { h, m };
}

class ReminderSchedulerService {
  static async replacePendingReminder({ userId, type, relatedId, scheduledAt }) {
    const when = toDate(scheduledAt);
    if (!when || when <= new Date()) return null;

    await Reminder.destroy({
      where: {
        userId,
        type,
        relatedId,
        status: 'pending',
      },
    });

    return Reminder.create({
      userId,
      type,
      relatedId,
      scheduledAt: when,
      status: 'pending',
    });
  }

  static async clearPendingReminders({ userId, type, relatedId }) {
    await Reminder.destroy({
      where: {
        userId,
        type,
        relatedId,
        status: 'pending',
      },
    });
  }

  static inferMedicationReminderTime(medication) {
    const leadMinutes = Number.isInteger(medication?.reminderLeadMinutes)
      ? medication.reminderLeadMinutes
      : 30;
    const now = new Date();

    const times = Array.isArray(medication?.scheduleJson?.times)
      ? medication.scheduleJson.times
      : [];

    for (let dayOffset = 0; dayOffset <= 2; dayOffset += 1) {
      const day = new Date(now);
      day.setHours(0, 0, 0, 0);
      day.setDate(day.getDate() + dayOffset);

      for (const t of times) {
        const parsed = parseClock(t);
        if (!parsed) continue;

        const doseAt = new Date(day);
        doseAt.setHours(parsed.h, parsed.m, 0, 0);

        const reminderAt = new Date(doseAt.getTime() - leadMinutes * 60 * 1000);
        if (reminderAt > now) {
          return reminderAt;
        }
      }
    }

    const fallbackDose = medication?.startDate ? new Date(`${medication.startDate}T09:00:00`) : new Date(now);
    if (fallbackDose <= now) {
      fallbackDose.setDate(now.getDate() + 1);
      fallbackDose.setHours(9, 0, 0, 0);
    }
    return new Date(fallbackDose.getTime() - leadMinutes * 60 * 1000);
  }

  static inferAppointmentReminderTime(appointment, leadMinutes = 120) {
    const start = toDate(appointment?.startsAt);
    if (!start) return null;
    return new Date(start.getTime() - leadMinutes * 60 * 1000);
  }

  static async scheduleMedicationReminder(medication) {
    if (!medication?.reminderEnabled) {
      await this.clearPendingReminders({
        userId: medication.patientId,
        type: 'medication',
        relatedId: medication.id,
      });
      return null;
    }

    const scheduledAt = this.inferMedicationReminderTime(medication);
    return this.replacePendingReminder({
      userId: medication.patientId,
      type: 'medication',
      relatedId: medication.id,
      scheduledAt,
    });
  }

  static async scheduleAppointmentReminder(appointment) {
    const leadMinutes = Number.parseInt(process.env.APPOINTMENT_REMINDER_LEAD_MINUTES || '120', 10);
    const scheduledAt = this.inferAppointmentReminderTime(
      appointment,
      Number.isInteger(leadMinutes) ? leadMinutes : 120
    );

    return this.replacePendingReminder({
      userId: appointment.patientId,
      type: 'appointment',
      relatedId: appointment.id,
      scheduledAt,
    });
  }
}

export default ReminderSchedulerService;