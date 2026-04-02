/**
 * HEALIO Database Models
 *
 * This file imports all models and defines their associations.
 * Import this file instead of individual models to ensure associations are loaded.
 */

import User from './User.js';
import PatientProfile from './PatientProfile.js';
import DoctorPatientAssignment from './DoctorPatientAssignment.js';
import CaregiverPatientPermission from './CaregiverPatientPermission.js';
import Medication from './Medication.js';
import Symptom from './Symptom.js';
import Diagnosis from './Diagnosis.js';
import MedicalNote from './MedicalNote.js';
import Appointment from './Appointment.js';
import Conversation from './Conversation.js';
import ConversationParticipant from './ConversationParticipant.js';
import Message from './Message.js';
import Reminder from './Reminder.js';
import ActivityLog from './ActivityLog.js';
import CaregiverNote from './CaregiverNote.js';
import PasswordResetToken from './PasswordResetToken.js';

import CaregiverInvite from './CaregiverInvite.js';
import EmailVerificationToken from './EmailVerificationToken.js';

import Availability from './Availability.js';


// ========================================
// ASSOCIATIONS
// ========================================

// User ↔ Availability (1:Many)
User.hasMany(Availability, {
  foreignKey: 'doctorId',
  as: 'availabilities',
  onDelete: 'CASCADE'
});
Availability.belongsTo(User, {
  foreignKey: 'doctorId',
  as: 'doctor'
});

// User ↔ PatientProfile (1:1)
User.hasOne(PatientProfile, {
  foreignKey: 'userId',
  as: 'patientProfile',
  onDelete: 'CASCADE'
});
PatientProfile.belongsTo(User, {
  foreignKey: 'userId',
  as: 'user'
});

// User ↔ ActivityLog (1:Many)
User.hasMany(ActivityLog, {
  foreignKey: 'userId',
  as: 'activityLogs',
  onDelete: 'SET NULL',
});
ActivityLog.belongsTo(User, {
  foreignKey: 'userId',
  as: 'user',
});

// User ↔ Password Reset Tokens (1:Many)
User.hasMany(PasswordResetToken, {
  foreignKey: 'userId',
  as: 'passwordResetTokens',
  onDelete: 'CASCADE',
});
PasswordResetToken.belongsTo(User, {
  foreignKey: 'userId',
  as: 'user',
});

// Doctor ↔ Patient (Many-to-Many via DoctorPatientAssignment)
User.belongsToMany(User, {
  through: DoctorPatientAssignment,
  as: 'patients',
  foreignKey: 'doctorId',
  otherKey: 'patientId'
});
User.belongsToMany(User, {
  through: DoctorPatientAssignment,
  as: 'doctors',
  foreignKey: 'patientId',
  otherKey: 'doctorId'
});

// Caregiver ↔ Patient (Many-to-Many via CaregiverPatientPermission)
User.belongsToMany(User, {
  through: CaregiverPatientPermission,
  as: 'patientsUnderCare',
  foreignKey: 'caregiverId',
  otherKey: 'patientId'
});
User.belongsToMany(User, {
  through: CaregiverPatientPermission,
  as: 'caregivers',
  foreignKey: 'patientId',
  otherKey: 'caregiverId'
});

// Patient ↔ Caregiver Notes
User.hasMany(CaregiverNote, {
  foreignKey: 'patientId',
  as: 'caregiverNotes',
  onDelete: 'CASCADE'
});
CaregiverNote.belongsTo(User, {
  foreignKey: 'patientId',
  as: 'patient'
});

// Caregiver ↔ Notes Written
User.hasMany(CaregiverNote, {
  foreignKey: 'caregiverId',
  as: 'notesWrittenByCaregiver',
  onDelete: 'CASCADE'
});
CaregiverNote.belongsTo(User, {
  foreignKey: 'caregiverId',
  as: 'caregiver'
});

// Patient ↔ Medications (1:Many)
User.hasMany(Medication, {
  foreignKey: 'patientId',
  as: 'medications',
  onDelete: 'CASCADE'
});
Medication.belongsTo(User, {
  foreignKey: 'patientId',
  as: 'patient'
});

// Patient ↔ Symptoms (1:Many)
User.hasMany(Symptom, {
  foreignKey: 'patientId',
  as: 'symptoms',
  onDelete: 'CASCADE'
});
Symptom.belongsTo(User, {
  foreignKey: 'patientId',
  as: 'patient'
});

