import { DataTypes } from 'sequelize';
import sequelize from '../../database.js';

const Appointment = sequelize.define('Appointment', {
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
  doctorId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'users',
      key: 'id'
    },
    onDelete: 'CASCADE',
    onUpdate: 'CASCADE'
  },
  startsAt: {
    type: DataTypes.DATE,
    allowNull: false
  },
  endsAt: {
    type: DataTypes.DATE,
    allowNull: false
  },
  location: {
    type: DataTypes.STRING,
    allowNull: true
  },
  requestedAt: {
    type: DataTypes.DATE,
    allowNull: true,
    defaultValue: DataTypes.NOW
  },
  status: {
    type: DataTypes.ENUM('requested', 'scheduled', 'cancelled', 'completed', 'denied'),
    allowNull: false,
    defaultValue: 'scheduled'
  },
  notes: {
    type: DataTypes.TEXT,
    allowNull: true
  }
}, {
  tableName: 'appointments',
  timestamps: true,
  validate: {
    endsAfterStart() {
      if (this.startsAt && this.endsAt && this.startsAt >= this.endsAt) {
        throw new Error('endsAt must be after startsAt');
      }
    }
  },
  indexes: [
    {
      fields: ['patientId']
    },
    {
      fields: ['doctorId']
    },
    {
      fields: ['startsAt']
    },
    {
      fields: ['status']
    }
  ]
});

export default Appointment;
