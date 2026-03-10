"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
    async up(queryInterface, Sequelize) {
        await queryInterface.createTable("caregiver_notes", {
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
            caregiverId: {
                type: Sequelize.UUID,
                allowNull: false,
                references: {
                    model: "users",
                    key: "id",
                },
                onDelete: "CASCADE",
                onUpdate: "CASCADE",
            },
            note: {
                type: Sequelize.TEXT,
                allowNull: false,
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

        await queryInterface.addIndex("caregiver_notes", ["patientId"], {
            name: "caregiver_notes_patient_id_idx",
        });

        await queryInterface.addIndex("caregiver_notes", ["caregiverId"], {
            name: "caregiver_notes_caregiver_id_idx",
        });

        await queryInterface.addIndex("caregiver_notes", ["createdAt"], {
            name: "caregiver_notes_created_at_idx",
        });
    },

    async down(queryInterface) {
        await queryInterface.dropTable("caregiver_notes");
    },
};