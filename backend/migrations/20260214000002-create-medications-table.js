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
      name: {
        type: Sequelize.STRING,
        allowNull: false
      },
      dosage: {
        type: Sequelize.STRING,
        allowNull: false
      },
      frequency: {
        type: Sequelize.STRING,
        allowNull: false
      },
      prescribedBy: {
        type: Sequelize.STRING,
        allowNull: true,
        defaultValue: null
      },
      startDate: {
        type: Sequelize.DATE,
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

    await queryInterface.addIndex('medications', ['name'], {
      name: 'medications_name_idx'
    });

    await queryInterface.addIndex('medications', ['prescribedBy'], {
      name: 'medications_prescribed_by_idx'
    });

    await queryInterface.addIndex('medications', ['createdAt'], {
      name: 'medications_created_at_idx'
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('medications');
  }
};
