'use strict';

module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(`
      DO $$
      BEGIN
        BEGIN
          ALTER TYPE "enum_appointments_status" ADD VALUE IF NOT EXISTS 'requested';
        EXCEPTION
          WHEN duplicate_object THEN NULL;
        END;

        BEGIN
          ALTER TYPE "enum_appointments_status" ADD VALUE IF NOT EXISTS 'denied';
        EXCEPTION
          WHEN duplicate_object THEN NULL;
        END;
      END $$;
    `);
  },

  async down() {
    // PostgreSQL ENUM value removal is non-trivial; left intentionally empty.
  }
};
