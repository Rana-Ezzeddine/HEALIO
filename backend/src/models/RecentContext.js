import { DataTypes } from 'sequelize';
import sequelize from '../../database.js';

const RecentContext = sequelize.define('RecentContext', {
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
      key: 'id'
    },
    onDelete: 'CASCADE'
  },
  patientId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'users',
      key: 'id'
    },
    onDelete: 'CASCADE'
  },
  lastAccessedAt: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW
  }
}, {
  tableName: 'recent_contexts',
  timestamps: false,
  indexes: [
    {
      unique: true,
      fields: ['userId', 'patientId']
    }
  ]
});

export default RecentContext;
