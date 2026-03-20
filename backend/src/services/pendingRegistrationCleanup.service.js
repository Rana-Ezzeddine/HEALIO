import { Op } from 'sequelize';
import PendingRegistration from '../models/PendingRegistration.js';
import PasswordResetToken from '../models/PasswordResetToken.js';

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
      const [deletedPendingRegistrations, deletedPasswordResetTokens] = await Promise.all([
        cleanupExpiredPendingRegistrations(),
        PasswordResetToken.destroy({
          where: {
            expiresAt: {
              [Op.lt]: new Date(),
            },
          },
        }),
      ]);

      if (deletedPendingRegistrations > 0) {
        console.log(`✓ Removed ${deletedPendingRegistrations} expired pending registrations`);
      }

      if (deletedPasswordResetTokens > 0) {
        console.log(`✓ Removed ${deletedPasswordResetTokens} expired password reset tokens`);
      }
    } catch (error) {
      console.error('Auth token cleanup failed:', error.message);
    }
  };

  runCleanup();
  const intervalId = setInterval(runCleanup, CLEANUP_INTERVAL_MS);

  return intervalId;
}
