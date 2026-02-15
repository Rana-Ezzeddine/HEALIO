# HEALIO Backend - PostgreSQL with Sequelize Migrations

Production-ready backend for HEALIO healthcare management platform using PostgreSQL and Sequelize CLI migrations for database version control.

---

## 🏗️ Architecture

- **Framework**: Express.js
- **Database**: PostgreSQL
- **ORM**: Sequelize
- **Migrations**: Sequelize CLI
- **Auth**: JWT with bcrypt
- **Primary Keys**: UUID

---

## 📋 Prerequisites

- Node.js >= 16
- PostgreSQL >= 12
- npm or yarn

---

## 🚀 Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Create PostgreSQL Database

```bash
# Connect to PostgreSQL
psql -U postgres

# Create database
CREATE DATABASE healio_dev;

# Exit
\q
```

### 3. Configure Environment

Create a `.env` file in the project root:

```env
# Database
DB_NAME=healio_dev
DB_USER=postgres
DB_PASSWORD=your_password
DB_HOST=127.0.0.1
DB_PORT=5432

# JWT
JWT_ACCESS_SECRET=your_super_secret_key_here_change_in_production
JWT_ACCESS_EXPIRES_IN=15m

# Server
PORT=5050
NODE_ENV=development
FRONTEND_URL=http://localhost:5173
```

### 4. Run Migrations

```bash
npm run db:migrate
```

This will create all 13 tables in the correct order:
1. users
2. patient_profiles
3. doctor_patient_assignments
4. caregiver_patient_permissions
5. medications
6. symptoms
7. diagnoses
8. medical_notes
9. appointments
10. conversations
11. conversation_participants
12. messages
13. reminders

### 5. Start the Server

```bash
# Development (with nodemon)
npm run dev

# Production
npm start
```

Server will run on `http://localhost:5050`

---

## 📁 Project Structure

```
backend/
├── config/
│   └── config.json              # Sequelize config (dev/test/prod)
├── migrations/                   # Database migrations (version control)
│   ├── 20260215000001-create-users.cjs
│   ├── 20260215000002-create-patient-profiles.cjs
│   ├── 20260215000003-create-doctor-patient-assignments.cjs
│   ├── 20260215000004-create-caregiver-patient-permissions.cjs
│   ├── 20260215000005-create-medications.cjs
│   ├── 20260215000006-create-symptoms.cjs
│   ├── 20260215000007-create-diagnoses.cjs
│   ├── 20260215000008-create-medical-notes.cjs
│   ├── 20260215000009-create-appointments.cjs
│   ├── 20260215000010-create-conversations.cjs
│   ├── 20260215000011-create-conversation-participants.cjs
│   ├── 20260215000012-create-messages.cjs
│   └── 20260215000013-create-reminders.cjs
├── src/
│   ├── controllers/              # Request handlers
│   │   ├── auth.controller.js
│   │   ├── medications.controller.js
│   │   └── symptoms.controller.js
│   ├── middleware/               # Auth, validation
│   │   └── requireUser.js
│   ├── models/                   # Sequelize models
│   │   ├── index.js             # Model associations
│   │   ├── User.js
│   │   ├── PatientProfile.js
│   │   ├── Medication.js
│   │   ├── Symptom.js
│   │   ├── Diagnosis.js
│   │   ├── MedicalNote.js
│   │   ├── Appointment.js
│   │   ├── Conversation.js
│   │   ├── ConversationParticipant.js
│   │   ├── Message.js
│   │   ├── Reminder.js
│   │   ├── DoctorPatientAssignment.js
│   │   └── CaregiverPatientPermission.js
│   └── routes/                   # API routes
│       ├── auth.routes.js
│       ├── medications.routes.js
│       └── symptoms.routes.js
├── .sequelizerc                  # Sequelize CLI config
├── database.js                   # Sequelize connection
├── server.js                     # Express app entry
└── package.json
```

---

## 🗄️ Database Schema

### Core Tables

#### `users`
Core authentication and role management.

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| email | VARCHAR | Unique email |
| passwordHash | VARCHAR | Bcrypt hash |
| role | ENUM | patient/doctor/caregiver |
| isVerified | BOOLEAN | Email verification |
| createdAt | TIMESTAMP | |
| updatedAt | TIMESTAMP | |

#### `patient_profiles` (1:1 with users)
Extended patient information.

| Column | Type | Description |
|--------|------|-------------|
| userId | UUID (PK, FK) | References users.id |
| firstName | VARCHAR | |
| lastName | VARCHAR | |
| dateOfBirth | DATE | |
| sex | VARCHAR | |
| bloodType | VARCHAR | |
| allergies | TEXT | |
| medicalConditions | TEXT | |

#### `medications`
Patient medications with schedules.

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| patientId | UUID (FK) | References users.id |
| name | VARCHAR | Medication name |
| doseAmount | FLOAT | Numeric dose |
| doseUnit | VARCHAR | mg, ml, etc. |
| dosage | VARCHAR | Full dosage string |
| frequency | VARCHAR | Frequency description |
| scheduleJson | JSONB | Structured schedule |
| startDate | DATE | |
| endDate | DATE | |
| notes | TEXT | |

