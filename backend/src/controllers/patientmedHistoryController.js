import Medication from '../models/Medication.js';
import Symptom from '../models/Symptom.js';
import Diagnosis from '../models/Diagnosis.js';
import MedicalNote from '../models/MedicalNote.js';
import { Op } from 'sequelize';


export const getPatientMedicalHistory = async (req, res) => {
  try {
    const { patientId } = req.params;
    

    // Fetch all medications for patient
    const medications = await Medication.findAll({
      where: { patientId },
      order: [['createdAt', 'DESC']]
    });

    // Fetch all symptoms for patient
    const symptoms = await Symptom.findAll({
      where: { patientId },
      order: [['createdAt', 'DESC']]
    });

    // Fetch all diagnoses for patient
    const diagnoses = await Diagnosis.findAll({
      where: { patientId },
      order: [['diagnosisDate', 'DESC']]
    });

    // Fetch all medical notes for patient
    const medicalNotes = await MedicalNote.findAll({
      where: { patientId },
      order: [['createdAt', 'DESC']]
    });

    
    const medicalHistory = {
      patientId,
      summary: {
        totalMedications: medications.length,
        activeMedications: medications.filter(m => !m.endDate || new Date(m.endDate) >= new Date()).length,
        totalSymptoms: symptoms.length,
        totalDiagnoses: diagnoses.length,
        totalNotes: medicalNotes.length
      },
      medications: {
        active: medications.filter(m => !m.endDate || new Date(m.endDate) >= new Date()),
        past: medications.filter(m => m.endDate && new Date(m.endDate) < new Date()),
        all: medications
      },
      symptoms: {
        recent: symptoms.slice(0, 10), 
        all: symptoms
      },
      diagnoses: diagnoses.map(d => ({
        id: d.id,
        diagnosis: d.diagnosis || d.name,
        diagnosisDate: d.diagnosisDate,
        doctorName: d.doctorName,
        notes: d.notes,
        severity: d.severity,
        status: d.status
      })),
      medicalNotes: medicalNotes.map(n => ({
        id: n.id,
        note: n.note || n.content,
        createdBy: n.createdBy || n.doctorName,
        createdAt: n.createdAt,
        noteType: n.noteType || 'general'
      })),
      timeline: generateTimeline(medications, symptoms, diagnoses, medicalNotes)
    };

    res.json(medicalHistory);
  } catch (error) {
    console.error('Error fetching patient medical history:', error);
    res.status(500).json({ 
      error: 'Failed to fetch patient medical history',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};


function generateTimeline(medications, symptoms, diagnoses, notes) {
  const timeline = [];

  medications.forEach(med => {
    timeline.push({
      type: 'medication',
      date: med.startDate || med.createdAt,
      title: `Started ${med.name}`,
      description: `${med.dosage} - ${med.frequency}`,
      data: med
    });
    
    if (med.endDate) {
      timeline.push({
        type: 'medication',
        date: med.endDate,
        title: `Stopped ${med.name}`,
        description: `Ended medication`,
        data: med
      });
    }
  });

  symptoms.forEach(symptom => {
    timeline.push({
      type: 'symptom',
      date: symptom.createdAt || symptom.date,
      title: `Symptom: ${symptom.name || symptom.symptom}`,
      description: `Severity: ${symptom.severity || 'Not specified'}`,
      data: symptom
    });
  });

  diagnoses.forEach(diagnosis => {
    timeline.push({
      type: 'diagnosis',
      date: diagnosis.diagnosisDate || diagnosis.createdAt,
      title: `Diagnosis: ${diagnosis.diagnosis || diagnosis.name}`,
      description: diagnosis.notes || '',
      data: diagnosis
    });
  });

  notes.forEach(note => {
    timeline.push({
      type: 'note',
      date: note.createdAt,
      title: `Medical Note`,
      description: note.note || note.content,
      data: note
    });
  });

  timeline.sort((a, b) => new Date(b.date) - new Date(a.date));

  return timeline;
}


export const getMedicalHistorySummary = async (req, res) => {
  try {
    const { patientId } = req.params;

    const [medications, symptoms, diagnoses] = await Promise.all([
      Medication.findAll({ where: { patientId }, order: [['createdAt', 'DESC']], limit: 5 }),
      Symptom.findAll({ where: { patientId }, order: [['createdAt', 'DESC']], limit: 5 }),
      Diagnosis.findAll({ where: { patientId }, order: [['diagnosisDate', 'DESC']], limit: 5 })
    ]);

    const summary = {
      recentMedications: medications,
      recentSymptoms: symptoms,
      recentDiagnoses: diagnoses,
      lastUpdated: new Date()
    };

    res.json(summary);
  } catch (error) {
    console.error('Error fetching medical history summary:', error);
    res.status(500).json({ error: 'Failed to fetch medical history summary' });
  }
};