const { executeQuery } = require('./database');
require('dotenv').config();

class DatabaseInitializer {
  static async createAndUseDatabase(dbName = process.env.DB_NAME) {
    try {
      // Only use the existing database, don't try to create it
      await executeQuery(`USE ${dbName}`);
      console.log(`✅ Using database '${dbName}'`);
    } catch (error) {
      console.error(`❌ Error setting up database '${dbName}':`, error);
      throw error;
    }
  }


  static async initializeDatabase() {
    try {
      console.log('🚀 Starting database initialization...');
      
      // First create and use our database
      await this.createAndUseDatabase();
      console.log("✅ Connected to database successfully");

      console.log('✅ Database initialization completed successfully\n');
    } catch (error) {
      console.error('❌ Database initialization failed:', error);
      throw error;
    }
  }

}

module.exports = DatabaseInitializer; 