'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const table = await queryInterface.describeTable('messages');

    if (!table.contextId) {
      await queryInterface.addColumn('messages', 'contextId', {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'communication_contexts', key: 'id' },
        onDelete: 'SET NULL',
        onUpdate: 'CASCADE',
      });
    }

    await queryInterface.addIndex('messages', ['contextId'], {
      name: 'messages_context_id_idx',
    }).catch(() => null);
  },

  async down(queryInterface) {
    const table = await queryInterface.describeTable('messages');

    await queryInterface.removeIndex('messages', 'messages_context_id_idx').catch(() => null);

    if (table.contextId) {
      await queryInterface.removeColumn('messages', 'contextId');
    }
  },
};
