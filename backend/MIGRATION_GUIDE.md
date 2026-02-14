# MongoDB to PostgreSQL Migration Guide

## Overview
Your backend has been successfully migrated from MongoDB (Mongoose) to PostgreSQL (Sequelize). All MongoDB dependencies have been removed and replaced with SQL equivalents.

## What Was Changed

### 1. Dependencies
- **Removed**: `mongoose` (v9.1.6)
- **Kept**: `sequelize`, `pg`, `pg-hstore` (already in your dependencies)

### 2. Models Converted

#### User Model (`src/models/User.js`)
- Converted from Mongoose schema to Sequelize model
- Uses UUID instead of MongoDB ObjectId
- Email field automatically lowercased and trimmed
- Default scope excludes `passwordHash` for security
- `withPassword` scope available when needed for authentication

#### Medication Model (`src/models/Medication.js`)
- Converted from Mongoose schema to Sequelize model
- Uses UUID instead of MongoDB ObjectId
- All validations preserved
- Instance and static methods converted to Sequelize equivalents
- Indexes maintained for performance

#### Symptom Model (`src/models/Symptom.js`) - NEW!
- Previously stored in-memory, now persisted to PostgreSQL
- Includes foreign key relationship to User model
- Proper indexes for efficient queries

### 3. Controllers Updated

#### Auth Controller (`src/controllers/auth.controller.js`)
- `User.findOne()` now uses Sequelize syntax with `where` clause
- `User.create()` adapted for Sequelize
- `User.findByPk()` used instead of `findById()`
- Error handling updated for Sequelize constraint errors

#### Medications Controller (`src/controllers/medications.controller.js`)
- `Medication.find()` → `Medication.findAll()`
- `Medication.findById()` → `Medication.findByPk()`
- `new Medication().save()` → `Medication.create()`
- `findByIdAndUpdate()` → `findByPk()` + `update()`
- `findByIdAndDelete()` → `findByPk()` + `destroy()`
- Regex searches converted to `Op.iLike` for case-insensitive matching

#### Symptoms Controller (`src/controllers/symptoms.controller.js`)
- Converted from in-memory Map storage to PostgreSQL
- Now uses `Symptom.create()` and `Symptom.findAll()`
- Symptoms persisted across server restarts

### 4. Server Configuration

#### `src/index.js`
- Removed MongoDB connection (`connectDB`)
- Added PostgreSQL connection using Sequelize
- Auto-sync models on startup

#### `server.js`
- Removed unused Medication import
- Added JWT_ACCESS_SECRET to required environment variables
- All references to MongoDB removed

### 5. Database Migrations Created

Three migration files created in `migrations/`:
1. `20260214000001-create-users-table.js` - Users table
2. `20260214000002-create-medications-table.js` - Medications table
3. `20260214000003-create-symptoms-table.js` - Symptoms table with foreign key to users

## Environment Variables Required

Update your `.env` file with these variables:

```env
# PostgreSQL Database
DB_NAME=healio
DB_USER=postgres
DB_PASSWORD=your_password_here
DB_HOST=localhost
DB_PORT=5432

# JWT
JWT_ACCESS_SECRET=your_secret_key_here
JWT_ACCESS_EXPIRES_IN=15m

# Server
PORT=5050
NODE_ENV=development
FRONTEND_URL=http://localhost:5173
```

## Setup Instructions

### 1. Install Dependencies
```bash
cd backend
npm install
```

### 2. Create PostgreSQL Database
```bash
psql -U postgres
CREATE DATABASE healio;
\q
```

### 3. Run Migrations (Optional)
If you want to use migrations instead of auto-sync:
```bash
npx sequelize-cli db:migrate
```

### 4. Start the Server
```bash
npm start
# or
npm run dev
```

The server will automatically:
- Connect to PostgreSQL
- Sync/create all tables
- Start listening on port 5050

## Important Notes

### UUID vs ObjectId
- PostgreSQL uses UUID for primary keys instead of MongoDB's ObjectId
- UUIDs are auto-generated using `UUIDV4`
- All ID references in your frontend will need to handle UUIDs (strings)

### Case-Insensitive Searches
- PostgreSQL uses `ILIKE` operator for case-insensitive searches
- Equivalent to MongoDB's regex with 'i' flag

### Auto-Sync vs Migrations
Currently using `sequelize.sync({ alter: true })` which:
- Automatically creates/updates tables
- Good for development
- **For production**: Use migrations instead (`npx sequelize-cli db:migrate`)

### Data Migration
If you have existing data in MongoDB, you'll need to:
1. Export data from MongoDB
2. Transform ObjectIds to UUIDs
3. Import into PostgreSQL

## Testing Checklist

- [ ] User registration works
- [ ] User login works
- [ ] JWT authentication works
- [ ] Create medication works
- [ ] Get all medications works
- [ ] Update medication works
- [ ] Delete medication works
- [ ] Search medications works
- [ ] Create symptom works (now persisted!)
- [ ] Get symptoms works (now persisted!)

## Rollback (if needed)

If you need to rollback to MongoDB:
1. Restore the original files from your backup
2. Run `npm install mongoose`
3. Update environment variables back to MongoDB settings

## Files Modified

- `package.json` - Removed mongoose
- `src/models/User.js` - Converted to Sequelize
- `src/models/Medication.js` - Converted to Sequelize
- `src/models/Symptom.js` - NEW (converted from in-memory)
- `src/controllers/auth.controller.js` - Updated for Sequelize
- `src/controllers/medications.controller.js` - Updated for Sequelize
- `src/controllers/symptoms.controller.js` - Updated for Sequelize
- `src/index.js` - Removed MongoDB connection
- `server.js` - Cleaned up imports

## Files Deleted (Safe to Remove)

- `src/store/symptoms.store.js` - No longer needed (now in database)
- `src/config/db.js` - MongoDB connection file (if exists)

## Support

If you encounter any issues:
1. Check PostgreSQL is running: `pg_isready`
2. Verify database exists: `psql -U postgres -l`
3. Check environment variables are set correctly
4. Review server logs for detailed error messages
