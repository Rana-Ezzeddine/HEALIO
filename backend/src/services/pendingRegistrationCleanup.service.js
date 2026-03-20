import { Op } from 'sequelize';
import PendingRegistration from '../models/PendingRegistration.js';

const CLEANUP_INTERVAL_MS = Number(process.env.PENDING_REGISTRATION_CLEANUP_INTERVAL_MS || 3600000);

export async function cleanupExpiredPendingRegistrations() {
  const deletedCount = await PendingRegistration.destroy({
    where: {
      expiresAt: {
        [Op.lt]: new Date(),
      },
    },
  });

  return deletedCount;
}

export function startPendingRegistrationCleanupJob() {
  const runCleanup = async () => {
    try {
      const deletedCount = await cleanupExpiredPendingRegistrations();

      if (deletedCount > 0) {
        console.log(`✓ Removed ${deletedCount} expired pending registrations`);
      }
    } catch (error) {
      console.error('Pending registration cleanup failed:', error.message);
    }
  };

  runCleanup();
  const intervalId = setInterval(runCleanup, CLEANUP_INTERVAL_MS);

  return intervalId;
}
