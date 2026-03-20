'use strict';

const APPROVAL_VALUES = ['not_applicable', 'unverified', 'pending_approval', 'approved', 'rejected'];

module.exports = {
  async up(queryInterface, Sequelize) {
    const table = await queryInterface.describeTable('users');

    if (!table.doctorApprovalStatus) {
      await queryInterface.addColumn('users', 'doctorApprovalStatus', {
        type: Sequelize.ENUM(...APPROVAL_VALUES),
        allowNull: false,
        defaultValue: 'not_applicable',
      });
    }

    if (!table.doctorApprovalNotes) {
      await queryInterface.addColumn('users', 'doctorApprovalNotes', {
        type: Sequelize.TEXT,
        allowNull: true,
      });
    }

    if (!table.doctorApprovalRequestedInfoAt) {
      await queryInterface.addColumn('users', 'doctorApprovalRequestedInfoAt', {
        type: Sequelize.DATE,
        allowNull: true,
      });
    }

    if (!table.doctorApprovalReviewedAt) {
      await queryInterface.addColumn('users', 'doctorApprovalReviewedAt', {
        type: Sequelize.DATE,
        allowNull: true,
      });
    }

    await queryInterface.sequelize.query(`
      UPDATE users
      SET "doctorApprovalStatus" = CASE
        WHEN role = 'doctor' AND "isVerified" = FALSE THEN 'unverified'::"enum_users_doctorApprovalStatus"
        WHEN role = 'doctor' AND "isVerified" = TRUE THEN 'approved'::"enum_users_doctorApprovalStatus"
        ELSE 'not_applicable'::"enum_users_doctorApprovalStatus"
      END
    `);

    const indexes = await queryInterface.showIndex('users');
    if (!indexes.some((index) => index.name === 'users_doctor_approval_status_idx')) {
      await queryInterface.addIndex('users', ['doctorApprovalStatus'], {
        name: 'users_doctor_approval_status_idx',
      });
    }
  },

  async down(queryInterface) {
    const table = await queryInterface.describeTable('users');
    if (table.doctorApprovalReviewedAt) {
      await queryInterface.removeColumn('users', 'doctorApprovalReviewedAt');
    }
    if (table.doctorApprovalRequestedInfoAt) {
      await queryInterface.removeColumn('users', 'doctorApprovalRequestedInfoAt');
    }
    if (table.doctorApprovalNotes) {
      await queryInterface.removeColumn('users', 'doctorApprovalNotes');
    }
    if (table.doctorApprovalStatus) {
      await queryInterface.removeColumn('users', 'doctorApprovalStatus');
    }
  },
};
