'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('medications', 'adherenceHistory', {
      type: Sequelize.JSONB,
      allowNull: false,
      defaultValue: [],
    });

    await queryInterface.addColumn('medications', 'reminderEnabled', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    });

    await queryInterface.addColumn('medications', 'reminderLeadMinutes', {
      type: Sequelize.INTEGER,
      allowNull: false,
      defaultValue: 30,
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('medications', 'reminderLeadMinutes');
    await queryInterface.removeColumn('medications', 'reminderEnabled');
    await queryInterface.removeColumn('medications', 'adherenceHistory');
  },
};
