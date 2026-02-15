'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('reminders', {
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
      type: {
        type: Sequelize.ENUM('medication', 'appointment', 'custom'),
        allowNull: false
      },
      relatedId: {
        type: Sequelize.UUID,
        allowNull: true
      },
      scheduledAt: {
        type: Sequelize.DATE,
        allowNull: false
      },
      sentAt: {
        type: Sequelize.DATE,
        allowNull: true
      },
      status: {
        type: Sequelize.ENUM('pending', 'sent', 'dismissed'),
        allowNull: false,
        defaultValue: 'pending'
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

    await queryInterface.addIndex('reminders', ['userId'], {
      name: 'reminders_user_id_idx'
    });

    await queryInterface.addIndex('reminders', ['type'], {
      name: 'reminders_type_idx'
    });

    await queryInterface.addIndex('reminders', ['scheduledAt'], {
      name: 'reminders_scheduled_at_idx'
    });

    await queryInterface.addIndex('reminders', ['status'], {
      name: 'reminders_status_idx'
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('reminders');
  }
};
