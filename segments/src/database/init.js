const { executeQuery } = require('./database');
require('dotenv').config();

class DatabaseInitializer {
  static async createAndUseDatabase(dbName = process.env.DB_NAME) {
    try {
      // Create database if not exists
      await executeQuery(`CREATE DATABASE IF NOT EXISTS ${dbName}`);
      // Use the database
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
      console.log('✅ Database initialization completed successfully');
      
    } catch (error) {
      console.error('❌ Database initialization failed:', error);
      throw error;
    }
  }

}

module.exports = DatabaseInitializer;
