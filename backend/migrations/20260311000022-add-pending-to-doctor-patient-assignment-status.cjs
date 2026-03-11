'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(`
      DO $$
      BEGIN
        ALTER TYPE "enum_doctor_patient_assignments_status" ADD VALUE IF NOT EXISTS 'pending';
      EXCEPTION
        WHEN duplicate_object THEN NULL;
      END
      $$;
    `);

    await queryInterface.sequelize.query(`
      ALTER TABLE "doctor_patient_assignments"
      ALTER COLUMN "status" SET DEFAULT 'pending';
    `);
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(`
      ALTER TABLE "doctor_patient_assignments"
      ALTER COLUMN "status" SET DEFAULT 'active';
    `);
  },
};
