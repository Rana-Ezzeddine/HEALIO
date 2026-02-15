'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('diagnoses', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
        allowNull: false
      },
      patientId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'users',
          key: 'id'
        },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE'
      },
      doctorId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'users',
          key: 'id'
        },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE'
      },
      diagnosisText: {
        type: Sequelize.TEXT,
        allowNull: false
      },
      diagnosedAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      },
      status: {
        type: Sequelize.ENUM('active', 'resolved'),
        allowNull: false,
        defaultValue: 'active'
      },
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      },
      updatedAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      }
    });

    await queryInterface.addIndex('diagnoses', ['patientId'], {
      name: 'diagnoses_patient_id_idx'
    });

    await queryInterface.addIndex('diagnoses', ['doctorId'], {
      name: 'diagnoses_doctor_id_idx'
    });

    await queryInterface.addIndex('diagnoses', ['status'], {
      name: 'diagnoses_status_idx'
    });

    await queryInterface.addIndex('diagnoses', ['diagnosedAt'], {
      name: 'diagnoses_diagnosed_at_idx'
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('diagnoses');
  }
};
