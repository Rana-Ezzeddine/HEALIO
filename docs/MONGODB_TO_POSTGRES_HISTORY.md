# MongoDB to PostgreSQL Migration History (ARCHIVE)

## Overview

This document describes the historical migration of the HEALIO backend from MongoDB (Mongoose) to PostgreSQL (Sequelize).

This migration is COMPLETE. The project now uses PostgreSQL exclusively.

⚠️ This document is for historical reference only.  
For setup instructions, see: README.md  
For schema documentation, see: HEALIO_DATABASE_SCHEMA.md  

---

## Migration Summary

The backend was successfully migrated from:

- MongoDB (Mongoose ODM)
- ObjectId primary keys
- In-memory symptom storage (temporary)

To:

- PostgreSQL
- Sequelize ORM
- UUID primary keys
- Fully relational schema with migrations

All MongoDB dependencies, schemas, and configuration files were removed.

---

## Dependencies Changes

Removed:

- mongoose

Added / Used:

- sequelize
- pg
- pg-hstore
- sequelize-cli

---

## Models Converted

### User Model

Converted from Mongoose schema to Sequelize model.

Changes:

- ObjectId → UUID primary key
- Email uniqueness enforced at database level
- Password hash excluded by default scope
- Sequelize scopes used instead of manual filtering

---

### Medication Model

Converted to Sequelize model.

Changes:

- UUID primary key
- Foreign key relationship to users table
- All validations preserved
- Indexes added for performance

---

### Symptom Model

Previously stored in memory, now persisted in PostgreSQL.

Changes:

- Sequelize model created
- Foreign key relationship to users
- Persistent storage across restarts

---

## Controllers Updated

MongoDB syntax replaced with Sequelize equivalents.

Examples:

MongoDB:

```js
User.findOne({ email })

Sequelize:

User.findOne({ where: { email } })


MongoDB:

Medication.findById(id)


Sequelize:

Medication.findByPk(id)


MongoDB:

findByIdAndDelete()


Sequelize:

instance.destroy()

Database Architecture Changes

Primary key type:

MongoDB: ObjectId

PostgreSQL: UUID

Database relationships now enforced using:

Foreign keys

Cascade deletes

Constraints

Indexes

Migration Files Created

Final migration set includes:

create-users

create-patient-profiles

create-doctor-patient-assignments

create-caregiver-patient-permissions

create-medications

create-symptoms

create-diagnoses

create-medical-notes

create-appointments

create-conversations

create-conversation-participants

create-messages

create-reminders

These migrations fully define the PostgreSQL schema.

Important Architectural Decision

This project uses Sequelize migrations for database version control.

The following methods are NOT used:

sequelize.sync()
sequelize.sync({ force: true })
sequelize.sync({ alter: true })


All schema changes must use migration files.

Data Migration Note

This migration converted application structure only.

MongoDB data was not automatically migrated.

If needed, MongoDB data must be:

Exported manually

Transformed to match PostgreSQL schema

Inserted into PostgreSQL

Files Removed During Migration

MongoDB-specific files removed:

MongoDB connection config files

Mongoose models

In-memory symptom store

Final Result

Backend now uses:

PostgreSQL relational database

Sequelize ORM

Migration-based schema management

UUID primary keys

Fully relational schema with constraints

MongoDB is no longer used in this project.

References

Setup instructions: README.md
Schema documentation: HEALIO_DATABASE_SCHEMA.md