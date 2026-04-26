'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.query(`
      ALTER TYPE "enum_appointments_status" ADD VALUE IF NOT EXISTS 'reschedule_requested';
    `);

    const table = await queryInterface.describeTable('appointments');

    if (!table.proposedStartsAt) {
      await queryInterface.addColumn('appointments', 'proposedStartsAt', {
        type: Sequelize.DATE,
        allowNull: true,
      });
    }

    if (!table.proposedEndsAt) {
      await queryInterface.addColumn('appointments', 'proposedEndsAt', {
        type: Sequelize.DATE,
        allowNull: true,
      });
    }

    if (!table.proposedLocation) {
      await queryInterface.addColumn('appointments', 'proposedLocation', {
        type: Sequelize.STRING,
        allowNull: true,
      });
    }

    if (!table.rescheduleRequestedBy) {
      await queryInterface.addColumn('appointments', 'rescheduleRequestedBy', {
        type: Sequelize.STRING,
        allowNull: true,
      });
    }

    if (!table.rescheduleNotes) {
      await queryInterface.addColumn('appointments', 'rescheduleNotes', {
        type: Sequelize.TEXT,
        allowNull: true,
      });
    }
  },

  async down(queryInterface) {
    const table = await queryInterface.describeTable('appointments');

    if (table.rescheduleNotes) {
      await queryInterface.removeColumn('appointments', 'rescheduleNotes');
    }
    if (table.rescheduleRequestedBy) {
      await queryInterface.removeColumn('appointments', 'rescheduleRequestedBy');
    }
    if (table.proposedLocation) {
      await queryInterface.removeColumn('appointments', 'proposedLocation');
    }
    if (table.proposedEndsAt) {
      await queryInterface.removeColumn('appointments', 'proposedEndsAt');
    }
    if (table.proposedStartsAt) {
      await queryInterface.removeColumn('appointments', 'proposedStartsAt');
    }
  },
};
