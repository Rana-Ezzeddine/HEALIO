import { DataTypes } from 'sequelize';
import sequelize from '../../database.js';

const Notification = sequelize.define('Notification', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  userId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'users',
      key: 'id',
    },
    onDelete: 'CASCADE',
    onUpdate: 'CASCADE',
  },
  type: {
    type: DataTypes.ENUM('info', 'success', 'warning', 'error'),
    allowNull: false,
    defaultValue: 'info',
  },
  category: {
    type: DataTypes.STRING,
    allowNull: false,
    comment: 'e.g., appointment_update, medication_reminder, caregiver_approval',
  },
  title: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  message: {
    type: DataTypes.TEXT,
    allowNull: false,
  },
  status: {
    type: DataTypes.ENUM('unread', 'read', 'archived'),
    allowNull: false,
    defaultValue: 'unread',
  },
  contextId: {
    type: DataTypes.UUID,
    allowNull: true,
    references: {
      model: 'communication_contexts',
      key: 'id',
    },
    onDelete: 'SET NULL',
    onUpdate: 'CASCADE',
  },
  metadata: {
    type: DataTypes.JSONB,
    allowNull: true,
    defaultValue: {},
  },
  readAt: {
    type: DataTypes.DATE,
    allowNull: true,
  },
}, {
  tableName: 'notifications',
  timestamps: true,
  indexes: [
    { fields: ['userId'] },
    { fields: ['status'] },
    { fields: ['category'] },
    { fields: ['createdAt'] },
  ],
});

export default Notification;
