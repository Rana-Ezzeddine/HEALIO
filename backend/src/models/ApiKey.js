import { DataTypes } from 'sequelize';
import sequelize from '../../database.js';

const ApiKey = sequelize.define('ApiKey', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  key: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  scopes: {
    type: DataTypes.JSONB,
    allowNull: false,
    defaultValue: [],
  },
  ownerId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'users',
      key: 'id'
    },
    onDelete: 'CASCADE'
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
  },
  lastUsedAt: {
    type: DataTypes.DATE,
    allowNull: true,
  }
}, {
  tableName: 'api_keys',
  timestamps: true,
});

export default ApiKey;
