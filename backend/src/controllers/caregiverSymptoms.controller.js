import Symptom from '../models/Symptom.js';
import CaregiverPatientPermission from '../models/CaregiverPatientPermission.js';
import User from '../models/User.js';

export async function caregiverLogSymptom(req, res) {
  try {
    if (req.user?.role !== 'caregiver') {
      return res.status(403).json({ message: 'Only caregivers can use this endpoint.' });
    }

    const caregiverId = req.user.id;
    const { patientId, name, severity, notes } = req.body || {};

    if (!patientId) {
      return res.status(400).json({ message: 'patientId is required.' });
    }

    if (!name || !String(name).trim()) {
      return res.status(400).json({ message: 'name is required.' });
    }

    const severityInt = parseInt(severity, 10);
    if (isNaN(severityInt) || severityInt < 0 || severityInt > 10) {
      return res.status(400).json({ message: 'severity must be an integer between 0 and 10.' });
    }

    const link = await CaregiverPatientPermission.findOne({
      where: { caregiverId, patientId },
    });

    if (!link) {
      return res.status(403).json({ message: 'You are not linked to this patient.' });
    }

    if (!link.canViewSymptoms) {
      return res.status(403).json({
        message: 'You do not have permission to log symptoms for this patient.',
      });
    }

    const patient = await User.findByPk(patientId, { attributes: ['id', 'role'] });
    if (!patient || patient.role !== 'patient') {
      return res.status(404).json({ message: 'Patient not found.' });
    }

    const symptom = await Symptom.create({
      patientId,
      name: String(name).trim(),
      severity: severityInt,
      notes: typeof notes === 'string' ? notes.trim() : '',
      loggedAt: new Date(),
      loggedBy: 'caregiver',
      loggedByUserId: caregiverId,
    });

    return res.status(201).json({
      message: 'Symptom observation logged.',
      symptom: {
        id: symptom.id,
        patientId: symptom.patientId,
        name: symptom.name,
        severity: symptom.severity,
        notes: symptom.notes,
        loggedAt: symptom.loggedAt,
        loggedBy: symptom.loggedBy,
        loggedByUserId: symptom.loggedByUserId,
      },
    });
  } catch (err) {
    console.error('caregiverLogSymptom error:', err);
    return res.status(500).json({ message: 'Server error.' });
  }
}

export async function getCaregiverPatientSymptomsLabeled(req, res) {
  try {
    if (req.user?.role !== 'caregiver') {
      return res.status(403).json({ message: 'Only caregivers can view this.' });
    }

    const caregiverId = req.user.id;
    const { patientId } = req.params;

    const link = await CaregiverPatientPermission.findOne({
      where: { caregiverId, patientId },
    });

    if (!link || !link.canViewSymptoms) {
      return res.status(403).json({ message: 'Permission denied for symptoms.' });
    }

    const symptoms = await Symptom.findAll({
      where: { patientId },
      order: [['loggedAt', 'DESC'], ['createdAt', 'DESC']],
    });

    return res.json({
      patientId,
      count: symptoms.length,
      symptoms: symptoms.map((s) => ({
        id: s.id,
        name: s.name,
        severity: s.severity,
        notes: s.notes,
        loggedAt: s.loggedAt,
        loggedBy: s.loggedBy || 'patient',
        loggedByUserId: s.loggedByUserId || null,
      })),
    });
  } catch (err) {
    console.error('getCaregiverPatientSymptomsLabeled error:', err);
    return res.status(500).json({ message: 'Server error.' });
  }
}