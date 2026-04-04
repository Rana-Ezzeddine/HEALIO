'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const tableMap = {};
    const tables = await queryInterface.showAllTables();
    for (const entry of tables) {
      const name = typeof entry === 'string' ? entry : entry.tableName;
      tableMap[String(name).toLowerCase()] = true;
    }

    if (!tableMap.communication_contexts) {
      await queryInterface.createTable('communication_contexts', {
        id: {
          type: Sequelize.UUID,
          defaultValue: Sequelize.UUIDV4,
          primaryKey: true,
          allowNull: false,
        },
        type: {
          type: Sequelize.ENUM(
            'appointment',
            'symptom',
            'medication',
            'caregiver_invite',
            'care_concern',
            'diagnosis',
            'medical_note'
          ),
          allowNull: false,
        },
        relatedId: {
          type: Sequelize.UUID,
          allowNull: false,
        },
        metadata: {
          type: Sequelize.JSONB,
          allowNull: true,
          defaultValue: {},
        },
        createdAt: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
        },
        updatedAt: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
        },
      });

      await queryInterface.addIndex('communication_contexts', ['type', 'relatedId'], {
        name: 'communication_contexts_type_related_id_idx',
      });
    }

    if (!tableMap.notifications) {
      await queryInterface.createTable('notifications', {
        id: {
          type: Sequelize.UUID,
          defaultValue: Sequelize.UUIDV4,
          primaryKey: true,
          allowNull: false,
        },
        userId: {
          type: Sequelize.UUID,
          allowNull: false,
          references: { model: 'users', key: 'id' },
          onDelete: 'CASCADE',
          onUpdate: 'CASCADE',
        },
        type: {
          type: Sequelize.ENUM('info', 'success', 'warning', 'error'),
          allowNull: false,
          defaultValue: 'info',
        },
        category: {
          type: Sequelize.STRING,
          allowNull: false,
        },
        title: {
          type: Sequelize.STRING,
          allowNull: false,
        },
        message: {
          type: Sequelize.TEXT,
          allowNull: false,
        },
        status: {
          type: Sequelize.ENUM('unread', 'read', 'archived'),
          allowNull: false,
          defaultValue: 'unread',
        },
        contextId: {
          type: Sequelize.UUID,
          allowNull: true,
          references: { model: 'communication_contexts', key: 'id' },
          onDelete: 'SET NULL',
          onUpdate: 'CASCADE',
        },
        metadata: {
          type: Sequelize.JSONB,
          allowNull: true,
          defaultValue: {},
        },
        readAt: {
          type: Sequelize.DATE,
          allowNull: true,
        },
        createdAt: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
        },
        updatedAt: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
        },
      });

      await queryInterface.addIndex('notifications', ['userId'], { name: 'notifications_user_id_idx' });
      await queryInterface.addIndex('notifications', ['status'], { name: 'notifications_status_idx' });
      await queryInterface.addIndex('notifications', ['category'], { name: 'notifications_category_idx' });
      await queryInterface.addIndex('notifications', ['createdAt'], { name: 'notifications_created_at_idx' });
    }
  },

  async down(queryInterface) {
    const tables = await queryInterface.showAllTables();
    const names = new Set(tables.map((entry) => String(typeof entry === 'string' ? entry : entry.tableName).toLowerCase()));

    if (names.has('notifications')) {
      await queryInterface.dropTable('notifications');
    }

    if (names.has('communication_contexts')) {
      await queryInterface.dropTable('communication_contexts');
    }
  },
};
