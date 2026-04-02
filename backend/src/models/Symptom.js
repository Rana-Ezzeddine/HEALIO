import { DataTypes } from 'sequelize';
import sequelize from '../../database.js';

const Symptom = sequelize.define('Symptom', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  patientId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'users',
      key: 'id'
    },
    onDelete: 'CASCADE',
    onUpdate: 'CASCADE'
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false,
    validate: {
      notEmpty: {
        msg: 'Symptom name is required'
      }
    }
  },
  severity: {
    type: DataTypes.INTEGER,
    allowNull: false,
    validate: {
      min: 0,
      max: 10,
      isInt: true
    }
  },
  notes: {
    type: DataTypes.TEXT,
    allowNull: true,
    defaultValue: ''
  },
  loggedAt: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW
  },
  loggedBy: {
    type: DataTypes.ENUM('patient', 'caregiver'),
    allowNull: false,
    defaultValue: 'patient',
  },
  loggedByUserId: {
    type: DataTypes.UUID,
    allowNull: true,
    references: { model: 'users', key: 'id' },
    onDelete: 'SET NULL',
    onUpdate: 'CASCADE',
},
}, {
  tableName: 'symptoms',
  timestamps: true,
  indexes: [
    {
      fields: ['patientId']
    },
    {
      fields: ['loggedAt']
    },
    {
      fields: ['severity']
    }
  ]
});

export default Symptom;
