import sequelize from "../database.js";

const INDEXES = [
  { table: "medications", columns: ["patientId"], name: "idx_medications_patient_id" },
  { table: "medications", columns: ["prescribedBy"], name: "idx_medications_prescribed_by" },
  { table: "medications", columns: ["startDate"], name: "idx_medications_start_date" },
  { table: "medications", columns: ["endDate"], name: "idx_medications_end_date" },
  { table: "medications", columns: ["createdAt"], name: "idx_medications_created_at" },
  { table: "symptoms", columns: ["patientId"], name: "idx_symptoms_patient_id" },
  { table: "symptoms", columns: ["severity"], name: "idx_symptoms_severity" },
  { table: "symptoms", columns: ["createdAt"], name: "idx_symptoms_created_at" },
  { table: "appointments", columns: ["patientId"], name: "idx_appointments_patient_id" },
  { table: "appointments", columns: ["doctorId"], name: "idx_appointments_doctor_id" },
  { table: "appointments", columns: ["createdAt"], name: "idx_appointments_date" },
  { table: "appointments", columns: ["status"], name: "idx_appointments_status" },
  { table: "diagnoses", columns: ["patientId"], name: "idx_diagnoses_patient_id" },
  { table: "diagnoses", columns: ["diagnosedAt"], name: "idx_diagnoses_diagnosis_date" },
  { table: "medications", columns: ["patientId", "endDate"], name: "idx_medications_patient_active" },
  { table: "symptoms", columns: ["patientId", "createdAt"], name: "idx_symptoms_patient_recent" },
];

async function addIndexes() {
  const queryInterface = sequelize.getQueryInterface();

  for (const { table, columns, name } of INDEXES) {
    try {
      await queryInterface.addIndex(table, columns, { name });
    } catch (err) {
      if (err.original?.code !== "42P07") {
        throw err;
      }
    }
  }
}

async function removeIndexes() {
  const queryInterface = sequelize.getQueryInterface();

  for (const { table, name } of INDEXES) {
    try {
      await queryInterface.removeIndex(table, name);
    } catch {
      // Ignore missing indexes so rollback remains idempotent.
    }
  }
}

export async function up() {
  await addIndexes();
}

export async function down() {
  await removeIndexes();
}

export default { up, down };
