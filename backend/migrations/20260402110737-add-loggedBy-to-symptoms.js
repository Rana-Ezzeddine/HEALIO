'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('Symptoms', 'loggedBy', {
      type: Sequelize.ENUM('patient', 'caregiver'),
      allowNull: false,
      defaultValue: 'patient',
    });

    await queryInterface.addColumn('Symptoms', 'loggedByUserId', {
      type: Sequelize.UUID,
      allowNull: true,
      references: {
        model: 'Users',
        key: 'id',
      },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL',
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('Symptoms', 'loggedBy');
    await queryInterface.removeColumn('Symptoms', 'loggedByUserId');
  },
};