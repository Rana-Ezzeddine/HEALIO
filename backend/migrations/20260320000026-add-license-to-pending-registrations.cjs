'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    const table = await queryInterface.describeTable('pending_registrations');

    if (!table.licenseNb) {
      await queryInterface.addColumn('pending_registrations', 'licenseNb', {
        type: Sequelize.STRING,
        allowNull: true,
      });
    }
  },

  async down(queryInterface) {
    const table = await queryInterface.describeTable('pending_registrations');
    if (table.licenseNb) {
      await queryInterface.removeColumn('pending_registrations', 'licenseNb');
    }
  },
};
