'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    const table = await queryInterface.describeTable('users');
    const indexes = await queryInterface.showIndex('users');
    const indexNames = new Set(indexes.map((index) => index.name));

    if (table.passwordHash?.allowNull === false) {
      await queryInterface.changeColumn('users', 'passwordHash', {
        type: Sequelize.STRING,
        allowNull: true,
      });
    }

    if (!table.authProvider) {
      await queryInterface.addColumn('users', 'authProvider', {
        type: Sequelize.ENUM('local', 'google', 'apple'),
        allowNull: false,
        defaultValue: 'local',
      });
    }

    if (!table.providerSubject) {
      await queryInterface.addColumn('users', 'providerSubject', {
        type: Sequelize.STRING,
        allowNull: true,
      });
    }

    if (!indexNames.has('users_auth_provider_idx')) {
      await queryInterface.addIndex('users', ['authProvider'], {
        name: 'users_auth_provider_idx',
      });
    }

    if (!indexNames.has('users_provider_subject_unique')) {
      await queryInterface.addIndex('users', ['authProvider', 'providerSubject'], {
        unique: true,
        name: 'users_provider_subject_unique',
        where: {
          providerSubject: {
            [Sequelize.Op.ne]: null,
          },
        },
      });
    }
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeIndex('users', 'users_provider_subject_unique');
    await queryInterface.removeIndex('users', 'users_auth_provider_idx');
    await queryInterface.removeColumn('users', 'providerSubject');
    await queryInterface.removeColumn('users', 'authProvider');

    await queryInterface.changeColumn('users', 'passwordHash', {
      type: Sequelize.STRING,
      allowNull: false,
    });

    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_users_authProvider";');
  },
};
