import ActivityLog from '../models/ActivityLog.js';
import { transformLogs } from '../lib/activityFormatter.js';
import { Op } from 'sequelize';

/**
 * Activity History Controller
 *
 * Provides API support for retrieving and managing user activity history.
 */
export async function getMyActivityHistory(req, res) {
  try {
    const userId = req.user.id;
    const { from, to, limit = 50 } = req.query;

    const where = { userId };
    if (from || to) {
      where.createdAt = {};
      if (from) where.createdAt[Op.gte] = new Date(from);
      if (to) where.createdAt[Op.lte] = new Date(to);
    }

    const logs = await ActivityLog.findAll({
      where,
      limit: parseInt(limit, 10),
      order: [['createdAt', 'DESC']],
    });

    const activities = transformLogs(logs.map(log => log.toJSON()));

    return res.json({
      count: activities.length,
      activities,
    });
  } catch (err) {
    console.error('getMyActivityHistory error:', err);
    return res.status(500).json({ message: 'Failed to fetch activity history.' });
  }
}

/**
 * Optional: Get activity history for a specific patient (for caregivers/doctors).
 */
export async function getPatientActivityHistory(req, res) {
  // Logic to ensure role permissions (omitted for brevity, assume similar to getMyActivityHistory)
}
