'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    const tableNames = await queryInterface.showAllTables();
    const normalizedNames = tableNames.map((entry) => (
      typeof entry === 'string' ? entry : entry.tableName
    ));

    await queryInterface.sequelize.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'enum_availabilities_type') THEN
          CREATE TYPE "enum_availabilities_type" AS ENUM ('workHours', 'break', 'blocked');
        END IF;
      END$$;
    `);

    if (!normalizedNames.includes('availabilities')) {
      await queryInterface.createTable('availabilities', {
        id: {
          type: Sequelize.UUID,
          defaultValue: Sequelize.UUIDV4,
          allowNull: false,
          primaryKey: true,
        },
        doctorId: {
          type: Sequelize.UUID,
          allowNull: false,
          references: {
            model: 'users',
            key: 'id',
          },
          onUpdate: 'CASCADE',
          onDelete: 'CASCADE',
        },
        type: {
          type: 'enum_availabilities_type',
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
          defaultValue: Sequelize.fn('NOW'),
        },
        updatedAt: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.fn('NOW'),
        },
      });
    }

    const indexes = await queryInterface.showIndex('availabilities');
    const indexNames = new Set(indexes.map((index) => index.name));

    if (!indexNames.has('availabilities_doctor_id_idx')) {
      await queryInterface.addIndex('availabilities', ['doctorId'], {
        name: 'availabilities_doctor_id_idx',
      });
    }
    if (!indexNames.has('availabilities_type_idx')) {
      await queryInterface.addIndex('availabilities', ['type'], {
        name: 'availabilities_type_idx',
      });
    }
    if (!indexNames.has('availabilities_day_of_week_idx')) {
      await queryInterface.addIndex('availabilities', ['dayOfWeek'], {
        name: 'availabilities_day_of_week_idx',
      });
    }
    if (!indexNames.has('availabilities_specific_date_idx')) {
      await queryInterface.addIndex('availabilities', ['specificDate'], {
        name: 'availabilities_specific_date_idx',
      });
    }
  },

  async down(queryInterface) {
    await queryInterface.dropTable('availabilities');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_availabilities_type";');
  },
};
