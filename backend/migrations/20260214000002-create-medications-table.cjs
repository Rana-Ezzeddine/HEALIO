'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('medications', {
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
      name: {
        type: Sequelize.STRING,
        allowNull: false
      },
      doseAmount: {
        type: Sequelize.FLOAT,
        allowNull: true
      },
      doseUnit: {
        type: Sequelize.STRING,
        allowNull: true
      },
      dosage: {
        type: Sequelize.STRING,
        allowNull: false
      },
      frequency: {
        type: Sequelize.STRING,
        allowNull: false
      },
      scheduleJson: {
        type: Sequelize.JSONB,
        allowNull: true
      },
      startDate: {
        type: Sequelize.DATEONLY,
        allowNull: true,
        defaultValue: null
      },
      endDate: {
        type: Sequelize.DATEONLY,
        allowNull: true,
        defaultValue: null
      },
      notes: {
        type: Sequelize.TEXT,
        allowNull: true,
        defaultValue: null
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

    await queryInterface.addIndex('medications', ['patientId'], {
      name: 'medications_patient_id_idx'
    });

    await queryInterface.addIndex('medications', ['name'], {
      name: 'medications_name_idx'
    });

    await queryInterface.addIndex('medications', ['startDate'], {
      name: 'medications_start_date_idx'
    });

    await queryInterface.addIndex('medications', ['createdAt'], {
      name: 'medications_created_at_idx'
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('medications');
  }
};
