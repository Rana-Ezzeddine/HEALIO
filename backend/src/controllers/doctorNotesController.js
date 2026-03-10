import MedicalNote from '../models/MedicalNote.js';
import Diagnosis from '../models/Diagnosis.js';
import { Op } from 'sequelize';


export const getPatientDoctorNotes = async (req, res) => {
  try {
    const { patientId } = req.params;

    const doctorNotes = await MedicalNote.findAll({
      where: { patientId },
      order: [['createdAt', 'DESC']],
      limit: 50
    });

    const formattedNotes = doctorNotes.map(note => ({
      id: note.id,
      date: note.createdAt,
      doctorId: note.doctorId,
      content: note.note
    }));

    res.json({
      patientId,
      totalNotes: formattedNotes.length,
      notes: formattedNotes
    });
  } catch (error) {
    console.error('Error fetching doctor notes:', error);
    res.status(500).json({ 
      error: 'Failed to fetch doctor notes',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};


export const getDoctorNoteById = async (req, res) => {
  try {
    const { patientId, noteId } = req.params;

    const note = await MedicalNote.findOne({
      where: {
        id: noteId,
        patientId
      }
    });

    if (!note) {
      return res.status(404).json({ error: 'Note not found' });
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
    res.status(500).json({ error: 'Failed to fetch doctor note' });
  }
};


export const searchDoctorNotes = async (req, res) => {
  try {
    const { patientId } = req.params;
    const { query, startDate, endDate } = req.query;

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
    res.status(500).json({ error: 'Failed to search doctor notes' });
  }
};


export const getPatientClinicalInformation = async (req, res) => {
  try {
    const { patientId } = req.params;

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
    res.status(500).json({ error: 'Failed to fetch clinical information' });
  }
};