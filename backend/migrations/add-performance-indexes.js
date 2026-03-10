import sequelize from '../database.js';

export const addPerformanceIndexes = async () => {
  const queryInterface = sequelize.getQueryInterface();

  const indexes = [
    // Medication indexes
    { table: 'medications', column: ['patientId'], name: 'idx_medications_patient_id' },
    { table: 'medications', column: ['prescribedBy'], name: 'idx_medications_prescribed_by' },
    { table: 'medications', column: ['startDate'], name: 'idx_medications_start_date' },
    { table: 'medications', column: ['endDate'], name: 'idx_medications_end_date' },
    { table: 'medications', column: ['createdAt'], name: 'idx_medications_created_at' },

    // Symptom indexes
    { table: 'symptoms', column: ['patientId'], name: 'idx_symptoms_patient_id' },
    { table: 'symptoms', column: ['severity'], name: 'idx_symptoms_severity' },
    { table: 'symptoms', column: ['createdAt'], name: 'idx_symptoms_created_at' },

    // Appointment indexes
    { table: 'appointments', column: ['patientId'], name: 'idx_appointments_patient_id' },
    { table: 'appointments', column: ['doctorId'], name: 'idx_appointments_doctor_id' },
    { table: 'appointments', column: ['createdAt'], name: 'idx_appointments_date' },
    { table: 'appointments', column: ['status'], name: 'idx_appointments_status' },

    // Diagnosis indexes
    { table: 'diagnoses', column: ['patientId'], name: 'idx_diagnoses_patient_id' },
    { table: 'diagnoses', column: ['diagnosedAt'], name: 'idx_diagnoses_diagnosis_date' },

    // Composite indexes
    { table: 'medications', column: ['patientId', 'endDate'], name: 'idx_medications_patient_active' },
    { table: 'symptoms', column: ['patientId', 'createdAt'], name: 'idx_symptoms_patient_recent' },
  ];

  console.log('Adding performance indexes...');
  for (const { table, column, name } of indexes) {
    try {
      await queryInterface.addIndex(table, column, { name });
      console.log(`✓ Index created: ${name}`);
    } catch (err) {
      if (err.original && err.original.code === '42P07') {
        console.log(`Index already exists, skipping: ${name}`);
      } else {
        console.error(`Error adding index ${name}:`, err);
      }
    }
  }
  console.log('✓ All indexes processed');
};

export const removePerformanceIndexes = async () => {
  const queryInterface = sequelize.getQueryInterface();

  const indexes = [
    { table: 'medications', name: 'idx_medications_patient_id' },
    { table: 'medications', name: 'idx_medications_prescribed_by' },
    { table: 'medications', name: 'idx_medications_start_date' },
    { table: 'medications', name: 'idx_medications_end_date' },
    { table: 'medications', name: 'idx_medications_created_at' },

    { table: 'symptoms', name: 'idx_symptoms_patient_id' },
    { table: 'symptoms', name: 'idx_symptoms_severity' },
    { table: 'symptoms', name: 'idx_symptoms_created_at' },

    { table: 'appointments', name: 'idx_appointments_patient_id' },
    { table: 'appointments', name: 'idx_appointments_doctor_id' },
    { table: 'appointments', name: 'idx_appointments_date' },
    { table: 'appointments', name: 'idx_appointments_status' },

    { table: 'diagnoses', name: 'idx_diagnoses_patient_id' },
    { table: 'diagnoses', name: 'idx_diagnoses_diagnosis_date' },

    { table: 'medications', name: 'idx_medications_patient_active' },
    { table: 'symptoms', name: 'idx_symptoms_patient_recent' },
  ];

  for (const { table, name } of indexes) {
    try {
      await queryInterface.removeIndex(table, name);
      console.log(`✓ Index removed: ${name}`);
    } catch (err) {
      console.log(`Index ${name} not found or could not be removed, skipping...`);
    }
  }
  console.log('✓ All indexes removal attempted');
};