// Patient/Doctor ↔ Diagnoses
User.hasMany(Diagnosis, {
  foreignKey: 'patientId',
  as: 'diagnoses',
  onDelete: 'CASCADE'
});
Diagnosis.belongsTo(User, {
  foreignKey: 'patientId',
  as: 'patient'
});

User.hasMany(Diagnosis, {
  foreignKey: 'doctorId',
  as: 'diagnosesGiven',
  onDelete: 'CASCADE'
});
Diagnosis.belongsTo(User, {
  foreignKey: 'doctorId',
  as: 'doctor'
});

// Patient/Doctor ↔ Medical Notes
User.hasMany(MedicalNote, {
  foreignKey: 'patientId',
  as: 'medicalNotes',
  onDelete: 'CASCADE'
});
MedicalNote.belongsTo(User, {
  foreignKey: 'patientId',
  as: 'patient'
});

User.hasMany(MedicalNote, {
  foreignKey: 'doctorId',
  as: 'notesWritten',
  onDelete: 'CASCADE'
});
MedicalNote.belongsTo(User, {
  foreignKey: 'doctorId',
  as: 'doctor'
});

// Patient/Doctor ↔ Appointments
User.hasMany(Appointment, {
  foreignKey: 'patientId',
  as: 'appointmentsAsPatient',
  onDelete: 'CASCADE'
});
Appointment.belongsTo(User, {
  foreignKey: 'patientId',
  as: 'patient'
});

User.hasMany(Appointment, {
  foreignKey: 'doctorId',
  as: 'appointmentsAsDoctor',
  onDelete: 'CASCADE'
});
Appointment.belongsTo(User, {
  foreignKey: 'doctorId',
  as: 'doctor'
});

// Conversation ↔ Users (Many-to-Many via ConversationParticipant)
Conversation.belongsToMany(User, {
  through: ConversationParticipant,
  foreignKey: 'conversationId',
  otherKey: 'userId',
  as: 'participants'
});
User.belongsToMany(Conversation, {
  through: ConversationParticipant,
  foreignKey: 'userId',
  otherKey: 'conversationId',
  as: 'conversations'
});

// Conversation ↔ Messages (1:Many)
Conversation.hasMany(Message, {
  foreignKey: 'conversationId',
  as: 'messages',
  onDelete: 'CASCADE'
});
Message.belongsTo(Conversation, {
  foreignKey: 'conversationId',
  as: 'conversation'
});

// User (sender) ↔ Messages (1:Many)
User.hasMany(Message, {
  foreignKey: 'senderId',
  as: 'messagesSent',
  onDelete: 'CASCADE'
});
Message.belongsTo(User, {
  foreignKey: 'senderId',
  as: 'sender'
});

// User ↔ Reminders (1:Many)
User.hasMany(Reminder, {
  foreignKey: 'userId',
  as: 'reminders',
  onDelete: 'CASCADE'
});
Reminder.belongsTo(User, {
  foreignKey: 'userId',
  as: 'user'
});
// Patient ↔ CaregiverInvites (1:Many)
User.hasMany(CaregiverInvite, {
  foreignKey: 'patientId',
  as: 'caregiverInvites',
  onDelete: 'CASCADE',
});
CaregiverInvite.belongsTo(User, {
  foreignKey: 'patientId',
  as: 'patient',
});

// Caregiver ↔ CaregiverInvites accepted (1:Many)
User.hasMany(CaregiverInvite, {
  foreignKey: 'caregiverId',
  as: 'acceptedInvites',
  onDelete: 'SET NULL',
});
CaregiverInvite.belongsTo(User, {
  foreignKey: 'caregiverId',
  as: 'caregiver',
});

// ========================================
// EXPORT ALL MODELS
// ========================================

export {
  User,
  PatientProfile,
  DoctorPatientAssignment,
  CaregiverPatientPermission,
  Medication,
  Symptom,
  Diagnosis,
  MedicalNote,
  Appointment,
  Conversation,
  ConversationParticipant,
  Message,
  Reminder,
  ActivityLog,
  CaregiverNote,
  CaregiverInvite,
  Availability,
};

export default {
  User,
  PatientProfile,
  DoctorPatientAssignment,
  CaregiverPatientPermission,
  Medication,
  Symptom,
  Diagnosis,
  MedicalNote,
  Appointment,
  Conversation,
  ConversationParticipant,
  Message,
  Reminder,
  ActivityLog,
  CaregiverNote,
  CaregiverInvite,
  Availability,
};
