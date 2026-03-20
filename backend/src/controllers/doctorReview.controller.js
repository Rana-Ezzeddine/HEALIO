import User from '../models/User.js';
import PatientProfile from '../models/PatientProfile.js';
import {
  DOCTOR_APPROVAL_STATUS,
  DOCTOR_REVIEW_DECISION,
} from '../lib/doctorApproval.js';

const REVIEWABLE_STATUSES = new Set([
  DOCTOR_APPROVAL_STATUS.PENDING,
  DOCTOR_APPROVAL_STATUS.REJECTED,
]);

function normalizeStatusFilter(raw) {
  const value = String(raw || '').trim().toLowerCase();
  if (!value) return DOCTOR_APPROVAL_STATUS.PENDING;
  if (value === 'all') return 'all';
  return value;
}

export async function getDoctorApplicationStatus(req, res) {
  try {
    if (req.user?.role !== 'doctor') {
      return res.status(403).json({ message: 'Only doctors can access application status.' });
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
        'doctorApprovalReviewedAt',
        'createdAt',
      ],
      include: [
        {
          model: PatientProfile,
          as: 'patientProfile',
          attributes: ['firstName', 'lastName', 'licenseNb', 'specialization', 'yearsOfExperience', 'clinicName', 'clinicAddress'],
        },
      ],
    });

    if (!user) {
      return res.status(404).json({ message: 'Doctor account not found.' });
    }

    return res.json({
      application: {
        id: user.id,
        email: user.email,
        status: user.doctorApprovalStatus,
        isVerified: user.isVerified,
        notes: user.doctorApprovalNotes || null,
        requestedMoreInfo: Boolean(user.doctorApprovalRequestedInfoAt),
        requestedMoreInfoAt: user.doctorApprovalRequestedInfoAt,
        reviewedAt: user.doctorApprovalReviewedAt,
        createdAt: user.createdAt,
        profile: user.patientProfile
          ? {
              firstName: user.patientProfile.firstName,
              lastName: user.patientProfile.lastName,
              licenseNb: user.patientProfile.licenseNb,
              specialization: user.patientProfile.specialization,
              yearsOfExperience: user.patientProfile.yearsOfExperience,
              clinicName: user.patientProfile.clinicName,
              clinicAddress: user.patientProfile.clinicAddress,
            }
          : null,
      },
    });
  } catch (err) {
    console.error('doctor application status error:', err);
    return res.status(500).json({ message: 'Failed to fetch doctor application status.' });
  }
}

export async function listDoctorApplications(req, res) {
  try {
    const statusFilter = normalizeStatusFilter(req.query?.status);
    if (statusFilter !== 'all' && !Object.values(DOCTOR_APPROVAL_STATUS).includes(statusFilter)) {
      return res.status(400).json({ message: 'Invalid status filter.' });
    }

    const where = {
      role: 'doctor',
    };

    if (statusFilter === 'all') {
      where.doctorApprovalStatus = [...REVIEWABLE_STATUSES, DOCTOR_APPROVAL_STATUS.APPROVED, DOCTOR_APPROVAL_STATUS.UNVERIFIED];
    } else {
      where.doctorApprovalStatus = statusFilter;
    }

    const doctors = await User.findAll({
      where,
      attributes: [
        'id',
        'email',
        'isVerified',
        'doctorApprovalStatus',
        'doctorApprovalNotes',
        'doctorApprovalRequestedInfoAt',
        'doctorApprovalReviewedAt',
        'createdAt',
      ],
      include: [
        {
          model: PatientProfile,
          as: 'patientProfile',
          attributes: ['firstName', 'lastName', 'licenseNb', 'specialization', 'yearsOfExperience', 'clinicName', 'clinicAddress'],
        },
      ],
      order: [['createdAt', 'ASC']],
    });

    return res.json({
      count: doctors.length,
      applications: doctors.map((doctor) => ({
        id: doctor.id,
        email: doctor.email,
        isVerified: doctor.isVerified,
        status: doctor.doctorApprovalStatus,
        notes: doctor.doctorApprovalNotes || null,
        requestedMoreInfo: Boolean(doctor.doctorApprovalRequestedInfoAt),
        requestedMoreInfoAt: doctor.doctorApprovalRequestedInfoAt,
        reviewedAt: doctor.doctorApprovalReviewedAt,
        createdAt: doctor.createdAt,
        profile: doctor.patientProfile
          ? {
              firstName: doctor.patientProfile.firstName,
              lastName: doctor.patientProfile.lastName,
              licenseNb: doctor.patientProfile.licenseNb,
              specialization: doctor.patientProfile.specialization,
              yearsOfExperience: doctor.patientProfile.yearsOfExperience,
              clinicName: doctor.patientProfile.clinicName,
              clinicAddress: doctor.patientProfile.clinicAddress,
            }
          : null,
      })),
    });
  } catch (err) {
    console.error('list doctor applications error:', err);
    return res.status(500).json({ message: 'Failed to fetch doctor applications.' });
  }
}

