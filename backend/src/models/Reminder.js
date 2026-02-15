import { DataTypes } from 'sequelize';
import sequelize from '../../database.js';

const Reminder = sequelize.define('Reminder', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  userId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'users',
      key: 'id'
    },
    onDelete: 'CASCADE',
    onUpdate: 'CASCADE'
  },
  type: {
    type: DataTypes.ENUM('medication', 'appointment', 'custom'),
    allowNull: false
  },
  relatedId: {
    type: DataTypes.UUID,
    allowNull: true,
    comment: 'ID of related medication/appointment if applicable'
  },
  scheduledAt: {
    type: DataTypes.DATE,
    allowNull: false
  },
  sentAt: {
    type: DataTypes.DATE,
    allowNull: true
  },
  status: {
    type: DataTypes.ENUM('pending', 'sent', 'dismissed'),
    allowNull: false,
    defaultValue: 'pending'
  }
}, {
  tableName: 'reminders',
  timestamps: true,
  indexes: [
    {
      fields: ['userId']
    },
    {
      fields: ['type']
    },
    {
      fields: ['scheduledAt']
    },
    {
      fields: ['status']
    }
  ]
});

export default Reminder;
