import { DataTypes } from 'sequelize';
import sequelize from '../../database.js';

const Medication = sequelize.define('Medication', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
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