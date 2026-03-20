'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.changeColumn('users', 'passwordHash', {
      type: Sequelize.STRING,
      allowNull: true,
    });

    await queryInterface.addColumn('users', 'authProvider', {
      type: Sequelize.ENUM('local', 'google', 'apple'),
      allowNull: false,
      defaultValue: 'local',
    });

    await queryInterface.addColumn('users', 'providerSubject', {
      type: Sequelize.STRING,
      allowNull: true,
    });

    await queryInterface.addIndex('users', ['authProvider'], {
      name: 'users_auth_provider_idx',
    });

    await queryInterface.addIndex('users', ['authProvider', 'providerSubject'], {
      unique: true,
      name: 'users_provider_subject_unique',
      where: {
        providerSubject: {
          [Sequelize.Op.ne]: null,
        },
      },
    });
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
