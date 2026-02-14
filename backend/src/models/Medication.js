import { DataTypes } from 'sequelize';
import sequelize from '../../database.js';

const Medication = sequelize.define('Medication', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
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
  prescribedBy: {
    type: DataTypes.STRING,
    allowNull: true,
    defaultValue: null
  },
  startDate: {
    type: DataTypes.DATE,
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
      fields: ['name']
    },
    {
      fields: ['prescribedBy']
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

// Static method
Medication.findByDoctor = function(doctorName) {
  return this.findAll({
    where: {
      prescribedBy: {
        [sequelize.Sequelize.Op.iLike]: `%${doctorName}%`
      }
    }
  });
};

export default Medication;
