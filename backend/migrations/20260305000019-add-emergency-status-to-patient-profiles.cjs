'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const table = await queryInterface.describeTable('patient_profiles');

    if (!table.emergencyStatus) {
      await queryInterface.addColumn('patient_profiles', 'emergencyStatus', {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      });
    }

    if (!table.emergencyStatusUpdatedAt) {
      await queryInterface.addColumn('patient_profiles', 'emergencyStatusUpdatedAt', {
        type: Sequelize.DATE,
        allowNull: true,
      });
    }
  },

  async down(queryInterface) {
    const table = await queryInterface.describeTable('patient_profiles');

    if (table.emergencyStatusUpdatedAt) {
      await queryInterface.removeColumn('patient_profiles', 'emergencyStatusUpdatedAt');
    }

    if (table.emergencyStatus) {
      await queryInterface.removeColumn('patient_profiles', 'emergencyStatus');
    }
  },
};
