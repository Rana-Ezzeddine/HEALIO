'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const table = await queryInterface.describeTable('medications');
    if (!table.prescribedBy) {
      await queryInterface.addColumn('medications', 'prescribedBy', {
        type: Sequelize.STRING,
        allowNull: true,
      });
    }
  },

  async down(queryInterface) {
    const table = await queryInterface.describeTable('medications');
    if (table.prescribedBy) {
      await queryInterface.removeColumn('medications', 'prescribedBy');
    }
  },
};

