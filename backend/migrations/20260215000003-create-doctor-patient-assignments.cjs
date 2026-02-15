'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('doctor_patient_assignments', {
      doctorId: {
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
      status: {
        type: Sequelize.ENUM('active', 'inactive'),
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

    await queryInterface.addIndex('doctor_patient_assignments', ['doctorId'], {
      name: 'doctor_patient_assignments_doctor_id_idx'
    });

    await queryInterface.addIndex('doctor_patient_assignments', ['patientId'], {
      name: 'doctor_patient_assignments_patient_id_idx'
    });

    await queryInterface.addIndex('doctor_patient_assignments', ['status'], {
      name: 'doctor_patient_assignments_status_idx'
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('doctor_patient_assignments');
  }
};
