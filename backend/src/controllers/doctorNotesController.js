import MedicalNote from '../models/MedicalNote.js';
import Diagnosis from '../models/Diagnosis.js';
import { Op } from 'sequelize';
import DoctorPatientAssignment from '../models/DoctorPatientAssignment.js';
import CaregiverPatientPermission from '../models/CaregiverPatientPermission.js';
import NotificationService from '../services/notificationService.js';

const canAccessPatientData = async (req, patientId) => {
  if (!req.user?.id || !req.user?.role || !patientId) return false;

  if (req.user.role === 'patient') {
    return req.user.id === patientId;
  }

  if (req.user.role === 'doctor') {
    const assignment = await DoctorPatientAssignment.findOne({
      where: { doctorId: req.user.id, patientId }
    });
    return !!assignment;
  }

  if (req.user.role === 'caregiver') {
    const permission = await CaregiverPatientPermission.findOne({
      where: { caregiverId: req.user.id, patientId }
    });
    return !!permission;
  }

  return false;
};


export const getPatientDoctorNotes = async (req, res) => {
  try {
    const { patientId } = req.params;

    if (!patientId) {
      return res.status(400).json({ message: 'patientId is required.' });
    }

    const allowed = await canAccessPatientData(req, patientId);
    if (!allowed) {
      return res.status(403).json({ message: 'Access denied.' });
    }

    const doctorNotes = await MedicalNote.findAll({
      where: { patientId },
      order: [['createdAt', 'DESC']],
      limit: 50
    });

    const formattedNotes = doctorNotes.map((note) => {
      let structured = null;
      try {
        structured = note.note ? JSON.parse(note.note) : null;
      } catch {
        structured = null;
      }

      return {
        id: note.id,
        date: note.createdAt,
        doctorId: note.doctorId,
        content: note.note,
        structured,
      };
    });

    res.json({
      patientId,
      totalNotes: formattedNotes.length,
      notes: formattedNotes
    });
  } catch (error) {
    console.error('Error fetching doctor notes:', error);
    res.status(500).json({ message: 'Failed to fetch doctor notes.' });
  }
};


export const getDoctorNoteById = async (req, res) => {
  try {
    const { patientId, noteId } = req.params;

    if (!patientId) {
      return res.status(400).json({ message: 'patientId is required.' });
    }

    const allowed = await canAccessPatientData(req, patientId);
    if (!allowed) {
      return res.status(403).json({ message: 'Access denied.' });
    }

    const note = await MedicalNote.findOne({
      where: { id: noteId, patientId }
    });

    if (!note) {
      return res.status(404).json({ message: 'Note not found.' });
    }

    res.json({
      id: note.id,
      date: note.createdAt,
      doctorId: note.doctorId,
      content: note.note,
      updatedAt: note.updatedAt
    });
  } catch (error) {
    console.error('Error fetching doctor note:', error);
    res.status(500).json({ message: 'Failed to fetch doctor note.' });
  }
};


export const searchDoctorNotes = async (req, res) => {
  try {
    const { patientId } = req.params;
    const { query, startDate, endDate } = req.query;

    if (!patientId) {
      return res.status(400).json({ message: 'patientId is required.' });
    }

    const allowed = await canAccessPatientData(req, patientId);
    if (!allowed) {
      return res.status(403).json({ message: 'Access denied.' });
    }

    if (query && query.trim().length < 2) {
      return res.status(400).json({ message: 'Search query must be at least 2 characters.' });
    }

    if (startDate && isNaN(new Date(startDate).getTime())) {
      return res.status(400).json({ message: 'Invalid startDate.' });
    }

    if (endDate && isNaN(new Date(endDate).getTime())) {
      return res.status(400).json({ message: 'Invalid endDate.' });
    }

    const whereConditions = { patientId };

    if (query) {
      whereConditions.note = { [Op.iLike]: `%${query}%` };
    }

    if (startDate && endDate) {
      whereConditions.createdAt = {
        [Op.between]: [new Date(startDate), new Date(endDate)]
      };
    }

    const notes = await MedicalNote.findAll({
      where: whereConditions,
      order: [['createdAt', 'DESC']],
      limit: 50
    });

    res.json({
      totalResults: notes.length,
      notes: notes.map(note => ({
        id: note.id,
        date: note.createdAt,
        doctorId: note.doctorId,
        preview: note.note.substring(0, 150) + '...'
      }))
    });
  } catch (error) {
    console.error('Error searching doctor notes:', error);
    res.status(500).json({ message: 'Failed to search doctor notes.' });
  }
};


