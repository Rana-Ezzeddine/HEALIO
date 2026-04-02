import { DataTypes } from 'sequelize';
import sequelize from '../../database.js';

const Availability = sequelize.define('Availability', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  doctorId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'users',
      key: 'id'
    },
    onDelete: 'CASCADE'
  },
  type: {
    type: DataTypes.ENUM('workHours', 'break', 'blocked'),
    allowNull: false,
    defaultValue: 'workHours'
  },
  dayOfWeek: {
    type: DataTypes.INTEGER,
    allowNull: true,
    validate: {
      min: 0,
      max: 6
    }
  },
  specificDate: {
    type: DataTypes.DATEONLY,
    allowNull: true
  },
  startTime: {
    type: DataTypes.TIME,
    allowNull: false
  },
  endTime: {
    type: DataTypes.TIME,
    allowNull: false
  },
  reason: {
    type: DataTypes.STRING,
    allowNull: true
  }
}, {
  tableName: 'availabilities',
  timestamps: true,
  indexes: [
    {
      fields: ['doctorId']
    },
    {
      fields: ['type']
    },
    {
      fields: ['dayOfWeek']
    },
    {
      fields: ['specificDate']
    }
  ]
});

export default Availability;
