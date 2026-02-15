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

Create PostgreSQL user and database:

psql -U postgres

CREATE USER healio_user WITH PASSWORD 'healio_pass';
CREATE DATABASE healio_dev OWNER healio_user;
\q


Create a .env file in the project root:

DB_NAME=healio_dev
DB_USER=healio_user
DB_PASSWORD=healio_pass
DB_HOST=127.0.0.1
DB_PORT=5432

JWT_ACCESS_SECRET=your_super_secret_key_here_change_in_production
JWT_ACCESS_EXPIRES_IN=15m

PORT=5050
NODE_ENV=development
FRONTEND_URL=http://localhost:5173


Run database migrations:

npm run db:migrate


Verify tables were created:

psql -U healio_user -d healio_dev -c "\dt public.*"


You should see:

SequelizeMeta
users
patient_profiles
doctor_patient_assignments
caregiver_patient_permissions
medications
symptoms
diagnoses
medical_notes
appointments
conversations
conversation_participants
messages
reminders

Start development server:

npm run dev


Server will run at:

http://localhost:5050

Project Structure
backend/
├── config/
│   └── config.json
├── migrations/
├── src/
│   ├── controllers/
│   ├── middleware/
│   ├── models/
│   └── routes/
├── .sequelizerc
├── database.js
├── server.js
└── package.json

Database Schema

Full schema documentation is available in:

HEALIO_DATABASE_SCHEMA.md

Available Scripts

Run migrations:

npm run db:migrate


Undo last migration:

npm run db:migrate:undo


Reset database:

npm run db:reset


Check migration status:

npx sequelize-cli db:migrate:status


Start development server:

npm run dev


Start production server:

npm start

Migration Workflow

Pull latest code:

git pull origin main


Install dependencies:

npm install


Run migrations:

npm run db:migrate


Start server:

npm run dev


Create new migration:

npx sequelize-cli migration:generate --name description-of-change


Run migration:

npm run db:migrate


Undo migration:

npm run db:migrate:undo

Clean Rebuild Test

This verifies migrations fully recreate the schema.

psql postgres -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname='healio_dev';"
psql postgres -c "DROP DATABASE healio_dev;"
psql postgres -c "CREATE DATABASE healio_dev OWNER healio_user;"
npm run db:migrate
psql -U healio_user -d healio_dev -c "\dt public.*"

Authentication Endpoints

Register:

POST /api/auth/register

Login:

POST /api/auth/login

Get current user:

GET /api/auth/me

Important Notes

Do NOT use sequelize.sync().

Never use:

sequelize.sync()
sequelize.sync({ force: true })
sequelize.sync({ alter: true })

Always use migrations:

npm run db:migrate

Troubleshooting

Check PostgreSQL is running:

pg_isready


Check migration status:

npx sequelize-cli db:migrate:status


Test database connection:

psql -U healio_user -d healio_dev


Reset database:

npm run db:reset

Documentation

Database schema:

HEALIO_DATABASE_SCHEMA.md

License

ISC

Database: PostgreSQL
ORM: Sequelize
Migration system: Sequelize CLI
Project: HEALIO Healthcare Platform