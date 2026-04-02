

import Medication from '../models/Medication.js';
import CaregiverPatientPermission from '../models/CaregiverPatientPermission.js';


const CAREGIVER_MEDICATION_ACTIONS = Object.freeze(['assisted', 'missed', 'refused']);

export async function logMedicationSupportAction(req, res) {
  try {
    if (req.user?.role !== 'caregiver') {
      return res.status(403).json({ message: 'Only caregivers can log medication support actions.' });
    }

    const caregiverId = req.user.id;
    const { medicationId } = req.params;
    const { action, note } = req.body || {};

   
    if (!CAREGIVER_MEDICATION_ACTIONS.includes(action)) {
      return res.status(400).json({
        message: `action must be one of: ${CAREGIVER_MEDICATION_ACTIONS.join(', ')}.`,
      });
    }

    const medication = await Medication.findByPk(medicationId);
    if (!medication) {
      return res.status(404).json({ message: 'Medication not found.' });
    }

    
    const link = await CaregiverPatientPermission.findOne({
      where: {
        caregiverId,
        patientId: medication.patientId,
      },
    });

    if (!link) {
      return res.status(403).json({ message: 'You are not linked to this patient.' });
    }

    if (!link.canViewMedications) {
      return res.status(403).json({
        message: 'You do not have permission to interact with this patient\'s medications.',
      });
    }

    const currentHistory = Array.isArray(medication.adherenceHistory)
      ? medication.adherenceHistory
      : [];

    const newEntry = {
      
      action,
      
      loggedBy: 'caregiver',
      caregiverId,
      note: typeof note === 'string' ? note.trim() : null,
      loggedAt: new Date().toISOString(),
    };

    await medication.update({
      adherenceHistory: [...currentHistory, newEntry],
    });

    return res.status(201).json({
      message: 'Medication support action logged.',
      medicationId: medication.id,
      action: newEntry,
    });
  } catch (err) {
    console.error('logMedicationSupportAction error:', err);
    return res.status(500).json({ message: 'Server error.' });
  }
}

export async function getMedicationAdherenceHistory(req, res) {
  try {
    if (req.user?.role !== 'caregiver') {
      return res.status(403).json({ message: 'Only caregivers can view this.' });
    }

    const caregiverId = req.user.id;
    const { medicationId } = req.params;

    const medication = await Medication.findByPk(medicationId);
    if (!medication) {
      return res.status(404).json({ message: 'Medication not found.' });
    }

    const link = await CaregiverPatientPermission.findOne({
      where: { caregiverId, patientId: medication.patientId },
    });

    if (!link || !link.canViewMedications) {
      return res.status(403).json({ message: 'Permission denied for medications.' });
    }

    return res.json({
      medicationId: medication.id,
      medicationName: medication.name,
      adherenceHistory: medication.adherenceHistory || [],
    });
  } catch (err) {
    console.error('getMedicationAdherenceHistory error:', err);
    return res.status(500).json({ message: 'Server error.' });
  }
}