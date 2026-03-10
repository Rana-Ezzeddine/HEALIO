import { DataTypes } from 'sequelize';
import sequelize from '../../database.js';

const PatientProfile = sequelize.define('PatientProfile', {
  userId: {
    type: DataTypes.UUID,
    primaryKey: true,
    allowNull: false,
    references: {
      model: 'users',
      key: 'id'
    },
    onDelete: 'CASCADE',
    onUpdate: 'CASCADE'
  },
  firstName: {
    type: DataTypes.STRING,
    allowNull: true
  },
  lastName: {
    type: DataTypes.STRING,
    allowNull: true
  },
  dateOfBirth: {
    type: DataTypes.DATEONLY,
    allowNull: true
  },
  sex: {
    type: DataTypes.STRING,
    allowNull: true
  },
  bloodType: {
    type: DataTypes.STRING,
    allowNull: true
  },
  allergies: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  medicalConditions: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  phoneNumber: {
    type: DataTypes.STRING,
    allowNull: true
  },
  email: {
    type: DataTypes.STRING,
    allowNull: true
  },
  emergencyContact: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  emergencyStatus: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false,
  },
  emergencyStatusUpdatedAt: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  specialization: {
    type: DataTypes.STRING,
    allowNull: true
  },
  yearsOfExperience: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  licenseNb: {
    type: DataTypes.STRING,
    allowNull: true
  },
  clinicName: {
    type: DataTypes.STRING,
    allowNull: true
  },
  clinicAddress: {
    type: DataTypes.STRING,
    allowNull: true
  }
}, {
  tableName: 'patient_profiles',
  timestamps: true,
  indexes: [
    {
      fields: ['userId']
    },
    {
      fields: ['emergencyStatus']
    }
  ]
});

export default PatientProfile;