#### `symptoms`
Patient symptom logs.

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| patientId | UUID (FK) | References users.id |
| name | VARCHAR | Symptom name |
| severity | INTEGER | 0-10 scale |
| notes | TEXT | |
| loggedAt | TIMESTAMP | |

See `HEALIO_DATABASE_SCHEMA.md` for complete schema documentation.

---

## 🛠️ Available Scripts

### Database Operations

```bash
# Run all pending migrations
npm run db:migrate

# Undo last migration
npm run db:migrate:undo

# Undo all migrations
npm run db:migrate:undo:all

# Reset database (undo all + migrate)
npm run db:reset
```

### Server Operations

```bash
# Start development server
npm run dev

# Start production server
npm start
```

---

## 🔄 Migration Workflow

### For Team Members

1. **Pull latest code**
   ```bash
   git pull origin main
   ```

2. **Run migrations**
   ```bash
   npm run db:migrate
   ```

3. **Start development**
   ```bash
   npm run dev
   ```

### Creating New Migrations

```bash
# Generate new migration file
npx sequelize-cli migration:generate --name description-of-change

# Edit the generated file in migrations/
# Add up() and down() methods

# Run migration
npm run db:migrate
```

### Example Migration

```javascript
'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('users', 'phoneNumber', {
      type: Sequelize.STRING,
      allowNull: true
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('users', 'phoneNumber');
  }
};
```

---

## 🔐 Authentication

### Register

```http
POST /api/auth/register
Content-Type: application/json

{
  "email": "patient@example.com",
  "password": "SecurePass123"
}
```

### Login

```http
POST /api/auth/login
Content-Type: application/json

{
  "email": "patient@example.com",
  "password": "SecurePass123"
}

Response:
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "uuid-here",
    "email": "patient@example.com",
    "role": "patient"
  }
}
```

### Protected Routes

```http
GET /api/auth/me
Authorization: Bearer <token>
```

---

## 🧪 Testing Migrations

```bash
# Test fresh migration
npm run db:migrate:undo:all
npm run db:migrate

# Verify tables created
psql -U postgres -d healio_dev -c "\dt"
```

---

## 📊 Database Relationships

```
users (1) ──── (1) patient_profiles
  │
  ├─ (1:M) ──── medications
  ├─ (1:M) ──── symptoms
  ├─ (1:M) ──── diagnoses
  ├─ (1:M) ──── appointments
  ├─ (1:M) ──── reminders
  │
  ├─ (M:N via doctor_patient_assignments) ──── users
  ├─ (M:N via caregiver_patient_permissions) ──── users
  └─ (M:N via conversation_participants) ──── conversations
```

---

## 🚨 Important Notes

### ⚠️ DO NOT use `sequelize.sync()`

This project uses **migrations for database version control**. Never use:
- `sequelize.sync()`
- `sequelize.sync({ force: true })`
- `sequelize.sync({ alter: true })`

### ✅ Always use migrations

```bash
npm run db:migrate
```

### 🔒 Production Checklist

1. [ ] Update `config/config.json` production settings
2. [ ] Set strong `JWT_ACCESS_SECRET`
3. [ ] Use environment variable for `DATABASE_URL`
4. [ ] Enable SSL for PostgreSQL connection
5. [ ] Set `NODE_ENV=production`
6. [ ] Run migrations on production database
7. [ ] Set up database backups

---

## 🐛 Troubleshooting

### Migration Failed

```bash
# Check migration status
npx sequelize-cli db:migrate:status

# Undo last migration
npm run db:migrate:undo

# Fix the migration file
# Re-run
npm run db:migrate
```

### Database Connection Failed

```bash
# Check PostgreSQL is running
pg_isready

# Verify credentials
psql -U postgres -d healio_dev

# Check .env file matches config/config.json
```

### Table Already Exists

```bash
# Reset and re-run migrations
npm run db:reset
```

---

## 📖 API Documentation

### Current Endpoints

#### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login and get JWT
- `GET /api/auth/me` - Get current user (protected)

#### Medications
- `GET /api/medications` - List all medications
- `POST /api/medications` - Create medication
- `PUT /api/medications/:id` - Update medication
- `DELETE /api/medications/:id` - Delete medication

#### Symptoms
- `GET /api/symptoms` - List symptoms
- `POST /api/symptoms` - Log symptom

---

## 🤝 Contributing

1. Create a feature branch
2. If schema changes needed, create migration
3. Test migrations locally
4. Commit migration files with code
5. Document changes in PR

---

## 📝 License

ISC

---

## 🆘 Support

For issues or questions:
1. Check migration status: `npx sequelize-cli db:migrate:status`
2. Review logs for errors
3. Verify environment variables
4. Check PostgreSQL connection

---

**Generated**: February 15, 2026
**Database**: PostgreSQL with Sequelize Migrations
**Version Control**: Git-tracked migration files
