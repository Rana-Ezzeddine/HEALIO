import { DataTypes } from 'sequelize';
import sequelize from '../../database.js';

const CommunicationContext = sequelize.define('CommunicationContext', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  type: {
    type: DataTypes.ENUM(
      'appointment',
      'symptom',
      'medication',
      'caregiver_invite',
      'care_concern',
      'diagnosis',
      'medical_note'
    ),
    allowNull: false,
  },
  relatedId: {
    type: DataTypes.UUID,
    allowNull: false,
    comment: 'The ID of the related entity (e.g., Appointment ID)',
  },
  metadata: {
    type: DataTypes.JSONB,
    allowNull: true,
    defaultValue: {},
    comment: 'Any additional context data needed for display (e.g., summary, date)',
  },
}, {
  tableName: 'communication_contexts',
  timestamps: true,
  indexes: [
    {
      fields: ['type', 'relatedId'],
    },
  ],
});

export default CommunicationContext;