export const getPatientClinicalInformation = async (req, res) => {
  try {
    const { patientId } = req.params;

    if (!patientId) {
      return res.status(400).json({ message: 'patientId is required.' });
    }

    const allowed = await canAccessPatientData(req, patientId);
    if (!allowed) {
      return res.status(403).json({ message: 'Access denied.' });
    }

    const [notes, treatmentPlans] = await Promise.all([
      MedicalNote.findAll({
        where: { patientId },
        order: [['createdAt', 'DESC']],
        limit: 10
      }),
      Diagnosis.findAll({
        where: {
          patientId,
          treatmentPlan: { [Op.ne]: null }
        },
        order: [['diagnosisDate', 'DESC']],
        limit: 5
      })
    ]);

    res.json({
      patientId,
      summary: {
        totalNotes: notes.length,
        totalTreatmentPlans: treatmentPlans.length,
        lastNoteDate: notes.length ? notes[0].createdAt : null,
        lastPlanDate: treatmentPlans.length ? treatmentPlans[0].diagnosisDate : null
      },
      recentNotes: notes.slice(0, 5).map(note => ({
        id: note.id,
        date: note.createdAt,
        doctorId: note.doctorId,
        preview: note.note.substring(0, 100) + '...'
      })),
      activeTreatmentPlans: treatmentPlans
        .filter(p => p.status === 'active')
        .map(plan => ({
          id: plan.id,
          diagnosis: plan.diagnosis || plan.name,
          doctorName: plan.doctorName,
          startDate: plan.startDate,
          status: plan.status
        }))
    });
  } catch (error) {
    console.error('Error fetching clinical information:', error);
    res.status(500).json({ message: 'Failed to fetch clinical information.' });
  }
};


export const getPatientTreatmentPlans = async (req, res) => {
  try {
    const { patientId } = req.params;

    if (!patientId) {
      return res.status(400).json({ message: 'patientId is required.' });
    }

    const allowed = await canAccessPatientData(req, patientId);
    if (!allowed) {
      return res.status(403).json({ message: 'Access denied.' });
    }

    const plans = await Diagnosis.findAll({
      where: {
        patientId,
        treatmentPlan: { [Op.ne]: null }
      },
      order: [['diagnosisDate', 'DESC']]
    });

    res.json({
      patientId,
      totalPlans: plans.length,
      treatmentPlans: plans.map(plan => ({
        id: plan.id,
        diagnosis: plan.diagnosis || plan.name,
        treatmentPlan: plan.treatmentPlan,
        doctorName: plan.doctorName,
        startDate: plan.startDate,
        status: plan.status
      }))
    });
  } catch (error) {
    console.error('Error fetching treatment plans:', error);
    res.status(500).json({ message: 'Failed to fetch treatment plans.' });
  }
};


export const getTreatmentPlanById = async (req, res) => {
  try {
    const { patientId, planId } = req.params;

    if (!patientId) {
      return res.status(400).json({ message: 'patientId is required.' });
    }

    const allowed = await canAccessPatientData(req, patientId);
    if (!allowed) {
      return res.status(403).json({ message: 'Access denied.' });
    }

    const plan = await Diagnosis.findOne({
      where: { id: planId, patientId }
    });

    if (!plan) {
      return res.status(404).json({ message: 'Treatment plan not found.' });
    }

    res.json({
      id: plan.id,
      diagnosis: plan.diagnosis || plan.name,
      treatmentPlan: plan.treatmentPlan,
      doctorName: plan.doctorName,
      startDate: plan.startDate,
      status: plan.status
    });
  } catch (error) {
    console.error('Error fetching treatment plan:', error);
    res.status(500).json({ message: 'Failed to fetch treatment plan.' });
  }
};

export const createPatientDoctorNote = async (req, res) => {
  try {
    const { patientId } = req.params;
    if (!patientId) {
      return res.status(400).json({ message: 'patientId is required.' });
    }
    if (req.user?.role !== 'doctor') {
      return res.status(403).json({ message: 'Only doctors can create clinical notes.' });
    }

    const assignment = await DoctorPatientAssignment.findOne({
      where: { doctorId: req.user.id, patientId, status: 'active' },
    });
    if (!assignment) {
      return res.status(403).json({ message: 'Access denied.' });
    }

    const payload = req.body || {};
    const noteTitle = String(payload.noteTitle || '').trim();
    const chiefComplaint = String(payload.chiefComplaint || '').trim();
    if (!noteTitle || !chiefComplaint) {
      return res.status(400).json({ message: 'noteTitle and chiefComplaint are required.' });
    }

    const created = await MedicalNote.create({
      patientId,
      doctorId: req.user.id,
      note: JSON.stringify(payload),
    });

    await NotificationService.createWithContext(
      { type: 'medical_note', relatedId: created.id },
      {
        userId: patientId,
        category: 'medical_note_update',
        title: 'New Clinical Note',
        message: `Dr. note added: ${noteTitle}`,
        type: 'info',
        metadata: { patientId, doctorId: req.user.id },
      }
    );

    return res.status(201).json({
      id: created.id,
      date: created.createdAt,
      doctorId: created.doctorId,
      content: created.note,
      structured: payload,
    });
  } catch (error) {
    console.error('Error creating doctor note:', error);
    return res.status(500).json({ message: 'Failed to create doctor note.' });
  }
};
