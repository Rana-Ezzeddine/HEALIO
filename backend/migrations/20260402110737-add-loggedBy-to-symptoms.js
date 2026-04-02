'use strict';

export default {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('symptoms', 'loggedBy', {
      type: Sequelize.ENUM('patient', 'caregiver'),
      allowNull: false,
      defaultValue: 'patient',
    });

    await queryInterface.addColumn('symptoms', 'loggedByUserId', {
      type: Sequelize.UUID,
      allowNull: true,
      references: {
        model: 'users',
        key: 'id',
      },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL',
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('symptoms', 'loggedBy');
    await queryInterface.removeColumn('symptoms', 'loggedByUserId');
  },
};