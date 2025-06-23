require("dotenv").config();
const { DBSQLClient } = require("@databricks/sql");

// ===== Configuration ===
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1000;
const QUERY_TIMEOUT_MS = 30000; // 30 seconds

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

  async executeQuery(query, params = [], retries = MAX_RETRIES) {
    try {
      await this.connect();

      // Skip setting catalog/schema context to avoid permission issues
      // We'll use the default context provided by the connection
      // This avoids the CREATE SCHEMA permission error

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
        return this.executeQuery(query, params, retries - 1);
      }
      throw error;
    }
  }

  // ===== Cleanup =====
  async close() {
    try {
      if (this.session) await this.session.close();
      if (this.connection) await this.connection.close();
      console.log("🔌 Connection closed gracefully");
    } catch (error) {
      console.error("⚠️ Error during cleanup:", error);
    }
  }

  // ===== Private Helpers =====
  _registerShutdownHook() {
    process.on("SIGINT", async () => {
      await this.close();
      process.exit(0);
    });
  }

  // We're not using this method anymore to avoid permission issues
  async _setContext(catalog, schema) {
    try {
      // Ensure proper quoting of identifiers to avoid SQL injection
      const sanitizedCatalog = catalog.replace(/[^a-zA-Z0-9_]/g, "");
      const sanitizedSchema = schema.replace(/[^a-zA-Z0-9_]/g, "");

      console.log(
        `Setting context to catalog: ${sanitizedCatalog}, schema: ${sanitizedSchema}`
      );

      await this.session.executeStatement(
        `USE CATALOG \`${sanitizedCatalog}\``
      );
      await this.session.executeStatement(`USE SCHEMA \`${sanitizedSchema}\``);
    } catch (error) {
      console.error("Error setting catalog/schema context:", error);
      // Continue execution even if context setting fails
    }
  }

  _isConnectionHealthy() {
    return this.connection && !this.connection.closed && this.session;
  }
}

// ===== Singleton Instance =====
const databricksSQL = new DatabricksSQLManager();

// ===== Export for Application Use =====
module.exports = {
  connect: () => databricksSQL.connect(),
  executeQuery: (query, params) => databricksSQL.executeQuery(query, params),
  close: () => databricksSQL.close(),
};
