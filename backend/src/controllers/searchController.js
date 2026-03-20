import Medication from '../models/Medication.js';
import Symptom from '../models/Symptom.js';
import Diagnosis from '../models/Diagnosis.js';
import { Op } from 'sequelize';
import DoctorPatientAssignment from '../models/DoctorPatientAssignment.js';
import CaregiverPatientPermission from '../models/CaregiverPatientPermission.js';

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

/**
 * PBI-29: Universal search across medications, symptoms, and history
 */
export const universalSearch = async (req, res) => {
  try {
    let targetPatientId = req.query.patientId;

    if (req.user.role === 'patient') {
      targetPatientId = req.user.id;
    }

    if (!targetPatientId) {
      return res.status(400).json({ message: 'patientId is required.' });
    }

    const allowed = await canAccessPatientData(req, targetPatientId);
    if (!allowed) {
      return res.status(403).json({ message: 'Access denied.' });
    }

    const { q: query, type, startDate, endDate } = req.query;

    if (!query || query.trim().length < 2) {
      return res.status(400).json({ message: 'Search query must be at least 2 characters.' });
    }

    if (startDate && isNaN(new Date(startDate).getTime())) {
      return res.status(400).json({ message: 'Invalid startDate.' });
    }

    if (endDate && isNaN(new Date(endDate).getTime())) {
      return res.status(400).json({ message: 'Invalid endDate.' });
    }

    const searchConditions = {
      patientId: targetPatientId,
      [Op.or]: [
        { name: { [Op.iLike]: `%${query}%` } },
        { notes: { [Op.iLike]: `%${query}%` } }
      ]
    };

    // Date range filter
    if (startDate && endDate) {
      searchConditions.createdAt = {
        [Op.between]: [new Date(startDate), new Date(endDate)]
      };
    }

    let results = {
      medications: [],
      symptoms: [],
      diagnoses: []
    };

    // Search medications
    if (!type || type === 'medications') {
      results.medications = await Medication.findAll({
        where: searchConditions,
        order: [['createdAt', 'DESC']],
        limit: 20
      });
    }

    // Search symptoms
    if (!type || type === 'symptoms') {
      results.symptoms = await Symptom.findAll({
        where: searchConditions,
        order: [['createdAt', 'DESC']],
        limit: 20
      });
    }

    // Search diagnoses
    if (!type || type === 'diagnoses') {
      const diagnosisConditions = {
        patientId: targetPatientId,
        [Op.or]: [
          { diagnosis: { [Op.iLike]: `%${query}%` } },
          { notes: { [Op.iLike]: `%${query}%` } }
        ]
      };

      if (startDate && endDate) {
        diagnosisConditions.createdAt = {
          [Op.between]: [new Date(startDate), new Date(endDate)]
        };
      }

      results.diagnoses = await Diagnosis.findAll({
        where: diagnosisConditions,
        order: [['diagnosisDate', 'DESC']],
        limit: 20
      });
    }

    const totalResults = results.medications.length + results.symptoms.length + results.diagnoses.length;

    res.json({
      query,
      totalResults,
      results
    });
  } catch (error) {
    console.error('Error performing universal search:', error);
    res.status(500).json({ message: 'Failed to perform search.' });
  }
};

/**
 * Filter medications with advanced options
 */
export const filterMedications = async (req, res) => {
  try {
    let targetPatientId = req.query.patientId;

    if (req.user.role === 'patient') {
      targetPatientId = req.user.id;
    }

    if (!targetPatientId) {
      return res.status(400).json({ message: 'patientId is required.' });
    }

    const allowed = await canAccessPatientData(req, targetPatientId);
    if (!allowed) {
      return res.status(403).json({ message: 'Access denied.' });
    }

    const {
      q,
      status,
      prescribedBy,
      startDate,
      endDate,
      frequency,
      sortBy = 'createdAt',
      sortOrder = 'DESC',
      limit = 50,
      offset = 0
    } = req.query;

    const parsedLimit = parseInt(limit);
    const parsedOffset = parseInt(offset);

    if (isNaN(parsedLimit) || isNaN(parsedOffset)) {
      return res.status(400).json({ message: 'limit and offset must be numbers.' });
    }

    if (startDate && isNaN(new Date(startDate).getTime())) {
      return res.status(400).json({ message: 'Invalid startDate.' });
    }

    if (endDate && isNaN(new Date(endDate).getTime())) {
      return res.status(400).json({ message: 'Invalid endDate.' });
    }

    const whereConditions = { patientId: targetPatientId };

    if (prescribedBy) whereConditions.prescribedBy = { [Op.iLike]: `%${prescribedBy}%` };
    if (frequency) whereConditions.frequency = { [Op.iLike]: `%${frequency}%` };
    if (q && q.trim().length >= 2) {
      whereConditions[Op.and] = [
        ...(whereConditions[Op.and] || []),
        {
          [Op.or]: [
            { name: { [Op.iLike]: `%${q.trim()}%` } },
            { prescribedBy: { [Op.iLike]: `%${q.trim()}%` } },
            { notes: { [Op.iLike]: `%${q.trim()}%` } },
          ],
        },
      ];
    }

    // Status filter
    if (status === 'active') {
      whereConditions[Op.or] = [
        { endDate: null },
        { endDate: { [Op.gte]: new Date() } }
      ];
    } else if (status === 'past') {
      whereConditions.endDate = { [Op.lt]: new Date() };
    }

    // Date range filter
    if (startDate) {
      whereConditions.startDate = { [Op.gte]: new Date(startDate) };
    }
    if (endDate) {
      whereConditions.endDate = { [Op.lte]: new Date(endDate) };
    }

    const medications = await Medication.findAndCountAll({
      where: whereConditions,
      order: [[sortBy, sortOrder]],
      limit: parsedLimit,
      offset: parsedOffset
    });

    res.json({
      total: medications.count,
      medications: medications.rows,
      page: Math.floor(parsedOffset / parsedLimit) + 1,
      totalPages: Math.ceil(medications.count / parsedLimit)
    });
  } catch (error) {
    console.error('Error filtering medications:', error);
    res.status(500).json({ message: 'Failed to filter medications.' });
  }
};

