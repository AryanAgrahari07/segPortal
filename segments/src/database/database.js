require("dotenv").config();
const { DBSQLClient } = require("@databricks/sql");

// ===== Configuration ===
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 2000;
const QUERY_TIMEOUT_MS = 60000; // 60 seconds

// ==== Connection Manager ====
class DatabricksSQLManager {
  constructor() {
    this.client = new DBSQLClient();
    this.connection = null;
    this.session = null;
    this._registerShutdownHook();
  }

  // ===== Core Methods =====
  async connect() {
    try {
      // Check if we already have a healthy connection
      if (this._isConnectionHealthy()) {
        return this.connection;
      }

      // Validate required connection parameters
      if (!process.env.DATABRICKS_HOST) {
        throw new Error("DATABRICKS_HOST environment variable is missing");
      }

      if (!process.env.DATABRICKS_PATH) {
        throw new Error("DATABRICKS_PATH environment variable is missing");
      }

      if (!process.env.DATABRICKS_TOKEN) {
        throw new Error("DATABRICKS_TOKEN environment variable is missing");
      }

      // Ensure path starts with a slash
      const path = process.env.DATABRICKS_PATH.startsWith("/")
        ? process.env.DATABRICKS_PATH
        : `/${process.env.DATABRICKS_PATH}`;

      // Connect to Databricks SQL
      this.connection = await this.client.connect({
        host: process.env.DATABRICKS_HOST,
        path: path,
        token: process.env.DATABRICKS_TOKEN,
      });

      this.session = await this.connection.openSession();
      console.log("✅ Databricks SQL connected");
      return this.connection;
    } catch (error) {
      console.error("🔴 Connection failed:", error);
      throw error;
    }
  }

  async executeQuery(query, params = [], retries = MAX_RETRIES, schema = null) {
    try {
      await this.connect();

      // Use specified schema if provided, otherwise use default from env
      if (schema) {
        // Set the schema context for this query
        const schemaSetQuery = `USE ${schema}`;
        const schemaOperation = await this.session.executeStatement(schemaSetQuery);
        await schemaOperation.close();
        // console.log(`Using schema: ${schema} for query`);
      }

      const queryOperation = await this.session.executeStatement(query, {
        parameters: params.length ? params : undefined,
        timeout: QUERY_TIMEOUT_MS,
      });

      const result = await queryOperation.fetchAll();
      await queryOperation.close();
      return result;
    } catch (error) {
      if (retries > 0) {
        console.log(
          `🔄 Retrying query (${MAX_RETRIES - retries + 1}/${MAX_RETRIES})...`
        );
        await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
        return this.executeQuery(query, params, retries - 1, schema);
      }
      throw error;
    }
  }

  // ===== Cleanup =====
  async close() {
    try {
      if (this.session) {
        await this.session.close();
        this.session = null;
      }
      if (this.connection) {
        await this.connection.close();
        this.connection = null;
      }
      console.log("Databricks SQL connection closed");
    } catch (error) {
      console.error("Error closing connection:", error);
    }
  }

  _isConnectionHealthy() {
    return this.connection !== null && this.session !== null;
  }

  _registerShutdownHook() {
    // Close connection gracefully on process termination
    ["SIGINT", "SIGTERM"].forEach((signal) => {
      process.on(signal, async () => {
        console.log(`\nReceived ${signal}, closing connections...`);
        await this.close();
        process.exit(0);
      });
    });
  }

  // We're not using this method anymore to avoid permission issues
  async _setContext(catalog, schema) {
    try {
      // Ensure proper quoting of identifiers to avoid SQL injection
      const sanitizedCatalog = catalog.replace(/[^a-zA-Z0-9_]/g, "");
      const sanitizedSchema = schema.replace(/[^a-zA-Z0-9_]/g, "");

      console.log(
        `Setting context to catalog=${sanitizedCatalog}, schema=${sanitizedSchema}`
      );

      const query = `USE ${sanitizedCatalog}.${sanitizedSchema}`;
      const operation = await this.session.executeStatement(query);
      await operation.close();

      console.log(`✅ Context set to ${sanitizedCatalog}.${sanitizedSchema}`);
    } catch (error) {
      console.error("❌ Error setting context:", error);
      throw error;
    }
  }
}

// ==== Singleton Instance ====
const manager = new DatabricksSQLManager();

// ==== Exported Functions ====
const connect = async () => {
  return await manager.connect();
};

const executeQuery = async (query, params = [], schema = null) => {
  return await manager.executeQuery(query, params, MAX_RETRIES, schema);
};

// Add function to execute query in gold schema
const executeGoldSchemaQuery = async (query, params = []) => {
  const goldSchema = process.env.GOLD_SCHEMA || 'uat.gold';
  return await manager.executeQuery(query, params, MAX_RETRIES, goldSchema);
};

// Add function to execute query in app schema
const executeAppSchemaQuery = async (query, params = []) => {
  const appSchema = process.env.APP_SCHEMA || process.env.DB_NAME;
  return await manager.executeQuery(query, params, MAX_RETRIES, appSchema);
};

const close = async () => {
  return await manager.close();
};

module.exports = {
  connect,
  executeQuery,
  executeGoldSchemaQuery,
  executeAppSchemaQuery,
  close,
};
