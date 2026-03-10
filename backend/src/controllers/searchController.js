import Medication from '../models/Medication.js';
import Symptom from '../models/Symptom.js';
import Diagnosis from '../models/Diagnosis.js';
import { Op } from 'sequelize';

/**
 * PBI-29: Universal search across medications, symptoms, and history
 */
export const universalSearch = async (req, res) => {
  try {
    const { query, patientId, type, startDate, endDate } = req.query;

    if (!query || query.length < 2) {
      return res.status(400).json({ error: 'Search query must be at least 2 characters' });
    }

    const searchConditions = {
      [Op.or]: [
        { name: { [Op.iLike]: `%${query}%` } },
        { notes: { [Op.iLike]: `%${query}%` } }
      ]
    };

    if (patientId) {
      searchConditions.patientId = patientId;
    }

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
        [Op.or]: [
          { diagnosis: { [Op.iLike]: `%${query}%` } },
          { notes: { [Op.iLike]: `%${query}%` } }
        ]
      };
      
      if (patientId) {
        diagnosisConditions.patientId = patientId;
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
    res.status(500).json({ error: 'Failed to perform search' });
  }
};

/**
 * Filter medications with advanced options
 */
export const filterMedications = async (req, res) => {
  try {
    const { 
      patientId, 
      status,  // 'active' or 'past'
      prescribedBy, 
      startDate, 
      endDate,
      frequency,
      sortBy = 'createdAt',
      sortOrder = 'DESC',
      limit = 50,
      offset = 0
    } = req.query;

    const whereConditions = {};

    if (patientId) whereConditions.patientId = patientId;
    if (prescribedBy) whereConditions.prescribedBy = { [Op.iLike]: `%${prescribedBy}%` };
    if (frequency) whereConditions.frequency = { [Op.iLike]: `%${frequency}%` };

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
      limit: parseInt(limit),
      offset: parseInt(offset)
    });

    res.json({
      total: medications.count,
      medications: medications.rows,
      page: Math.floor(offset / limit) + 1,
      totalPages: Math.ceil(medications.count / limit)
    });
  } catch (error) {
    console.error('Error filtering medications:', error);
    res.status(500).json({ error: 'Failed to filter medications' });
  }
};

/**
 * Filter symptoms with advanced options
 */
export const filterSymptoms = async (req, res) => {
  try {
    const {
      patientId,
      severity,
      startDate,
      endDate,
      symptomName,
      sortBy = 'createdAt',
      sortOrder = 'DESC',
      limit = 50,
      offset = 0
    } = req.query;

    const whereConditions = {};

    if (patientId) whereConditions.patientId = patientId;
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
      limit: parseInt(limit),
      offset: parseInt(offset)
    });

    res.json({
      total: symptoms.count,
      symptoms: symptoms.rows,
      page: Math.floor(offset / limit) + 1,
      totalPages: Math.ceil(symptoms.count / limit)
    });
  } catch (error) {
    console.error('Error filtering symptoms:', error);
    res.status(500).json({ error: 'Failed to filter symptoms' });
  }
};

/**
 * Get filter options (for dropdowns)
 */
export const getFilterOptions = async (req, res) => {
  try {
    const { patientId } = req.query;

    const medicationConditions = patientId ? { patientId } : {};
    const symptomConditions = patientId ? { patientId } : {};

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
    res.status(500).json({ error: 'Failed to fetch filter options' });
  }
};