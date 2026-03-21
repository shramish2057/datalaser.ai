// Snowflake data warehouse adapter using snowflake-sdk
import snowflake from 'snowflake-sdk';
import type { SnowflakeCredentials } from '@/types/connectors';
import type { DataAdapter, SchemaSnapshot, SampleOptions, SampleData, QueryResult } from './index';

// Promisify snowflake connection and statement execution
function connectAsync(connection: snowflake.Connection): Promise<void> {
  return new Promise((resolve, reject) => {
    connection.connect((err) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

function executeAsync(connection: snowflake.Connection, sql: string): Promise<any[]> {
  return new Promise((resolve, reject) => {
    connection.execute({
      sqlText: sql,
      complete: (err, _stmt, rows) => {
        if (err) reject(err);
        else resolve(rows || []);
      },
    });
  });
}

export class SnowflakeAdapter implements DataAdapter {
  private connection: snowflake.Connection;
  private credentials: SnowflakeCredentials;
  private connected = false;

  constructor(credentials: SnowflakeCredentials) {
    this.credentials = credentials;
    this.connection = snowflake.createConnection({
      account: credentials.account,
      username: credentials.username,
      password: credentials.password,
      warehouse: credentials.warehouse,
      database: credentials.database,
      schema: credentials.schema,
    });
  }

  private async ensureConnected(): Promise<void> {
    if (!this.connected) {
      await connectAsync(this.connection);
      this.connected = true;
    }
  }

  async testConnection(): Promise<{ success: boolean; error?: string }> {
    try {
      await this.ensureConnected();
      await executeAsync(this.connection, 'SELECT 1');
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || 'Failed to connect to Snowflake' };
    }
  }

  async getSchema(): Promise<SchemaSnapshot> {
    try {
      await this.ensureConnected();

      // Get all tables
      const tables = await executeAsync(this.connection, 'SHOW TABLES');

      const schemaEntries: SchemaSnapshot['tables'] = [];

      for (const table of tables) {
        const tableName = table.name;
        const rowCount = Number(table.rows) || 0;

        // Get columns via DESCRIBE TABLE
        const descResult = await executeAsync(this.connection, `DESCRIBE TABLE "${tableName}"`);

        const columns = descResult.map((col: any) => ({
          name: col.name,
          type: col.type,
          nullable: col['null?'] === 'Y',
        }));

        schemaEntries.push({
          name: tableName,
          row_count: rowCount,
          columns,
        });
      }

      return {
        tables: schemaEntries,
        database_name: this.credentials.database,
        captured_at: new Date().toISOString(),
      };
    } catch (err: any) {
      throw new Error(`Failed to get Snowflake schema: ${err.message}`);
    }
  }

  async getSampleData(options: SampleOptions = {}): Promise<SampleData> {
    const maxRows = options.max_rows ?? 100;
    await this.ensureConnected();

    let tableNames: string[];
    if (options.tables && options.tables.length > 0) {
      tableNames = options.tables;
    } else {
      const tablesResult = await executeAsync(this.connection, 'SHOW TABLES');
      tableNames = tablesResult.map((t: any) => t.name);
    }

    const tables: SampleData['tables'] = [];

    for (const tableName of tableNames) {
      try {
        // Get total count
        const countResult = await executeAsync(
          this.connection,
          `SELECT COUNT(*) AS TOTAL FROM "${tableName}"`
        );
        const totalRows = Number(countResult[0]?.TOTAL) || 0;

        // Sample rows using Snowflake SAMPLE syntax
        let query: string;
        if (options.date_column) {
          query = `SELECT * FROM "${tableName}" WHERE "${options.date_column}" > DATEADD('day', -30, CURRENT_TIMESTAMP()) LIMIT ${maxRows}`;
        } else {
          query = `SELECT * FROM "${tableName}" SAMPLE (${maxRows} ROWS)`;
        }

        const rows = await executeAsync(this.connection, query);
        const columns = rows.length > 0 ? Object.keys(rows[0]) : [];
        const dataRows = rows.map((row: any) => columns.map((col) => row[col]));

        tables.push({
          name: tableName,
          columns,
          rows: dataRows,
          total_rows: totalRows,
          sampled_rows: rows.length,
        });
      } catch {
        tables.push({
          name: tableName,
          columns: [],
          rows: [],
          total_rows: 0,
          sampled_rows: 0,
        });
      }
    }

    return { tables };
  }

  async runQuery(sql: string): Promise<QueryResult> {
    try {
      await this.ensureConnected();
      const start = Date.now();
      const rows = await executeAsync(this.connection, sql);
      const duration_ms = Date.now() - start;

      const columns = rows.length > 0 ? Object.keys(rows[0]) : [];
      const dataRows = rows.map((row: any) => columns.map((col) => row[col]));

      return {
        columns,
        rows: dataRows,
        row_count: rows.length,
        duration_ms,
      };
    } catch (err: any) {
      throw new Error(`Snowflake query failed: ${err.message}`);
    }
  }

  async disconnect(): Promise<void> {
    if (this.connected) {
      this.connection.destroy((err) => {
        if (err) console.error('Error disconnecting from Snowflake:', err.message);
      });
      this.connected = false;
    }
  }
}
