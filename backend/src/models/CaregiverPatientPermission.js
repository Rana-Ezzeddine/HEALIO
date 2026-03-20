import { DataTypes } from 'sequelize';
import sequelize from '../../database.js';

const CaregiverPatientPermission = sequelize.define('CaregiverPatientPermission', {
  caregiverId: {
    type: DataTypes.UUID,
    allowNull: false,
    primaryKey: true,
    references: {
      model: 'users',
      key: 'id'
    },
    onDelete: 'CASCADE',
    onUpdate: 'CASCADE'
  },
  patientId: {
    type: DataTypes.UUID,
    allowNull: false,
    primaryKey: true,
    references: {
      model: 'users',
      key: 'id'
    },
    onDelete: 'CASCADE',
    onUpdate: 'CASCADE'
  },
  status: {
    type: DataTypes.STRING,
    allowNull: false,
    defaultValue: 'pending'
  },
  canViewMedications: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false
  },
  canViewSymptoms: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false
  },
  canViewAppointments: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false
  },
  canMessageDoctor: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false
  },
  canReceiveReminders: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false
  }
}, {
  tableName: 'caregiver_patient_permissions',
  timestamps: true,
  indexes: [
    {
      fields: ['caregiverId']
    },
    {
      fields: ['patientId']
    },
    {
      fields: ['status']
    }
  ]
});

export default CaregiverPatientPermission;