export async function reviewDoctorApplication(req, res) {
  try {
    const { doctorId } = req.params;
    const decision = String(req.body?.decision || '').trim().toLowerCase();
    const notes = typeof req.body?.notes === 'string' ? req.body.notes.trim() : '';

    if (!Object.values(DOCTOR_REVIEW_DECISION).includes(decision)) {
      return res.status(400).json({ message: 'decision must be approve, reject, or request_more_info.' });
    }

    if (decision === DOCTOR_REVIEW_DECISION.REQUEST_MORE_INFO && !notes) {
      return res.status(400).json({ message: 'Notes are required when requesting more information.' });
    }

    const doctor = await User.findByPk(doctorId, {
      include: [
        {
          model: PatientProfile,
          as: 'patientProfile',
          attributes: ['licenseNb'],
        },
      ],
    });

    if (!doctor || doctor.role !== 'doctor') {
      return res.status(404).json({ message: 'Doctor application not found.' });
    }

    if (decision === DOCTOR_REVIEW_DECISION.APPROVE && !doctor.patientProfile?.licenseNb) {
      return res.status(400).json({
        message: 'Doctor license number is required before approval.',
      });
    }

    const now = new Date();
    if (decision === DOCTOR_REVIEW_DECISION.APPROVE) {
      await doctor.update({
        doctorApprovalStatus: DOCTOR_APPROVAL_STATUS.APPROVED,
        doctorApprovalNotes: notes || null,
        doctorApprovalRequestedInfoAt: null,
        doctorApprovalReviewedAt: now,
      });
    } else if (decision === DOCTOR_REVIEW_DECISION.REJECT) {
      await doctor.update({
        doctorApprovalStatus: DOCTOR_APPROVAL_STATUS.REJECTED,
        doctorApprovalNotes: notes || null,
        doctorApprovalRequestedInfoAt: null,
        doctorApprovalReviewedAt: now,
      });
    } else {
      await doctor.update({
        doctorApprovalStatus: DOCTOR_APPROVAL_STATUS.PENDING,
        doctorApprovalNotes: notes,
        doctorApprovalRequestedInfoAt: now,
        doctorApprovalReviewedAt: now,
      });
    }

    return res.json({
      message:
        decision === DOCTOR_REVIEW_DECISION.APPROVE
          ? 'Doctor application approved.'
          : decision === DOCTOR_REVIEW_DECISION.REJECT
            ? 'Doctor application rejected.'
            : 'Doctor application marked as needing more information.',
      application: {
        id: doctor.id,
        status: doctor.doctorApprovalStatus,
        notes: doctor.doctorApprovalNotes,
        requestedMoreInfo: Boolean(doctor.doctorApprovalRequestedInfoAt),
        requestedMoreInfoAt: doctor.doctorApprovalRequestedInfoAt,
        reviewedAt: doctor.doctorApprovalReviewedAt,
      },
    });
  } catch (err) {
    console.error('review doctor application error:', err);
    return res.status(500).json({ message: 'Failed to review doctor application.' });
  }
}
