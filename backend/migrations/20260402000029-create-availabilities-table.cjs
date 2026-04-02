'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const tables = await queryInterface.showAllTables();
    const normalized = tables.map((t) => (typeof t === 'string' ? t : t.tableName || t));
    if (normalized.includes('availabilities')) {
      return;
    }

    await queryInterface.createTable('availabilities', {
      id: {
        type: Sequelize.UUID,
        allowNull: false,
        primaryKey: true,
        defaultValue: Sequelize.literal('gen_random_uuid()'),
      },
      doctorId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'users',
          key: 'id',
        },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
      },
      type: {
        type: Sequelize.ENUM('workHours', 'break', 'blocked'),
        allowNull: false,
        defaultValue: 'workHours',
      },
      dayOfWeek: {
        type: Sequelize.INTEGER,
        allowNull: true,
      },
      specificDate: {
        type: Sequelize.DATEONLY,
        allowNull: true,
      },
      startTime: {
        type: Sequelize.TIME,
        allowNull: false,
      },
      endTime: {
        type: Sequelize.TIME,
        allowNull: false,
      },
      reason: {
        type: Sequelize.STRING,
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

    await queryInterface.addIndex('availabilities', ['doctorId'], {
      name: 'availabilities_doctor_id_idx',
    });
    await queryInterface.addIndex('availabilities', ['type'], {
      name: 'availabilities_type_idx',
    });
    await queryInterface.addIndex('availabilities', ['dayOfWeek'], {
      name: 'availabilities_day_of_week_idx',
    });
    await queryInterface.addIndex('availabilities', ['specificDate'], {
      name: 'availabilities_specific_date_idx',
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('availabilities');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_availabilities_type";');
  },
};
