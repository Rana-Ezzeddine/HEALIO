
import { DataTypes } from 'sequelize';
import sequelize from '../../database.js';

const CaregiverInvite = sequelize.define('CaregiverInvite', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  // Patient who generated the invite
  patientId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: { model: 'users', key: 'id' },
    onDelete: 'CASCADE',
    onUpdate: 'CASCADE',
  },
  // Secure random token — used in the invite URL
  token: {
    type: DataTypes.STRING(128),
    allowNull: false,
    unique: true,
  },
  // 5.5.f — explicit status states matching spec exactly
  status: {
    type: DataTypes.ENUM('pending', 'active', 'rejected', 'expired'),
    allowNull: false,
    defaultValue: 'pending',
  },
  expiresAt: {
    type: DataTypes.DATE,
    allowNull: false,
  },
  // Set when a caregiver accepts or rejects — null until then
  caregiverId: {
    type: DataTypes.UUID,
    allowNull: true,
    references: { model: 'users', key: 'id' },
    onDelete: 'SET NULL',
    onUpdate: 'CASCADE',
  },
}, {
  tableName: 'caregiver_invites',
  timestamps: true,
  indexes: [
    { fields: ['patientId'] },
    { unique: true, fields: ['token'] },
    { fields: ['status'] },
    { fields: ['caregiverId'] },
    { fields: ['expiresAt'] },
  ],
});

export default CaregiverInvite;