# HEALIO PostgreSQL Database Schema

## Complete Relational Database Design

This document describes the complete PostgreSQL schema for the HEALIO healthcare management platform.

---

## Table of Contents
1. [Overview](#overview)
2. [Entity Relationship Diagram](#entity-relationship-diagram)
3. [Tables](#tables)
4. [Relationships](#relationships)
5. [Indexes](#indexes)
6. [Recommended API Structure](#recommended-api-structure)

---

## Overview

**Database**: PostgreSQL 14+
**ORM**: Sequelize
**Primary Key Type**: UUID (universally unique identifier)
**Cascade Delete**: Enabled where appropriate

### Core Entities
- **Users** (patient, doctor, caregiver)
- **Patient Profiles** (extended patient data)
- **Medications** (patient medications)
- **Symptoms** (patient symptom logs)
- **Diagnoses** (doctor-assigned diagnoses)
- **Medical Notes** (doctor notes on patients)
- **Appointments** (doctor-patient appointments)
- **Conversations & Messages** (internal messaging)
- **Reminders** (medication/appointment reminders)
- **Permissions** (caregiver access control)
- **Assignments** (doctor-patient relationships)

---

## Entity Relationship Diagram

```
users (1) ─── (1) patient_profiles
  │
  ├─(1:M)─── medications
  ├─(1:M)─── symptoms
  ├─(1:M)─── reminders
  │
  ├─(M:N via doctor_patient_assignments)─── users (doctors)
  ├─(M:N via caregiver_patient_permissions)─── users (caregivers)
  │
  ├─(1:M as patient)─── diagnoses ───(M:1 as doctor)─── users
  ├─(1:M as patient)─── medical_notes ───(M:1 as doctor)─── users
  ├─(1:M as patient)─── appointments ───(M:1 as doctor)─── users
  │
  └─(M:N via conversation_participants)─── conversations ───(1:M)─── messages
```

---

## Tables

### 1. **users**
Core identity and authentication table.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PRIMARY KEY | User identifier |
| `email` | VARCHAR | UNIQUE, NOT NULL | Email address (unique login) |
| `passwordHash` | VARCHAR | NOT NULL | Bcrypt-hashed password |
| `role` | ENUM | NOT NULL | `patient`, `doctor`, `caregiver` |
| `isVerified` | BOOLEAN | DEFAULT false | Email verification status |
| `createdAt` | TIMESTAMP | NOT NULL | Account creation timestamp |
| `updatedAt` | TIMESTAMP | NOT NULL | Last update timestamp |

**Indexes:**
- `users_email_unique` (unique index on `email`)

**Relationships:**
- 1:1 with `patient_profiles` (if role = patient)
- 1:M with `medications`, `symptoms`, `reminders`
- M:N with other users via `doctor_patient_assignments`, `caregiver_patient_permissions`

---

### 2. **patient_profiles**
Extended patient information (1:1 with users where role=patient).

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `userId` | UUID | PRIMARY KEY, FK → users.id | Patient user ID |
| `firstName` | VARCHAR | | First name |
| `lastName` | VARCHAR | | Last name |
| `dateOfBirth` | DATE | | Date of birth |
| `sex` | VARCHAR | | Biological sex |
| `bloodType` | VARCHAR | | Blood type (e.g., O+) |
| `allergies` | TEXT | | Known allergies |
| `medicalConditions` | TEXT | | Pre-existing conditions |
| `createdAt` | TIMESTAMP | NOT NULL | |
| `updatedAt` | TIMESTAMP | NOT NULL | |

**Indexes:**
- Primary key on `userId`

**ON DELETE CASCADE**: Deleting user deletes profile

---

### 3. **doctor_patient_assignments**
Many-to-Many relationship table for doctor-patient assignments.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `doctorId` | UUID | PRIMARY KEY, FK → users.id | Doctor user ID |
| `patientId` | UUID | PRIMARY KEY, FK → users.id | Patient user ID |
| `status` | ENUM | NOT NULL, DEFAULT 'active' | `active`, `inactive` |
| `createdAt` | TIMESTAMP | NOT NULL | Assignment date |
| `updatedAt` | TIMESTAMP | NOT NULL | |

**Composite Primary Key**: `(doctorId, patientId)`

**Indexes:**
- `doctorId`
- `patientId`
- `status`

**ON DELETE CASCADE**: Deleting user removes assignment

---

### 4. **caregiver_patient_permissions**
Many-to-Many relationship table with granular permissions.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `caregiverId` | UUID | PRIMARY KEY, FK → users.id | Caregiver user ID |
| `patientId` | UUID | PRIMARY KEY, FK → users.id | Patient user ID |
| `canViewMedications` | BOOLEAN | NOT NULL, DEFAULT false | Can view medications |
| `canViewSymptoms` | BOOLEAN | NOT NULL, DEFAULT false | Can view symptoms |
| `canViewAppointments` | BOOLEAN | NOT NULL, DEFAULT false | Can view appointments |
| `canMessageDoctor` | BOOLEAN | NOT NULL, DEFAULT false | Can message doctors |
| `canReceiveReminders` | BOOLEAN | NOT NULL, DEFAULT false | Can receive notifications |
| `createdAt` | TIMESTAMP | NOT NULL | |
| `updatedAt` | TIMESTAMP | NOT NULL | |

**Composite Primary Key**: `(caregiverId, patientId)`

**Indexes:**
- `caregiverId`
- `patientId`

**ON DELETE CASCADE**: Deleting user removes permissions

---

### 5. **medications**
Patient medications with dosage and schedule information.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PRIMARY KEY | Medication ID |
| `patientId` | UUID | FK → users.id, NOT NULL | Patient ID |
| `name` | VARCHAR | NOT NULL | Medication name |
| `doseAmount` | FLOAT | | Dose amount (numeric) |
| `doseUnit` | VARCHAR | | Dose unit (mg, ml, etc.) |
| `dosage` | VARCHAR | NOT NULL | Dosage description |
| `frequency` | VARCHAR | NOT NULL | Frequency (e.g., "twice daily") |
| `scheduleJson` | JSONB | | Structured schedule data |
| `startDate` | DATE | | Start date |
| `endDate` | DATE | | End date |
| `notes` | TEXT | | Additional notes |
| `createdAt` | TIMESTAMP | NOT NULL | |
| `updatedAt` | TIMESTAMP | NOT NULL | |

**Indexes:**
- `patientId`
- `name`
- `startDate`
- `createdAt`

**ON DELETE CASCADE**: Deleting patient deletes medications

---

### 6. **symptoms**
Patient symptom logs.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PRIMARY KEY | Symptom log ID |
| `patientId` | UUID | FK → users.id, NOT NULL | Patient ID |
| `name` | VARCHAR | NOT NULL | Symptom name |
| `severity` | INTEGER | NOT NULL, CHECK (0-10) | Severity rating 0-10 |
| `notes` | TEXT | | Additional notes |
| `loggedAt` | TIMESTAMP | NOT NULL | When symptom was logged |
| `createdAt` | TIMESTAMP | NOT NULL | |
| `updatedAt` | TIMESTAMP | NOT NULL | |

**Indexes:**
- `patientId`
- `loggedAt`
- `severity`

**ON DELETE CASCADE**: Deleting patient deletes symptoms

---

### 7. **diagnoses**
Doctor-assigned diagnoses for patients.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PRIMARY KEY | Diagnosis ID |
| `patientId` | UUID | FK → users.id, NOT NULL | Patient ID |
| `doctorId` | UUID | FK → users.id, NOT NULL | Doctor ID |
| `diagnosisText` | TEXT | NOT NULL | Diagnosis description |
| `diagnosedAt` | TIMESTAMP | NOT NULL | Diagnosis date |
| `status` | ENUM | NOT NULL, DEFAULT 'active' | `active`, `resolved` |
| `createdAt` | TIMESTAMP | NOT NULL | |
| `updatedAt` | TIMESTAMP | NOT NULL | |

**Indexes:**
- `patientId`
- `doctorId`
- `status`
- `diagnosedAt`

**ON DELETE CASCADE**: Deleting user deletes diagnoses

---

### 8. **medical_notes**
Doctor notes on patients.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PRIMARY KEY | Note ID |
| `patientId` | UUID | FK → users.id, NOT NULL | Patient ID |
| `doctorId` | UUID | FK → users.id, NOT NULL | Doctor ID |
| `note` | TEXT | NOT NULL | Note content |
| `createdAt` | TIMESTAMP | NOT NULL | |
| `updatedAt` | TIMESTAMP | NOT NULL | |

**Indexes:**
- `patientId`
- `doctorId`
- `createdAt`

**ON DELETE CASCADE**: Deleting user deletes notes

---

### 9. **appointments**
Doctor-patient appointments.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PRIMARY KEY | Appointment ID |
| `patientId` | UUID | FK → users.id, NOT NULL | Patient ID |
| `doctorId` | UUID | FK → users.id, NOT NULL | Doctor ID |
| `startsAt` | TIMESTAMP | NOT NULL | Appointment start time |
| `endsAt` | TIMESTAMP | NOT NULL | Appointment end time |
| `location` | VARCHAR | | Location (office, video, etc.) |
| `status` | ENUM | NOT NULL, DEFAULT 'scheduled' | `scheduled`, `cancelled`, `completed` |
| `notes` | TEXT | | Appointment notes |
| `createdAt` | TIMESTAMP | NOT NULL | |
| `updatedAt` | TIMESTAMP | NOT NULL | |

**Indexes:**
- `patientId`
- `doctorId`
- `startsAt`
- `status`

**ON DELETE CASCADE**: Deleting user deletes appointments

---

### 10. **conversations**
Messaging conversations (group chat support).

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PRIMARY KEY | Conversation ID |
| `createdAt` | TIMESTAMP | NOT NULL | |
| `updatedAt` | TIMESTAMP | NOT NULL | |

---

### 11. **conversation_participants**
Many-to-Many join table for conversations and users.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `conversationId` | UUID | PRIMARY KEY, FK → conversations.id | Conversation ID |
| `userId` | UUID | PRIMARY KEY, FK → users.id | User ID |

**Composite Primary Key**: `(conversationId, userId)`

**Indexes:**
- `conversationId`
- `userId`

**ON DELETE CASCADE**: Deleting conversation/user removes participant

---

### 12. **messages**
Individual messages within conversations.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PRIMARY KEY | Message ID |
| `conversationId` | UUID | FK → conversations.id, NOT NULL | Conversation ID |
| `senderId` | UUID | FK → users.id, NOT NULL | Sender user ID |
| `body` | TEXT | NOT NULL | Message text |
| `sentAt` | TIMESTAMP | NOT NULL | Sent timestamp |

**Indexes:**
- `conversationId`
- `senderId`
- `sentAt`

**ON DELETE CASCADE**: Deleting conversation deletes messages

---

### 13. **reminders**
System reminders for medications, appointments, etc.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PRIMARY KEY | Reminder ID |
| `userId` | UUID | FK → users.id, NOT NULL | User ID (patient/caregiver) |
| `type` | ENUM | NOT NULL | `medication`, `appointment`, `custom` |
| `relatedId` | UUID | | Related medication/appointment ID |
| `scheduledAt` | TIMESTAMP | NOT NULL | When to send reminder |
| `sentAt` | TIMESTAMP | | When reminder was sent |
| `status` | ENUM | NOT NULL, DEFAULT 'pending' | `pending`, `sent`, `dismissed` |
| `createdAt` | TIMESTAMP | NOT NULL | |
| `updatedAt` | TIMESTAMP | NOT NULL | |

**Indexes:**
- `userId`
- `type`
- `scheduledAt`
- `status`

**ON DELETE CASCADE**: Deleting user deletes reminders

---

## Relationships

### 1:1 Relationships
- `users` (patient) ↔ `patient_profiles`

### 1:Many Relationships
- `users` (patient) → `medications`
- `users` (patient) → `symptoms`
- `users` (patient) → `diagnoses` (as patient)
- `users` (doctor) → `diagnoses` (as doctor)
- `users` (patient) → `medical_notes` (as patient)
- `users` (doctor) → `medical_notes` (as doctor)
- `users` (patient) → `appointments` (as patient)
- `users` (doctor) → `appointments` (as doctor)
- `users` → `reminders`
- `conversations` → `messages`
- `users` → `messages` (as sender)

### Many:Many Relationships
- `users` (doctor) ↔ `users` (patient) via `doctor_patient_assignments`
- `users` (caregiver) ↔ `users` (patient) via `caregiver_patient_permissions`
- `users` ↔ `conversations` via `conversation_participants`

---

## Indexes

### Performance Optimization Indexes

**Foreign Keys** (automatically indexed):
- All `patientId`, `doctorId`, `caregiverId`, `userId` columns

**Date/Time Queries**:
- `symptoms.loggedAt`
- `appointments.startsAt`
- `diagnoses.diagnosedAt`
- `reminders.scheduledAt`
- `messages.sentAt`

**Status Queries**:
- `appointments.status`
- `diagnoses.status`
- `reminders.status`
- `doctor_patient_assignments.status`

**Search Queries**:
- `medications.name`
- `users.email` (unique)

---

## Recommended API Structure

### Folder Structure

```
backend/
├── src/
│   ├── controllers/
│   │   ├── auth.controller.js          ✅ Exists
│   │   ├── patients.controller.js      (NEW - patient CRUD)
│   │   ├── doctors.controller.js       (NEW - doctor dashboard)
│   │   ├── caregivers.controller.js    (NEW - caregiver access)
│   │   ├── medications.controller.js   ✅ Exists
│   │   ├── symptoms.controller.js      ✅ Exists
│   │   ├── diagnoses.controller.js     (NEW)
│   │   ├── medicalNotes.controller.js  (NEW)
│   │   ├── appointments.controller.js  (NEW)
│   │   ├── messaging.controller.js     (NEW)
│   │   └── reminders.controller.js     (NEW)
│   │
│   ├── routes/
│   │   ├── auth.routes.js              ✅ Exists
│   │   ├── patients.routes.js          (NEW)
│   │   ├── doctors.routes.js           (NEW)
│   │   ├── caregivers.routes.js        (NEW)
│   │   ├── medications.routes.js       ✅ Exists
│   │   ├── symptoms.routes.js          ✅ Exists
│   │   ├── diagnoses.routes.js         (NEW)
│   │   ├── medicalNotes.routes.js      (NEW)
│   │   ├── appointments.routes.js      (NEW)
│   │   ├── messaging.routes.js         (NEW)
│   │   └── reminders.routes.js         (NEW)
│   │
│   ├── models/
│   │   ├── index.js                    ✅ Created (with associations)
│   │   ├── User.js                     ✅ Exists
│   │   ├── PatientProfile.js           ✅ Created
│   │   ├── Medication.js               ✅ Updated
│   │   ├── Symptom.js                  ✅ Updated
│   │   ├── Diagnosis.js                ✅ Created
│   │   ├── MedicalNote.js              ✅ Created
│   │   ├── Appointment.js              ✅ Created
│   │   ├── Conversation.js             ✅ Created
│   │   ├── ConversationParticipant.js  ✅ Created
│   │   ├── Message.js                  ✅ Created
│   │   ├── Reminder.js                 ✅ Created
│   │   ├── DoctorPatientAssignment.js  ✅ Created
│   │   └── CaregiverPatientPermission.js ✅ Created
│   │
│   └── middleware/
│       ├── requireUser.js              ✅ Exists (JWT auth)
│       ├── requireRole.js              (NEW - role-based access)
│       └── checkPermissions.js         (NEW - caregiver permissions)
│
├── migrations/                         (Sequelize migrations)
├── database.js                         ✅ Exists
└── server.js                           ✅ Exists
```

### REST API Endpoints (Recommended)

#### Authentication
- `POST /api/auth/register` ✅
- `POST /api/auth/login` ✅
- `GET /api/auth/me` ✅

#### Patients (Patient Role)
- `GET /api/patients/profile` - Get own profile
- `PUT /api/patients/profile` - Update own profile
- `GET /api/patients/timeline` - Get medications + symptoms
- `GET /api/patients/doctors` - List assigned doctors
- `GET /api/patients/caregivers` - List caregivers with permissions
- `POST /api/patients/caregivers/:id/permissions` - Grant/update permissions

#### Doctors (Doctor Role)
- `GET /api/doctors/patients` - List assigned patients
- `GET /api/doctors/patients/:id` - Get patient details
- `GET /api/doctors/patients/:id/timeline` - Patient medications + symptoms
- `POST /api/doctors/diagnoses` - Create diagnosis
- `POST /api/doctors/notes` - Add medical note
- `GET /api/doctors/appointments` - List appointments

#### Caregivers (Caregiver Role)
- `GET /api/caregivers/patients` - List patients under care
- `GET /api/caregivers/patients/:id/medications` - (if permitted)
- `GET /api/caregivers/patients/:id/symptoms` - (if permitted)
- `GET /api/caregivers/patients/:id/appointments` - (if permitted)

#### Medications
- `GET /api/medications` ✅
- `POST /api/medications` ✅
- `PUT /api/medications/:id` ✅
- `DELETE /api/medications/:id` ✅

#### Symptoms
- `GET /api/symptoms` ✅
- `POST /api/symptoms` ✅

#### Appointments
- `GET /api/appointments`
- `POST /api/appointments`
- `PUT /api/appointments/:id`
- `DELETE /api/appointments/:id`

#### Messaging
- `GET /api/conversations`
- `POST /api/conversations`
- `GET /api/conversations/:id/messages`
- `POST /api/conversations/:id/messages`

#### Reminders
- `GET /api/reminders`
- `POST /api/reminders`
- `PUT /api/reminders/:id`
- `DELETE /api/reminders/:id`

---

## Query Optimization Recommendations

### Doctor Dashboard Query
```sql
-- Get all patients assigned to a doctor with latest vitals
SELECT
  u.id, u.email,
  pp.firstName, pp.lastName,
  dpa.status,
  COUNT(DISTINCT m.id) AS medication_count,
  COUNT(DISTINCT s.id) AS symptom_count
FROM users u
INNER JOIN doctor_patient_assignments dpa ON u.id = dpa.patientId
INNER JOIN patient_profiles pp ON u.id = pp.userId
LEFT JOIN medications m ON u.id = m.patientId
LEFT JOIN symptoms s ON u.id = s.patientId
WHERE dpa.doctorId = ? AND dpa.status = 'active'
GROUP BY u.id, pp.id, dpa.status
ORDER BY pp.lastName, pp.firstName;
```

### Patient Timeline Query
```sql
-- Get combined medications + symptoms for timeline view
(
  SELECT
    'medication' AS type,
    id,
    name,
    startDate AS date,
    dosage AS details,
    createdAt
  FROM medications
  WHERE patientId = ?
)
UNION ALL
(
  SELECT
    'symptom' AS type,
    id,
    name,
    loggedAt AS date,
    CONCAT('Severity: ', severity) AS details,
    createdAt
  FROM symptoms
  WHERE patientId = ?
)
ORDER BY date DESC, createdAt DESC
LIMIT 50;
```

### Calendar View Query
```sql
-- Get appointments for calendar
SELECT
  a.id,
  a.startsAt,
  a.endsAt,
  a.status,
  a.location,
  p.firstName || ' ' || p.lastName AS patientName,
  d.email AS doctorEmail
FROM appointments a
INNER JOIN users p ON a.patientId = p.id
INNER JOIN patient_profiles pp ON p.id = pp.userId
INNER JOIN users d ON a.doctorId = d.id
WHERE a.doctorId = ?
  AND a.startsAt >= ?
  AND a.startsAt < ?
  AND a.status != 'cancelled'
ORDER BY a.startsAt;
```

---

## Migration Strategy

### Phase 1: Core Tables
1. `users`
2. `patient_profiles`

### Phase 2: Medical Data
3. `medications`
4. `symptoms`
5. `diagnoses`
6. `medical_notes`

### Phase 3: Scheduling
7. `appointments`
8. `reminders`

### Phase 4: Relationships
9. `doctor_patient_assignments`
10. `caregiver_patient_permissions`

### Phase 5: Messaging
11. `conversations`
12. `conversation_participants`
13. `messages`

---

## Security Considerations

1. **Foreign Key Integrity**: All FKs enforced at database level
2. **Cascade Deletes**: Orphaned records automatically removed
3. **Role-Based Access**: Enforce in middleware (`requireRole`)
4. **Caregiver Permissions**: Check `caregiver_patient_permissions` before data access
5. **Password Hashing**: Bcrypt with cost factor 12
6. **UUID Primary Keys**: Prevents enumeration attacks
7. **Email Uniqueness**: Enforced at database level

---

## Next Steps

1. ✅ Create all Sequelize models
2. ✅ Define model associations
3. ⏳ Generate database migrations
4. ⏳ Create role-based middleware
5. ⏳ Build controller functions
6. ⏳ Create API routes
7. ⏳ Add permission checking middleware
8. ⏳ Write integration tests

---

**Generated**: February 14, 2026
**Database**: PostgreSQL 14+
**ORM**: Sequelize v6
**Project**: HEALIO Healthcare Management Platform
