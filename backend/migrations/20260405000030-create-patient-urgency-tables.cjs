'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('patient_urgency_scores', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.literal('gen_random_uuid()'),
        primaryKey: true,
        allowNull: false,
      },
      patientId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'users', key: 'id' },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
      },
      doctorId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'users', key: 'id' },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
      },
      score: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      level: {
        type: Sequelize.ENUM('stable', 'needs_review', 'critical'),
        allowNull: false,
      },
      recommendedAction: {
        type: Sequelize.TEXT,
        allowNull: false,
      },
      source: {
        type: Sequelize.ENUM('deterministic'),
        allowNull: false,
        defaultValue: 'deterministic',
      },
      modelVersion: {
        type: Sequelize.STRING,
        allowNull: false,
        defaultValue: 'deterministic-v1',
      },
      patientSnapshot: {
        type: Sequelize.JSONB,
        allowNull: false,
        defaultValue: {},
      },
      calculatedAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.fn('NOW'),
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

    await queryInterface.addConstraint('patient_urgency_scores', {
      fields: ['patientId', 'doctorId'],
      type: 'unique',
      name: 'patient_urgency_scores_patient_doctor_unique',
    });

    await queryInterface.createTable('patient_urgency_evidence', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.literal('gen_random_uuid()'),
        primaryKey: true,
        allowNull: false,
      },
      urgencyScoreId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'patient_urgency_scores', key: 'id' },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
      },
      code: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      label: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      detail: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      points: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      severity: {
        type: Sequelize.ENUM('info', 'warning', 'critical'),
        allowNull: false,
        defaultValue: 'info',
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

    await queryInterface.createTable('patient_urgency_reviews', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.literal('gen_random_uuid()'),
        primaryKey: true,
        allowNull: false,
      },
      urgencyScoreId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'patient_urgency_scores', key: 'id' },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
      },
      doctorId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'users', key: 'id' },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
      },
      status: {
        type: Sequelize.ENUM('reviewed', 'actioned'),
        allowNull: false,
        defaultValue: 'reviewed',
      },
      note: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      reviewedAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.fn('NOW'),
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

    await queryInterface.createTable('patient_urgency_overrides', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.literal('gen_random_uuid()'),
        primaryKey: true,
        allowNull: false,
      },
      urgencyScoreId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'patient_urgency_scores', key: 'id' },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
      },
      doctorId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'users', key: 'id' },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
      },
      level: {
        type: Sequelize.ENUM('stable', 'needs_review', 'critical'),
        allowNull: false,
      },
      score: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },
      reason: {
        type: Sequelize.TEXT,
        allowNull: false,
      },
      overriddenAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.fn('NOW'),
      },
      active: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true,
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

    await queryInterface.addIndex('patient_urgency_scores', ['doctorId', 'level']);
    await queryInterface.addIndex('patient_urgency_scores', ['doctorId', 'score']);
    await queryInterface.addIndex('patient_urgency_reviews', ['urgencyScoreId', 'reviewedAt']);
    await queryInterface.addIndex('patient_urgency_overrides', ['urgencyScoreId', 'active']);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('patient_urgency_overrides');
    await queryInterface.dropTable('patient_urgency_reviews');
    await queryInterface.dropTable('patient_urgency_evidence');
    await queryInterface.dropTable('patient_urgency_scores');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_patient_urgency_scores_level";');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_patient_urgency_scores_source";');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_patient_urgency_evidence_severity";');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_patient_urgency_reviews_status";');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_patient_urgency_overrides_level";');
  },
};
