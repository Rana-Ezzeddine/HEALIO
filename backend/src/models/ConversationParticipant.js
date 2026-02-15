import { DataTypes } from 'sequelize';
import sequelize from '../../database.js';

const ConversationParticipant = sequelize.define('ConversationParticipant', {
  conversationId: {
    type: DataTypes.UUID,
    allowNull: false,
    primaryKey: true,
    references: {
      model: 'conversations',
      key: 'id'
    },
    onDelete: 'CASCADE',
    onUpdate: 'CASCADE'
  },
  userId: {
    type: DataTypes.UUID,
    allowNull: false,
    primaryKey: true,
    references: {
      model: 'users',
      key: 'id'
    },
    onDelete: 'CASCADE',
    onUpdate: 'CASCADE'
  }
}, {
  tableName: 'conversation_participants',
  timestamps: false,
  indexes: [
    {
      fields: ['conversationId']
    },
    {
      fields: ['userId']
    }
  ]
});

export default ConversationParticipant;
