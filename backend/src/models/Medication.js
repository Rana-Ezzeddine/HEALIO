import { DataTypes } from 'sequelize';
import sequelize from '../../database.js';

const Medication = sequelize.define('Medication', {
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
        msg: 'Medication name is required'
      }
    }
  },
  doseAmount: {
    type: DataTypes.FLOAT,
    allowNull: true
  },
  doseUnit: {
    type: DataTypes.STRING,
    allowNull: true
  },
  dosage: {
    type: DataTypes.STRING,
    allowNull: false,
    validate: {
      notEmpty: {
        msg: 'Dosage is required'
      }
    }
  },
  frequency: {
    type: DataTypes.STRING,
    allowNull: false,
    validate: {
      notEmpty: {
        msg: 'Frequency is required'
      }
    }
  },
  scheduleJson: {
    type: DataTypes.JSONB,
    allowNull: true
  },
  startDate: {
    type: DataTypes.DATEONLY,
    allowNull: true,
    defaultValue: null
  },
  endDate: {
    type: DataTypes.DATEONLY,
    allowNull: true,
    defaultValue: null
  },
  notes: {
    type: DataTypes.TEXT,
    allowNull: true,
    defaultValue: null
  }
}, {
  tableName: 'medications',
  timestamps: true,
  indexes: [
    {
      fields: ['patientId']
    },
    {
      fields: ['name']
    },
    {
      fields: ['startDate']
    },
    {
      fields: ['createdAt']
    }
  ]
});

// Instance method
Medication.prototype.getFormattedDate = function() {
  if (this.startDate) {
    return this.startDate.toLocaleDateString();
  }
  return null;
};

// Static method - find by patient
Medication.findByPatient = function(patientId) {
  return this.findAll({
    where: { patientId },
    order: [['startDate', 'DESC']]
  });
};

export default Medication;
