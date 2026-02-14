import { DataTypes } from 'sequelize';
import sequelize from '../../database.js';
import User from './User.js';

const Symptom = sequelize.define('Symptom', {
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
  symptom: {
    type: DataTypes.STRING,
    allowNull: false,
    validate: {
      notEmpty: {
        msg: 'Symptom is required'
      }
    }
  },
  severity: {
    type: DataTypes.INTEGER,
    allowNull: false,
    validate: {
      min: 1,
      max: 10,
      isInt: true
    }
  },
  date: {
    type: DataTypes.DATEONLY,
    allowNull: false,
    defaultValue: DataTypes.NOW
  },
  notes: {
    type: DataTypes.TEXT,
    allowNull: true,
    defaultValue: ''
  }
}, {
  tableName: 'symptoms',
  timestamps: true,
  indexes: [
    {
      fields: ['userId']
    },
    {
      fields: ['date']
    },
    {
      fields: ['severity']
    }
  ]
});

// Define associations
Symptom.belongsTo(User, { foreignKey: 'userId', as: 'user' });
User.hasMany(Symptom, { foreignKey: 'userId', as: 'symptoms' });

export default Symptom;
