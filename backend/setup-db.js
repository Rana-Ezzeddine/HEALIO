import sequelize, { testConnection } from './database.js';
import Medication from './models/Medication.js';

const seedData = [
  {
    name: 'Aspirin',
    dosage: '100mg',
    frequency: 'Once daily',
    prescribedBy: 'Dr. Smith',
    startDate: '2024-01-15',
    notes: 'Take with food'
  },
  {
    name: 'Lisinopril',
    dosage: '10mg',
    frequency: 'Twice daily',
    prescribedBy: 'Dr. Johnson',
    startDate: '2024-02-20',
    notes: 'Morning and evening'
  },
  {
    name: 'Metformin',
    dosage: '500mg',
    frequency: 'Three times daily',
    prescribedBy: 'Dr. Smith',
    startDate: '2023-12-10',
    notes: 'With meals'
  }
];

async function setupDatabase() {
  try {
    console.log('Testing database connection...');
    const connected = await testConnection();
    
    if (!connected) {
      throw new Error('Database connection failed');
    }

    console.log('\nSynchronizing database schema...');
    await sequelize.sync({ force: true }); // This will drop and recreate tables
    console.log('✓ Database schema synchronized');

    console.log('\nSeeding database with sample data...');
    
    for (const med of seedData) {
      await Medication.create(med);
      console.log(`✓ Added ${med.name}`);
    }
    
    console.log('\n✅ Database setup complete!');
    console.log('You can now start the server with: npm start');
    
    await sequelize.close();
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Error setting up database:', error.message);
    await sequelize.close();
    process.exit(1);
  }
}

setupDatabase();