import { DataTypes } from 'sequelize';
import sequelize from '../../database.js';

const DOCTOR_APPROVAL_VALUES = [
  'not_applicable',
  'unverified',
  'pending_approval',
  'approved',
  'rejected',
];

const User = sequelize.define('User', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  email: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
    validate: {
      isEmail: true
    },
    set(value) {
      this.setDataValue('email', value.toLowerCase().trim());
    }
  },
  passwordHash: {
    type: DataTypes.STRING,
    allowNull: true
  },
  authProvider: {
    type: DataTypes.ENUM('local', 'google', 'apple'),
    allowNull: false,
    defaultValue: 'local'
  },
  providerSubject: {
    type: DataTypes.STRING,
    allowNull: true
  },
  role: {
    type: DataTypes.ENUM('patient', 'doctor', 'caregiver'),
    defaultValue: 'patient',
    allowNull: false
  },
  isVerified: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    allowNull: false
  },
  doctorApprovalStatus: {
    type: DataTypes.ENUM(...DOCTOR_APPROVAL_VALUES),
    allowNull: false,
    defaultValue: 'not_applicable'
  },
  doctorApprovalNotes: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  doctorApprovalRequestedInfoAt: {
    type: DataTypes.DATE,
    allowNull: true
  },
  doctorApprovalReviewedAt: {
    type: DataTypes.DATE,
    allowNull: true
  }
}, {
  tableName: 'users',
  timestamps: true,
  hooks: {
    beforeValidate(user) {
      if (user.role === 'doctor') {
        if (!user.doctorApprovalStatus || user.doctorApprovalStatus === 'not_applicable') {
          user.doctorApprovalStatus = user.isVerified ? 'approved' : 'unverified';
        }
      } else if (!user.doctorApprovalStatus) {
        user.doctorApprovalStatus = 'not_applicable';
      }
    }
  },
  indexes: [
    {
      unique: true,
      fields: ['email']
    },
    {
      fields: ['authProvider']
    },
    {
      fields: ['doctorApprovalStatus']
    }
  ],
  defaultScope: {
    attributes: { exclude: ['passwordHash'] }
  },
  scopes: {
    withPassword: {
      attributes: { include: ['passwordHash'] }
    }
  }
});

export default User;
