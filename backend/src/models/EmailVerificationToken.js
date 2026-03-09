import { DataTypes } from 'sequelize';
import sequelize from '../../database.js';

const EmailVerificationToken = sequelize.define('EmailVerificationToken', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  userId: {
    type: DataTypes.UUID,
    allowNull: false,
  },
  tokenHash: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
  },
  expiresAt: {
    type: DataTypes.DATE,
    allowNull: false,
  },
  usedAt: {
    type: DataTypes.DATE,
    allowNull: true,
  },
}, {
  tableName: 'email_verification_tokens',
  timestamps: true,
  indexes: [
    { fields: ['userId'] },
    { fields: ['expiresAt'] },
  ],
});

export default EmailVerificationToken;
