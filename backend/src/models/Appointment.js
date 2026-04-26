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
    type: DataTypes.VIRTUAL,
    get() {
      return this.getDataValue('createdAt');
    }
  },
  status: {
    type: DataTypes.ENUM('requested', 'scheduled', 'reschedule_requested', 'cancelled', 'completed', 'denied'),
    allowNull: false,
    defaultValue: 'scheduled'
  },
  requestSource: {
    type: DataTypes.STRING,
    allowNull: true
  },
  proposedStartsAt: {
    type: DataTypes.DATE,
    allowNull: true
  },
  proposedEndsAt: {
    type: DataTypes.DATE,
    allowNull: true
  },
  proposedLocation: {
    type: DataTypes.STRING,
    allowNull: true
  },
  rescheduleRequestedBy: {
    type: DataTypes.STRING,
    allowNull: true
  },
  rescheduleNotes: {
    type: DataTypes.TEXT,
    allowNull: true
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
