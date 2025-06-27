const { executeAppSchemaQuery, executeGoldSchemaQuery } = require('./database');
require('dotenv').config();

class DatabaseInitializer {
  static async createAndUseDatabase(dbName = process.env.DB_NAME) {
    try {
      // Only use the existing database, don't try to create it
      await executeAppSchemaQuery(`USE ${dbName}`);
      console.log(`✅ Using database '${dbName}'`);
    } catch (error) {
      console.error(`❌ Error setting up database '${dbName}':`, error);
      throw error;
    }
  }

  static async validateGoldSchema() {
    try {
      const goldSchema = process.env.GOLD_SCHEMA || 'uat.gold';
      // Try to use the gold schema to validate it exists
      await executeGoldSchemaQuery(`USE ${goldSchema}`);
      console.log(`✅ Gold schema '${goldSchema}' is accessible`);
      
      // Switch back to app schema
      await this.createAndUseDatabase();
    } catch (error) {
      console.error(`❌ Error accessing gold schema:`, error);
      throw error;
    }
  }

  static async initializeDatabase() {
    try {
      console.log('🚀 Starting database initialization...');
      
      // First create and use our app schema
      await this.createAndUseDatabase();
      console.log("✅ Connected to app schema successfully");

      // Validate gold schema is accessible
      await this.validateGoldSchema();
      console.log("✅ Validated gold schema successfully");

      console.log('✅ Database initialization completed successfully\n');
    } catch (error) {
      console.error('❌ Database initialization failed:', error);
      throw error;
    }
  }
}

module.exports = DatabaseInitializer; 