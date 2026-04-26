"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("caregiver_invites", {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
        allowNull: false,
      },
      patientId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: "users",
          key: "id",
        },
        onDelete: "CASCADE",
        onUpdate: "CASCADE",
      },
      token: {
        type: Sequelize.STRING(128),
        allowNull: false,
        unique: true,
      },
      status: {
        type: Sequelize.ENUM("pending", "active", "rejected", "expired"),
        allowNull: false,
        defaultValue: "pending",
      },
      expiresAt: {
        type: Sequelize.DATE,
        allowNull: false,
      },
      caregiverId: {
        type: Sequelize.UUID,
        allowNull: true,
        references: {
          model: "users",
          key: "id",
        },
        onDelete: "SET NULL",
        onUpdate: "CASCADE",
      },
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
      },
      updatedAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
      },
    });

    await queryInterface.addIndex("caregiver_invites", ["patientId"], {
      name: "caregiver_invites_patient_id_idx",
    });

    await queryInterface.addIndex("caregiver_invites", ["status"], {
      name: "caregiver_invites_status_idx",
    });

    await queryInterface.addIndex("caregiver_invites", ["caregiverId"], {
      name: "caregiver_invites_caregiver_id_idx",
    });

    await queryInterface.addIndex("caregiver_invites", ["expiresAt"], {
      name: "caregiver_invites_expires_at_idx",
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable("caregiver_invites");
  },
};
