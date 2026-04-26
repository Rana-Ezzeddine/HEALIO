"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn("users", "mfaEnabled", {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    });

    await queryInterface.addColumn("users", "mfaSecretEncrypted", {
      type: Sequelize.TEXT,
      allowNull: true,
    });

    await queryInterface.addColumn("users", "mfaRecoveryCodeHashes", {
      type: Sequelize.JSONB,
      allowNull: true,
    });

    await queryInterface.addIndex("users", ["mfaEnabled"], {
      name: "users_mfa_enabled_idx",
    });
  },

  async down(queryInterface) {
    await queryInterface.removeIndex("users", "users_mfa_enabled_idx");
    await queryInterface.removeColumn("users", "mfaRecoveryCodeHashes");
    await queryInterface.removeColumn("users", "mfaSecretEncrypted");
    await queryInterface.removeColumn("users", "mfaEnabled");
  },
};
