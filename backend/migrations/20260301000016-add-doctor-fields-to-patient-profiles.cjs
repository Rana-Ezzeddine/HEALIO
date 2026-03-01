'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const table = await queryInterface.describeTable('patient_profiles');

    if (!table.specialization) {
      await queryInterface.addColumn('patient_profiles', 'specialization', {
        type: Sequelize.STRING,
        allowNull: true,
      });
    }
    if (!table.yearsOfExperience) {
      await queryInterface.addColumn('patient_profiles', 'yearsOfExperience', {
        type: Sequelize.INTEGER,
        allowNull: true,
      });
    }
    if (!table.licenseNb) {
      await queryInterface.addColumn('patient_profiles', 'licenseNb', {
        type: Sequelize.STRING,
        allowNull: true,
      });
    }
    if (!table.clinicName) {
      await queryInterface.addColumn('patient_profiles', 'clinicName', {
        type: Sequelize.STRING,
        allowNull: true,
      });
    }
    if (!table.clinicAddress) {
      await queryInterface.addColumn('patient_profiles', 'clinicAddress', {
        type: Sequelize.STRING,
        allowNull: true,
      });
    }
  },

  async down(queryInterface) {
    const table = await queryInterface.describeTable('patient_profiles');

    if (table.clinicAddress) await queryInterface.removeColumn('patient_profiles', 'clinicAddress');
    if (table.clinicName) await queryInterface.removeColumn('patient_profiles', 'clinicName');
    if (table.licenseNb) await queryInterface.removeColumn('patient_profiles', 'licenseNb');
    if (table.yearsOfExperience) await queryInterface.removeColumn('patient_profiles', 'yearsOfExperience');
    if (table.specialization) await queryInterface.removeColumn('patient_profiles', 'specialization');
  },
};

