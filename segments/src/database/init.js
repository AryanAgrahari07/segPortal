const { executeQuery } = require('./database');
const { tables } = require('./tables');
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

  static async checkTableExists(tableName) {
    try {
      const query = `SHOW TABLES LIKE '${tableName}'`;
      const result = await executeQuery(query);
      return result.length > 0;
    } catch (error) {
      console.error(`Error checking if table ${tableName} exists:`, error);
      throw error;
    }
  }


  static async createTable(tableDefinition) {
    const { name, schema } = tableDefinition;
    try {
      const tableExists = await this.checkTableExists(name);
      
      if (!tableExists) {
        // Create the table with defaults
        await executeQuery(schema);
        
        console.log(`✅ Table '${name}' created successfully`);
        return true;
      } else {
        console.log(`ℹ️ Table '${name}' already exists`);
        return false;
      }
    } catch (error) {
      console.error(`❌ Error creating table '${name}':`, error);
      throw error;
    }
  }

  // static async executeAlterations() {
  //   try {
  //     console.log('🔄 Starting table alterations...');
      
  //     // Execute alterations for users table
  //     await executeQuery(alterCommands.users);
  //     console.log('✅ Users table alterations completed');

  //     // Execute alterations for OTP tracker table
  //     await executeQuery(alterCommands.otp_tracker);
  //     console.log('✅ OTP_tracker table alterations completed');

  //     // Execute alterations for user sessions table
  //     await executeQuery(alterCommands.user_sessions);
  //     console.log('✅ User_sessions table alterations completed');

  //     console.log('✅ All table alterations completed successfully');
  //   } catch (error) {
  //     console.error('❌ Error executing table alterations:', error);
  //     throw error;
  //   }
  // }

  static async initializeDatabase() {
    try {
      console.log('🚀 Starting database initialization...');
      
      // First create and use our database
      await this.createAndUseDatabase();
      
      console.log(`📊 Found ${tables.length} tables to process`);

      let tablesCreated = 0;
      let tablesSkipped = 0;

      for (const table of tables) {
        const wasCreated = await this.createTable(table);
        if (wasCreated) {
          tablesCreated++;
        } else {
          tablesSkipped++;
        }
      }

      // Execute table alterations after creating tables
      // await this.executeAlterations();

      console.log('\n📈 Database Initialization Summary:');
      console.log(`✨ ${tablesCreated} tables created`);
      console.log(`↪️ ${tablesSkipped} tables already existed`);
      console.log('✅ Database initialization completed successfully\n');
    } catch (error) {
      console.error('❌ Database initialization failed:', error);
      throw error;
    }
  }

  static async dropTable(tableName) {
    try {
      await this.createAndUseDatabase(); // Make sure we're in the right database
      const exists = await this.checkTableExists(tableName);
      
      if (exists) {
        await executeQuery(`DROP TABLE ${tableName}`);
        console.log(`✅ Table '${tableName}' dropped successfully`);
      } else {
        console.log(`ℹ️ Table '${tableName}' does not exist`);
      }
    } catch (error) {
      console.error(`❌ Error dropping table '${tableName}':`, error);
      throw error;
    }
  }
}

module.exports = DatabaseInitializer; 