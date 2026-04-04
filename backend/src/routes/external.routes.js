import express from 'express';
import { apiKeyAuth, requireScope } from '../middleware/apiKeyAuth.js';
import ContextService from '../services/ContextService.js';
import IntegrationService from '../services/IntegrationService.js';
import Medication from '../models/Medication.js';

const router = express.Router();

/**
 * @api {get} /api/v1/external/patients/:patientId/medications Fetch Patient Medications
 * @apiGroup External
 * @apiDescription Allows external software to retrieve a patient's medication list from HEALIO.
 * (HEAL-130, HEAL-131)
 */
router.get(
  '/patients/:patientId/medications', 
  apiKeyAuth, 
  requireScope('medications:read'),
  async (req, res) => {
    try {
      const { patientId } = req.params;
      const authUserId = req.user.id;
      const role = req.user.role;

      // Enforce RBAC privacy (HEAL-131)
      const isAuthorized = await ContextService.verifyAccess(authUserId, role, patientId);
      if (!isAuthorized) {
        return res.status(403).json({ error: 'Not authorized to access this patient' });
      }

      const medications = await Medication.findAll({
        where: { patientId },
        order: [['createdAt', 'DESC']]
      });

      return res.json({
        patientId,
        count: medications.length,
        medications
      });
    } catch (error) {
      console.error('External API Medications Error:', error);
      return res.status(500).json({ error: 'Failed to retrieve medications via external API.' });
    }
  }
);

/**
 * @api {get} /api/v1/external/integrations List Available External Integrations
 * @apiGroup External
 * (HEAL-128)
 */
router.get(
  '/integrations', 
  apiKeyAuth, 
  async (req, res) => {
    const integrations = await IntegrationService.getAvailableIntegrations();
    return res.json(integrations);
  }
);

/**
 * @api {post} /api/v1/external/patients/:patientId/sync-medications Trigger External Sync
 * @apiGroup External
 * (HEAL-129)
 */
router.post(
  '/patients/:patientId/sync-medications', 
  apiKeyAuth, 
  requireScope('medications:write'),
  async (req, res) => {
    try {
      const { patientId } = req.params;
      const { externalPatientId, systemId } = req.body;
      const authUserId = req.user.id;
      const role = req.user.role;

      if (!externalPatientId || !systemId) {
        return res.status(400).json({ error: 'externalPatientId and systemId are required' });
      }

      // RBAC check
      const isAuthorized = await ContextService.verifyAccess(authUserId, role, patientId);
      if (!isAuthorized) {
        return res.status(403).json({ error: 'Not authorized for this patient' });
      }

      // Retrieval path (HEAL-129)
      const externalData = await IntegrationService.getExternalMedicationHistory(patientId, externalPatientId);

      // Map to HEALIO models
      const imported = await Promise.all(externalData.map(async (med) => {
        return await Medication.create({
          ...med,
          patientId,
          frequency: med.frequency || 'As directed',
        });
      }));

      return res.status(201).json({
        message: `Successfully synchronized ${imported.length} records from ${systemId}`,
        importedCount: imported.length,
        imported
      });
    } catch (error) {
      console.error('External Sync Error:', error);
      return res.status(500).json({ error: 'Medication synchronization failed.' });
    }
  }
);

export default router;