/**
 * Filter symptoms with advanced options
 */
export const filterSymptoms = async (req, res) => {
  try {
    let targetPatientId = req.query.patientId;

    if (req.user.role === 'patient') {
      targetPatientId = req.user.id;
    }

    if (!targetPatientId) {
      return res.status(400).json({ message: 'patientId is required.' });
    }

    const allowed = await canAccessPatientData(req, targetPatientId);
    if (!allowed) {
      return res.status(403).json({ message: 'Access denied.' });
    }

    const {
      severity,
      startDate,
      endDate,
      symptomName,
      sortBy = 'createdAt',
      sortOrder = 'DESC',
      limit = 50,
      offset = 0
    } = req.query;

    const parsedLimit = parseInt(limit);
    const parsedOffset = parseInt(offset);

    if (isNaN(parsedLimit) || isNaN(parsedOffset)) {
      return res.status(400).json({ message: 'limit and offset must be numbers.' });
    }

    if (startDate && isNaN(new Date(startDate).getTime())) {
      return res.status(400).json({ message: 'Invalid startDate.' });
    }

    if (endDate && isNaN(new Date(endDate).getTime())) {
      return res.status(400).json({ message: 'Invalid endDate.' });
    }

    const whereConditions = { patientId: targetPatientId };

    if (severity) whereConditions.severity = severity;
    if (symptomName) whereConditions.name = { [Op.iLike]: `%${symptomName}%` };

    // Date range filter
    if (startDate && endDate) {
      whereConditions.createdAt = {
        [Op.between]: [new Date(startDate), new Date(endDate)]
      };
    }

    const symptoms = await Symptom.findAndCountAll({
      where: whereConditions,
      order: [[sortBy, sortOrder]],
      limit: parsedLimit,
      offset: parsedOffset
    });

    res.json({
      total: symptoms.count,
      symptoms: symptoms.rows,
      page: Math.floor(parsedOffset / parsedLimit) + 1,
      totalPages: Math.ceil(symptoms.count / parsedLimit)
    });
  } catch (error) {
    console.error('Error filtering symptoms:', error);
    res.status(500).json({ message: 'Failed to filter symptoms.' });
  }
};

/**
 * Get filter options (for dropdowns)
 */
export const getFilterOptions = async (req, res) => {
  try {
    let targetPatientId = req.query.patientId;

    if (req.user.role === 'patient') {
      targetPatientId = req.user.id;
    }

    if (!targetPatientId) {
      return res.status(400).json({ message: 'patientId is required.' });
    }

    const allowed = await canAccessPatientData(req, targetPatientId);
    if (!allowed) {
      return res.status(403).json({ message: 'Access denied.' });
    }

    const medicationConditions = { patientId: targetPatientId };
    const symptomConditions = { patientId: targetPatientId };

    // Get unique values for filters
    const [doctors, frequencies, severities] = await Promise.all([
      Medication.findAll({
        where: medicationConditions,
        attributes: [[Medication.sequelize.fn('DISTINCT', Medication.sequelize.col('prescribedBy')), 'prescribedBy']],
        raw: true
      }),
      Medication.findAll({
        where: medicationConditions,
        attributes: [[Medication.sequelize.fn('DISTINCT', Medication.sequelize.col('frequency')), 'frequency']],
        raw: true
      }),
      Symptom.findAll({
        where: symptomConditions,
        attributes: [[Symptom.sequelize.fn('DISTINCT', Symptom.sequelize.col('severity')), 'severity']],
        raw: true
      })
    ]);

    res.json({
      doctors: doctors.map(d => d.prescribedBy).filter(Boolean),
      frequencies: frequencies.map(f => f.frequency).filter(Boolean),
      severities: severities.map(s => s.severity).filter(Boolean)
    });
  } catch (error) {
    console.error('Error fetching filter options:', error);
    res.status(500).json({ message: 'Failed to fetch filter options.' });
  }
};
