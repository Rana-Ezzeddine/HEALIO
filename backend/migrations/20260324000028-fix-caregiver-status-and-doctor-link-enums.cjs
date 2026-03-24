'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const caregiverTable = await queryInterface.describeTable('caregiver_patient_permissions');

    if (!caregiverTable.status) {
      await queryInterface.addColumn('caregiver_patient_permissions', 'status', {
        type: Sequelize.ENUM('pending', 'active', 'rejected'),
        allowNull: false,
        defaultValue: 'pending',
      });

      await queryInterface.sequelize.query(`
        UPDATE "caregiver_patient_permissions"
        SET "status" = 'active'
        WHERE "status" = 'pending';
      `);

      await queryInterface.addIndex('caregiver_patient_permissions', ['status'], {
        name: 'caregiver_patient_permissions_status_idx',
      });
    }

    await queryInterface.sequelize.query(`
      DO $$
      BEGIN
        BEGIN
          ALTER TYPE "enum_doctor_patient_assignments_status" ADD VALUE IF NOT EXISTS 'pending';
        EXCEPTION
          WHEN duplicate_object THEN NULL;
        END;

        BEGIN
          ALTER TYPE "enum_doctor_patient_assignments_status" ADD VALUE IF NOT EXISTS 'rejected';
        EXCEPTION
          WHEN duplicate_object THEN NULL;
        END;
      END
      $$;
    `);

    await queryInterface.sequelize.query(`
      ALTER TABLE "doctor_patient_assignments"
      ALTER COLUMN "status" SET DEFAULT 'pending';
    `);
  },

  async down(queryInterface) {
    const caregiverTable = await queryInterface.describeTable('caregiver_patient_permissions');

    if (caregiverTable.status) {
      await queryInterface.removeColumn('caregiver_patient_permissions', 'status');
    }

    await queryInterface.sequelize.query(`
      ALTER TABLE "doctor_patient_assignments"
      ALTER COLUMN "status" SET DEFAULT 'active';
    `);
  },
};
