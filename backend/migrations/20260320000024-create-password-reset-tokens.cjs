'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    const tableNames = await queryInterface.showAllTables();
    const normalizedNames = tableNames.map((entry) => (
      typeof entry === 'string' ? entry : entry.tableName
    ));

    if (!normalizedNames.includes('password_reset_tokens')) {
      await queryInterface.createTable('password_reset_tokens', {
        id: {
          type: Sequelize.UUID,
          defaultValue: Sequelize.UUIDV4,
          allowNull: false,
          primaryKey: true,
        },
        userId: {
          type: Sequelize.UUID,
          allowNull: false,
          references: {
            model: 'users',
            key: 'id',
          },
          onUpdate: 'CASCADE',
          onDelete: 'CASCADE',
        },
        tokenHash: {
          type: Sequelize.STRING(64),
          allowNull: false,
          unique: true,
        },
        expiresAt: {
          type: Sequelize.DATE,
          allowNull: false,
        },
        createdAt: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.fn('NOW'),
        },
        updatedAt: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.fn('NOW'),
        },
      });
    }

    const indexes = await queryInterface.showIndex('password_reset_tokens');
    const indexNames = new Set(indexes.map((index) => index.name));

    if (!indexNames.has('password_reset_tokens_user_id_idx')) {
      await queryInterface.addIndex('password_reset_tokens', ['userId'], {
        name: 'password_reset_tokens_user_id_idx',
      });
    }
    if (!indexNames.has('password_reset_tokens_token_hash_unique')) {
      await queryInterface.addIndex('password_reset_tokens', ['tokenHash'], {
        unique: true,
        name: 'password_reset_tokens_token_hash_unique',
      });
    }
    if (!indexNames.has('password_reset_tokens_expires_at_idx')) {
      await queryInterface.addIndex('password_reset_tokens', ['expiresAt'], {
        name: 'password_reset_tokens_expires_at_idx',
      });
    }
  },

  async down(queryInterface) {
    await queryInterface.dropTable('password_reset_tokens');
  },
};
