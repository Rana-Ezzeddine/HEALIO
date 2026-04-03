

import crypto from 'crypto';
import { Op } from 'sequelize';
import CaregiverInvite from '../models/CaregiverInvite.js';
import CaregiverPatientPermission from '../models/CaregiverPatientPermission.js';
import User from '../models/User.js';
import PatientProfile from '../models/PatientProfile.js';


function makeToken() {
  return crypto.randomBytes(32).toString('hex');
}

function sevenDaysFromNow() {
  const d = new Date();
  d.setDate(d.getDate() + 7);
  return d;
}

// Expire any pending invites that have passed their expiresAt
async function markExpiredInvites(patientId) {
  await CaregiverInvite.update(
    { status: 'expired' },
    {
      where: {
        patientId,
        status: 'pending',
        expiresAt: { [Op.lt]: new Date() },
      },
    }
  );
}


export async function generateInviteLink(req, res) {
  try {
    if (req.user?.role !== 'patient') {
      return res.status(403).json({ message: 'Only patients can generate invite links.' });
    }

    const patientId = req.user.id;

    // Expire stale invites before generating a new one
    await markExpiredInvites(patientId);

    // Invalidate any still-pending invites — one active invite at a time
    await CaregiverInvite.update(
      { status: 'expired' },
      { where: { patientId, status: 'pending' } }
    );

    const token = makeToken();
    const expiresAt = sevenDaysFromNow();

    const invite = await CaregiverInvite.create({
      patientId,
      token,
      status: 'pending',
      expiresAt,
    });

    return res.status(201).json({
      message: 'Invite link generated.',
      token: invite.token,
      expiresAt: invite.expiresAt,
      // 5.5.f — status returned so frontend can show it
      status: invite.status,
    });
  } catch (err) {
    console.error('generateInviteLink error:', err);
    return res.status(500).json({ message: 'Server error.' });
  }
}


export async function listMyInvites(req, res) {
  try {
    if (req.user?.role !== 'patient') {
      return res.status(403).json({ message: 'Only patients can view their invites.' });
    }

    const patientId = req.user.id;

    // Auto-expire before returning so statuses are always accurate
    await markExpiredInvites(patientId);

    const invites = await CaregiverInvite.findAll({
      where: { patientId },
      order: [['createdAt', 'DESC']],
      // Never expose the raw token in the list — frontend doesn't need it
      attributes: ['id', 'status', 'expiresAt', 'caregiverId', 'createdAt'],
    });

    return res.json({ patientId, invites });
  } catch (err) {
    console.error('listMyInvites error:', err);
    return res.status(500).json({ message: 'Server error.' });
  }
}


export async function resolveInvite(req, res) {
  try {
    const { token } = req.params;

    const invite = await CaregiverInvite.findOne({ where: { token } });

    if (!invite) {
      return res.status(404).json({ message: 'Invite link is invalid.' });
    }

    // Check and mark expired
    if (new Date() > invite.expiresAt && invite.status === 'pending') {
      await invite.update({ status: 'expired' });
    }

    // 6.4.d — return status so frontend shows correct state
    if (invite.status === 'expired') {
      return res.status(410).json({
        message: 'This invite link has expired. Ask the patient to generate a new one.',
        status: 'expired',
      });
    }

    if (invite.status === 'active') {
      return res.status(409).json({
        message: 'This invite link has already been accepted.',
        status: 'active',
      });
    }

    if (invite.status === 'rejected') {
      return res.status(409).json({
        message: 'This invite link was already declined.',
        status: 'rejected',
      });
    }

    const patient = await User.findByPk(invite.patientId, {
      attributes: ['id', 'email'],
    });

    // Use PatientProfile for name — exact fields: firstName, lastName
    const profile = await PatientProfile.findOne({
      where: { userId: invite.patientId },
      attributes: ['firstName', 'lastName'],
    });

    return res.json({
      token: invite.token,
      status: invite.status, // 'pending'
      expiresAt: invite.expiresAt,
      // 6.4.c — patient identity for caregiver to review
      patient: {
        id: patient.id,
        email: patient.email,
        // firstName/lastName exact from PatientProfile model
        firstName: profile?.firstName || null,
        lastName: profile?.lastName || null,
        displayName:
          [profile?.firstName, profile?.lastName].filter(Boolean).join(' ').trim() ||
          patient.email,
      },
    });
  } catch (err) {
    console.error('resolveInvite error:', err);
    return res.status(500).json({ message: 'Server error.' });
  }
}

export async function acceptInvite(req, res) {
  try {
    if (req.user?.role !== 'caregiver') {
      return res.status(403).json({ message: 'Only caregivers can accept invites.' });
    }

    const { token } = req.params;
    const caregiverId = req.user.id;

    const invite = await CaregiverInvite.findOne({ where: { token } });

    if (!invite) {
      return res.status(404).json({ message: 'Invite link is invalid.' });
    }

    // Mark expired if needed
    if (new Date() > invite.expiresAt && invite.status === 'pending') {
      await invite.update({ status: 'expired' });
    }

    if (invite.status === 'expired') {
      return res.status(410).json({
        message: 'This invite link has expired.',
        status: 'expired',
      });
    }

    if (invite.status !== 'pending') {
      return res.status(409).json({
        message: `Invite is already ${invite.status}.`,
        status: invite.status,
      });
    }

    const patientId = invite.patientId;

    
    const [link, created] = await CaregiverPatientPermission.findOrCreate({
      where: { caregiverId, patientId },
      defaults: {
        caregiverId,
        patientId,
        canViewMedications: false,
        canViewSymptoms: false,
        canViewAppointments: false,
        canMessageDoctor: false,
        canReceiveReminders: false,
      },
    });

    // Mark invite as active — 6.4.d
    await invite.update({ status: 'active', caregiverId });

    return res.status(created ? 201 : 200).json({
      message: 'You are now linked to this patient.',
      status: 'active',
      caregiverId,
      patientId,
      // Return current permissions so frontend knows what's enabled
      permissions: {
        canViewMedications: link.canViewMedications,
        canViewSymptoms: link.canViewSymptoms,
        canViewAppointments: link.canViewAppointments,
        canMessageDoctor: link.canMessageDoctor,
        canReceiveReminders: link.canReceiveReminders,
      },
    });
  } catch (err) {
    console.error('acceptInvite error:', err);
    return res.status(500).json({ message: 'Server error.' });
  }
}


export async function rejectInvite(req, res) {
  try {
    if (req.user?.role !== 'caregiver') {
      return res.status(403).json({ message: 'Only caregivers can reject invites.' });
    }

    const { token } = req.params;

    const invite = await CaregiverInvite.findOne({ where: { token } });

    if (!invite) {
      return res.status(404).json({ message: 'Invite link is invalid.' });
    }

    if (invite.status !== 'pending') {
      return res.status(409).json({
        message: `Invite is already ${invite.status}.`,
        status: invite.status,
      });
    }

    await invite.update({ status: 'rejected', caregiverId: req.user.id });

    return res.json({
      message: 'Invite declined.',
      status: 'rejected',
    });
  } catch (err) {
    console.error('rejectInvite error:', err);
    return res.status(500).json({ message: 'Server error.' });
  }
}