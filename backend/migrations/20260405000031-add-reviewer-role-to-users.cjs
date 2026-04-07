'use strict';

module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1
          FROM pg_type t
          JOIN pg_enum e ON t.oid = e.enumtypid
          WHERE t.typname = 'enum_users_role'
            AND e.enumlabel = 'reviewer'
        ) THEN
          ALTER TYPE "enum_users_role" ADD VALUE 'reviewer';
        END IF;
      END
      $$;
    `);
  },

  async down() {
    // Postgres enum value removal is intentionally omitted.
  },
};
