import { DataTypes } from 'sequelize';
import sequelize from '../../database.js';

const Medication = sequelize.define('Medication', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
    allowNull: false
  },
  patientId: {
    type: DataTypes.UUID,
    allowNull: false
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false,
    validate: {
      notEmpty: true
    }
  },
  dosage: {
    type: DataTypes.STRING,
    allowNull: false,
    validate: {
      notEmpty: true
    }
  },
  frequency: {
    type: DataTypes.STRING,
    allowNull: false,
    validate: {
      notEmpty: true
    }
  },
  prescribedBy: {
    type: DataTypes.STRING,
    allowNull: true
  },
  doseAmount: {
    type: DataTypes.FLOAT,
    allowNull: true
  },
  doseUnit: {
    type: DataTypes.STRING,
    allowNull: true
  },
  scheduleJson: {
    type: DataTypes.JSONB,
    allowNull: true
  },
  startDate: {
    type: DataTypes.DATEONLY,
    allowNull: true
  },
  endDate: {
    type: DataTypes.DATEONLY,
    allowNull: true
  },
  notes: {
    type: DataTypes.TEXT,
    allowNull: true
  }
}, {
  tableName: 'medications',
  timestamps: true
});

export default Medication;
