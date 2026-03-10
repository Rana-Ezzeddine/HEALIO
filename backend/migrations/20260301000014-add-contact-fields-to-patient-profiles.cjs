'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const table = await queryInterface.describeTable('patient_profiles');

    if (!table.phoneNumber) {
      await queryInterface.addColumn('patient_profiles', 'phoneNumber', {
        type: Sequelize.STRING,
        allowNull: true,
      });
    }

    if (!table.email) {
      await queryInterface.addColumn('patient_profiles', 'email', {
        type: Sequelize.STRING,
        allowNull: true,
      });
    }

    if (!table.emergencyContact) {
      await queryInterface.addColumn('patient_profiles', 'emergencyContact', {
        type: Sequelize.TEXT,
        allowNull: true,
      });
    }
  },

  async down(queryInterface) {
    const table = await queryInterface.describeTable('patient_profiles');

    if (table.emergencyContact) {
      await queryInterface.removeColumn('patient_profiles', 'emergencyContact');
    }
    if (table.email) {
      await queryInterface.removeColumn('patient_profiles', 'email');
    }
    if (table.phoneNumber) {
      await queryInterface.removeColumn('patient_profiles', 'phoneNumber');
    }
  },
};

