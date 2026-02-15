'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('caregiver_patient_permissions', {
      caregiverId: {
        type: Sequelize.UUID,
        allowNull: false,
        primaryKey: true,
        references: {
          model: 'users',
          key: 'id'
        },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE'
      },
      patientId: {
        type: Sequelize.UUID,
        allowNull: false,
        primaryKey: true,
        references: {
          model: 'users',
          key: 'id'
        },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE'
      },
      canViewMedications: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false
      },
      canViewSymptoms: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false
      },
      canViewAppointments: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false
      },
      canMessageDoctor: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false
      },
      canReceiveReminders: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false
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

    await queryInterface.addIndex('caregiver_patient_permissions', ['caregiverId'], {
      name: 'caregiver_patient_permissions_caregiver_id_idx'
    });

    await queryInterface.addIndex('caregiver_patient_permissions', ['patientId'], {
      name: 'caregiver_patient_permissions_patient_id_idx'
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('caregiver_patient_permissions');
  }
};
