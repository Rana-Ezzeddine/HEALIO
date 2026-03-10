import { addPerformanceIndexes } from '../../migrations/add-performance-indexes.js';
import sequelize from '../../database.js';

async function optimizeDatabase() {
  try {
    console.log('Starting database optimization...');

    await sequelize.authenticate();
    console.log('✓ Database connected');

    try {
      await addPerformanceIndexes();
      console.log('Indexes added successfully!');
    } catch (err) {
      if (err.parent && err.parent.code === '42P07') {
        console.log('Index already exists, skipping...');
      } else {
        throw err; 
      }
    }

    console.log('\n✅ Database optimization complete!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Database optimization failed:', error);
    process.exit(1);
  }
}

optimizeDatabase();