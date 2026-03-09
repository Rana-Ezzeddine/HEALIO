import sequelize from '../../database.js';
import PatientProfile from '../models/PatientProfile.js';
import User from '../models/User.js';
import { sendDoctorEmergencyAlert } from '../services/mail.service.js';

export const setEmergencyStatus = async (req, res) => {
  try {
    if (req.user?.role !== 'patient') {
      return res.status(403).json({ message: 'Only patients can update emergency status.' });
    }

    const { isEmergency } = req.body || {};
    if (typeof isEmergency !== 'boolean') {
      return res.status(400).json({ message: 'isEmergency must be a boolean.' });
    }

    const [profile] = await PatientProfile.findOrCreate({
      where: { userId: req.user.id },
      defaults: { userId: req.user.id },
    });

    profile.emergencyStatus = isEmergency;
    profile.emergencyStatusUpdatedAt = new Date();
    await profile.save();

    req.setActivity?.('emergency.status.updated', {
      isEmergency,
      updatedAt: profile.emergencyStatusUpdatedAt,
    });

    return res.status(200).json({
      message: 'Emergency status updated.',
      emergencyStatus: profile.emergencyStatus,
      emergencyStatusUpdatedAt: profile.emergencyStatusUpdatedAt,
    });
  } catch (err) {
    console.error('setEmergencyStatus error:', err);
    return res.status(500).json({ message: 'Failed to update emergency status.' });
  }
};

export const triggerDoctorAlert = async (req, res) => {
  try {
    if (req.user?.role !== 'patient') {
      return res.status(403).json({ message: 'Only patients can trigger doctor alerts.' });
    }

    const reason = typeof req.body?.reason === 'string' ? req.body.reason.trim() : '';

    const [profile] = await PatientProfile.findOrCreate({
      where: { userId: req.user.id },
      defaults: { userId: req.user.id },
    });

    profile.emergencyStatus = true;
    profile.emergencyStatusUpdatedAt = new Date();
    await profile.save();

    const [rows] = await sequelize.query(
      `
      SELECT u.email
      FROM doctor_patient_assignments dpa
      JOIN users u ON u.id = dpa."doctorId"
      WHERE dpa."patientId" = :patientId
        AND dpa.status = 'active'
        AND u.role = 'doctor'
      `,
      {
        replacements: { patientId: req.user.id },
      }
    );

    const patient = await User.findByPk(req.user.id, {
      attributes: ['id', 'email'],
    });

    let sentCount = 0;
    for (const row of rows) {
      const result = await sendDoctorEmergencyAlert({
        to: row.email,
        patientEmail: patient?.email || req.user.id,
        reason: reason || 'No additional reason provided.',
      });

      if (!result?.skipped) sentCount += 1;
    }

    req.setActivity?.('emergency.alert.triggered', {
      assignedDoctors: rows.length,
      alertsSent: sentCount,
    });

    return res.status(200).json({
      message: 'Emergency doctor alert processed.',
      assignedDoctors: rows.length,
      alertsSent: sentCount,
      smtpConfigured: !!process.env.SMTP_HOST,
    });
  } catch (err) {
    console.error('triggerDoctorAlert error:', err);
    return res.status(500).json({ message: 'Failed to trigger doctor alert.' });
  }
};
