import { Op } from 'sequelize';
import ActivityLog from '../models/ActivityLog.js';
import DoctorPatientAssignment from '../models/DoctorPatientAssignment.js';

export const getAuditLogs = async (req, res) => {
  try {
    const limit = Math.min(Number(req.query.limit || 50), 100);
    const offset = Math.max(Number(req.query.offset || 0), 0);
    const requestedUserId = req.query.userId || req.user.id;

    if (req.user.role !== 'doctor' && requestedUserId !== req.user.id) {
      return res.status(403).json({ message: 'Access denied.' });
    }

    if (req.user.role === 'doctor' && requestedUserId !== req.user.id) {
      const assignment = await DoctorPatientAssignment.findOne({
        where: {
          doctorId: req.user.id,
          patientId: requestedUserId,
          status: 'active',
        },
      });

      if (!assignment) {
        return res.status(403).json({ message: 'Doctor is not assigned to this patient.' });
      }
    }

    const where = { userId: requestedUserId };
    if (req.query.action) {
      where.action = { [Op.iLike]: `%${String(req.query.action)}%` };
    }

    const logs = await ActivityLog.findAndCountAll({
      where,
      order: [['createdAt', 'DESC']],
      limit,
      offset,
    });

    return res.status(200).json({
      total: logs.count,
      limit,
      offset,
      rows: logs.rows,
    });
  } catch (err) {
    console.error('Audit endpoint error:', err);
    return res.status(500).json({ message: 'Failed to fetch audit logs.' });
  }
};
