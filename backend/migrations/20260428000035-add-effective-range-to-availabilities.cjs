"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const table = await queryInterface.describeTable("availabilities");

    if (!table.effectiveFrom) {
      await queryInterface.addColumn("availabilities", "effectiveFrom", {
        type: Sequelize.DATEONLY,
        allowNull: true,
      });
    }

    if (!table.effectiveUntil) {
      await queryInterface.addColumn("availabilities", "effectiveUntil", {
        type: Sequelize.DATEONLY,
        allowNull: true,
      });
    }
  },

  async down(queryInterface) {
    const table = await queryInterface.describeTable("availabilities");

    if (table.effectiveUntil) {
      await queryInterface.removeColumn("availabilities", "effectiveUntil");
    }

    if (table.effectiveFrom) {
      await queryInterface.removeColumn("availabilities", "effectiveFrom");
    }
  },
};

