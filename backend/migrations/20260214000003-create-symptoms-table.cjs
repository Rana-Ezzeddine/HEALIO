'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('symptoms', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
        allowNull: false
      },
      userId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'users',
          key: 'id'
        },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE'
      },
      symptom: {
        type: Sequelize.STRING,
        allowNull: false
      },
      severity: {
        type: Sequelize.INTEGER,
        allowNull: false
      },
      date: {
        type: Sequelize.DATEONLY,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_DATE')
      },
      notes: {
        type: Sequelize.TEXT,
        allowNull: true,
        defaultValue: ''
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

    await queryInterface.addIndex('symptoms', ['userId'], {
      name: 'symptoms_user_id_idx'
    });

    await queryInterface.addIndex('symptoms', ['date'], {
      name: 'symptoms_date_idx'
    });

    await queryInterface.addIndex('symptoms', ['severity'], {
      name: 'symptoms_severity_idx'
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('symptoms');
  }
};
