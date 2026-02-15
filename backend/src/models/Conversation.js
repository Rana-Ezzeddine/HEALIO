import { DataTypes } from 'sequelize';
import sequelize from '../../database.js';

const Conversation = sequelize.define('Conversation', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  }
}, {
  tableName: 'conversations',
  timestamps: true
});

export default Conversation;
