"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const table = await queryInterface.describeTable("availabilities");

    if (!table.workHoursScope) {
      await queryInterface.addColumn("availabilities", "workHoursScope", {
        type: Sequelize.ENUM("default", "override"),
        allowNull: false,
        defaultValue: "default",
      });
    }
  },

  async down(queryInterface) {
    const table = await queryInterface.describeTable("availabilities");
    if (table.workHoursScope) {
      await queryInterface.removeColumn("availabilities", "workHoursScope");
    }
  },
};

