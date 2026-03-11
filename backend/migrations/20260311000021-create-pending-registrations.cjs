'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('pending_registrations', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        allowNull: false,
        primaryKey: true,
      },
      firstName: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      lastName: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      email: {
        type: Sequelize.STRING,
        allowNull: false,
        unique: true,
      },
      passwordHash: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      role: {
        type: Sequelize.ENUM('patient', 'doctor', 'caregiver'),
        allowNull: false,
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

    await queryInterface.addIndex('pending_registrations', ['email'], {
      unique: true,
      name: 'pending_registrations_email_unique',
    });
    await queryInterface.addIndex('pending_registrations', ['tokenHash'], {
      unique: true,
      name: 'pending_registrations_token_hash_unique',
    });
    await queryInterface.addIndex('pending_registrations', ['expiresAt'], {
      name: 'pending_registrations_expires_at_idx',
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('pending_registrations');
  },
};
