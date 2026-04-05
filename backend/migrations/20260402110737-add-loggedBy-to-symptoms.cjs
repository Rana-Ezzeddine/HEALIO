'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    const tableName = 'symptoms';
    const table = await queryInterface.describeTable(tableName);

    if (!table.loggedBy) {
      await queryInterface.addColumn(tableName, 'loggedBy', {
        type: Sequelize.ENUM('patient', 'caregiver'),
        allowNull: false,
        defaultValue: 'patient',
      });
    }

    if (!table.loggedByUserId) {
      await queryInterface.addColumn(tableName, 'loggedByUserId', {
        type: Sequelize.UUID,
        allowNull: true,
        references: {
          model: 'users',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      });
    }
  },

  async down(queryInterface, Sequelize) {
    const tableName = 'symptoms';
    const table = await queryInterface.describeTable(tableName);

    if (table.loggedByUserId) {
      await queryInterface.removeColumn(tableName, 'loggedByUserId');
    }
    if (table.loggedBy) {
      await queryInterface.removeColumn(tableName, 'loggedBy');
    }

    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_symptoms_loggedBy";');
  },
};
