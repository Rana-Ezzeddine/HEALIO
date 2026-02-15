import { DataTypes } from 'sequelize';
import sequelize from '../../database.js';

const DoctorPatientAssignment = sequelize.define('DoctorPatientAssignment', {
  doctorId: {
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
    type: DataTypes.ENUM('active', 'inactive'),
    allowNull: false,
    defaultValue: 'active'
  }
}, {
  tableName: 'doctor_patient_assignments',
  timestamps: true,
  indexes: [
    {
      fields: ['doctorId']
    },
    {
      fields: ['patientId']
    },
    {
      fields: ['status']
    }
  ]
});

export default DoctorPatientAssignment;
