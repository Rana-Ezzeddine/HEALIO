import { RecentContext, DoctorPatientAssignment, CaregiverPatientPermission, Medication, Appointment, Symptom } from '../models/index.js';
import { Op } from 'sequelize';

class ContextService {
  /**
   * Resolves the active patient ID from the request.
   * If not explicitly provided, attempts to infer from RecentContext.
   */
  async resolvePatientContext(req) {
    const authUserId = req.user?.id;
    const role = req.user?.role;

    if (!authUserId) {
      return { error: 'Not authenticated', status: 401 };
    }

    // Patients are always their own context
    if (role === 'patient') {
      return { patientId: authUserId };
    }

    // Try to find patientId in request
    let patientId = req.params.patientId || req.query.patientId || req.body.patientId || req.headers['x-healio-patient-id'];

    // If not found, try RecentContext
    if (!patientId) {
      const recent = await RecentContext.findOne({
        where: { userId: authUserId },
        order: [['lastAccessedAt', 'DESC']]
      });
      patientId = recent?.patientId;
    }

    if (!patientId) {
      return { error: 'Patient context required. Please provide patientId.', status: 400 };
    }

    // Verify permissions
    const authorized = await this.verifyAccess(authUserId, role, patientId);
    if (!authorized) {
      return { error: 'Not authorized for this patient context', status: 403 };
    }

    // Update RecentContext asynchronously
    this.updateRecentContext(authUserId, patientId).catch(err => 
      console.error('Failed to update recent context:', err)
    );

    return { patientId };
  }

  /**
   * Verifies if a user has access to a patient.
   */
  async verifyAccess(userId, role, patientId) {
    if (role === 'doctor') {
      const assignment = await DoctorPatientAssignment.findOne({
        where: { doctorId: userId, patientId }
      });
      return !!assignment;
    }

    if (role === 'caregiver') {
      const permission = await CaregiverPatientPermission.findOne({
        where: { caregiverId: userId, patientId }
      });
      return !!permission;
    }

    return userId === patientId;
  }

  /**
   * Updates the last accessed patient for a user.
   */
  async updateRecentContext(userId, patientId) {
    await RecentContext.upsert({
      userId,
      patientId,
      lastAccessedAt: new Date()
    });
  }

  /**
   * Retrieves data that can be reused across flows to reduce typing.
   */
  async getPreFillData(patientId, flowType) {
    if (flowType === 'medication') {
      const lastMed = await Medication.findOne({
        where: { patientId },
        order: [['createdAt', 'DESC']],
        attributes: ['prescribedBy', 'doseUnit']
      });
      
      return {
        prescribedBy: lastMed?.prescribedBy || '',
        doseUnit: lastMed?.doseUnit || 'mg'
      };
    }

    if (flowType === 'appointment') {
      const lastAppointment = await Appointment.findOne({
        where: {
          patientId,
          location: { [Op.not]: null },
        },
        order: [['createdAt', 'DESC']],
        attributes: ['location'],
      });

      return {
        defaultLocation: lastAppointment?.location || '',
      };
    }

    if (flowType === 'symptom') {
      const lastSymptom = await Symptom.findOne({
        where: { patientId },
        order: [['createdAt', 'DESC']],
        attributes: ['severity', 'name'],
      });

      return {
        defaultSeverity: lastSymptom?.severity || 5,
        lastSymptomName: lastSymptom?.name || '',
      };
    }

    // Add more flows as needed (e.g., appointments, symptoms)
    return {};
  }
}

export default new ContextService();
