import User from '../models/User.js';
import {
  buildDoctorApprovalBlockedPayload,
  isApprovedDoctorUser,
} from '../lib/doctorApproval.js';

export default async function requireDoctorProductAccessIfDoctor(req, res, next) {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ message: 'Not authenticated.' });
    }

    const user = await User.findByPk(req.user.id, {
      attributes: [
        'id',
        'email',
        'role',
        'isVerified',
        'doctorApprovalStatus',
        'doctorApprovalNotes',
        'doctorApprovalRequestedInfoAt',
      ],
    });

    if (!user) {
      return res.status(401).json({ message: 'User not found.' });
    }

    req.user = {
      id: user.id,
      email: user.email,
      role: user.role,
      isVerified: user.isVerified,
      doctorApprovalStatus: user.doctorApprovalStatus,
      doctorApprovalNotes: user.doctorApprovalNotes,
      doctorApprovalRequestedInfoAt: user.doctorApprovalRequestedInfoAt,
    };

    if (user.role !== 'doctor') {
      return next();
    }

    if (isApprovedDoctorUser(user)) {
      return next();
    }

    const blocked = buildDoctorApprovalBlockedPayload(user);
    return res.status(blocked.status).json(blocked.body);
  } catch (err) {
    console.error('requireDoctorProductAccessIfDoctor error:', err);
    return res.status(500).json({ message: 'Failed to validate doctor approval status.' });
  }
}
