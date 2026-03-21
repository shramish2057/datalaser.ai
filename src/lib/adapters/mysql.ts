// MySQL database adapter using mysql2/promise
import mysql from 'mysql2/promise';
import type { MysqlCredentials } from '@/types/connectors';
import type { DataAdapter, SchemaSnapshot, SampleOptions, SampleData, QueryResult } from './index';

export class MysqlAdapter implements DataAdapter {
  private pool: mysql.Pool;
  private dbName: string;

  constructor(credentials: MysqlCredentials) {
    this.dbName = credentials.database;
    this.pool = mysql.createPool({
      host: credentials.host,
      port: credentials.port,
      database: credentials.database,
      user: credentials.username,
      password: credentials.password,
      ssl: credentials.ssl ? {} : undefined,
      waitForConnections: true,
      connectionLimit: 5,
      connectTimeout: 10000,
    });
  }

  async testConnection(): Promise<{ success: boolean; error?: string }> {
    try {
      const conn = await this.pool.getConnection();
      try {
        await conn.query('SELECT 1');
        return { success: true };
      } finally {
        conn.release();
      }
    } catch (err: any) {
      return { success: false, error: err.message || 'Failed to connect to MySQL' };
    }
  }

  async getSchema(): Promise<SchemaSnapshot> {
    const conn = await this.pool.getConnection();
    try {
      // Get all tables with row counts
      const [tables] = await conn.query<mysql.RowDataPacket[]>(`
        SELECT
          t.TABLE_NAME AS table_name,
          t.TABLE_ROWS AS row_count
        FROM information_schema.TABLES t
        WHERE t.TABLE_SCHEMA = ?
          AND t.TABLE_TYPE = 'BASE TABLE'
        ORDER BY t.TABLE_NAME
      `, [this.dbName]);

      // Get all columns
      const [columns] = await conn.query<mysql.RowDataPacket[]>(`
        SELECT
          TABLE_NAME AS table_name,
          COLUMN_NAME AS column_name,
          DATA_TYPE AS data_type,
          IS_NULLABLE AS is_nullable
        FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = ?
        ORDER BY TABLE_NAME, ORDINAL_POSITION
      `, [this.dbName]);

      // Build column lookup
      const columnsByTable: Record<string, { name: string; type: string; nullable: boolean }[]> = {};
      for (const col of columns) {
        if (!columnsByTable[col.table_name]) {
          columnsByTable[col.table_name] = [];
        }
        columnsByTable[col.table_name].push({
          name: col.column_name,
          type: col.data_type,
          nullable: col.is_nullable === 'YES',
        });
      }

      return {
        tables: tables.map((t) => ({
          name: t.table_name,
          row_count: Number(t.row_count) || 0,
          columns: columnsByTable[t.table_name] || [],
        })),
        database_name: this.dbName,
        captured_at: new Date().toISOString(),
      };
    } catch (err: any) {
      throw new Error(`Failed to get schema: ${err.message}`);
    } finally {
      conn.release();
    }
  }

  async getSampleData(options: SampleOptions = {}): Promise<SampleData> {
    const maxRows = options.max_rows ?? 100;
    const conn = await this.pool.getConnection();
    try {
      let tableNames: string[];
      if (options.tables && options.tables.length > 0) {
        tableNames = options.tables;
      } else {
        const [rows] = await conn.query<mysql.RowDataPacket[]>(`
          SELECT TABLE_NAME AS table_name
          FROM information_schema.TABLES
          WHERE TABLE_SCHEMA = ? AND TABLE_TYPE = 'BASE TABLE'
          ORDER BY TABLE_NAME
        `, [this.dbName]);
        tableNames = rows.map((r) => r.table_name);
      }

      const tables: SampleData['tables'] = [];

      for (const tableName of tableNames) {
        try {
          const [countRows] = await conn.query<mysql.RowDataPacket[]>(
            `SELECT COUNT(*) AS total FROM \`${tableName}\``
          );
          const totalRows = Number(countRows[0].total);

          let query = `SELECT * FROM \`${tableName}\``;
          const params: any[] = [];

          if (options.date_column) {
            query += ` WHERE \`${options.date_column}\` > DATE_SUB(NOW(), INTERVAL 30 DAY)`;
          }
          query += ` LIMIT ?`;
          params.push(maxRows);

          const [dataRows] = await conn.query<mysql.RowDataPacket[]>(query, params);

          const columns = dataRows.length > 0 ? Object.keys(dataRows[0]) : [];
          const rows = dataRows.map((row) => columns.map((col) => row[col]));

          tables.push({
            name: tableName,
            columns,
            rows,
            total_rows: totalRows,
            sampled_rows: dataRows.length,
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
    } finally {
      conn.release();
    }
  }

  async runQuery(sql: string): Promise<QueryResult> {
    const conn = await this.pool.getConnection();
    try {
      const start = Date.now();
      const [rows] = await conn.query<mysql.RowDataPacket[]>(sql);
      const duration_ms = Date.now() - start;

      const columns = rows.length > 0 ? Object.keys(rows[0]) : [];
      const resultRows = rows.map((row) => columns.map((col) => row[col]));

      return {
        columns,
        rows: resultRows,
        row_count: rows.length,
        duration_ms,
      };
    } catch (err: any) {
      throw new Error(`Query failed: ${err.message}`);
    } finally {
      conn.release();
    }
  }

  async disconnect(): Promise<void> {
    await this.pool.end();
  }
}
