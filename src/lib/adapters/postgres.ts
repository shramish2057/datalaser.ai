// PostgreSQL database adapter using pg Pool
import pg from 'pg';
import type { PostgresCredentials } from '@/types/connectors';
import type { DataAdapter, SchemaSnapshot, SampleOptions, SampleData, QueryResult } from './index';

export class PostgresAdapter implements DataAdapter {
  private pool: pg.Pool;
  private dbName: string;

  constructor(credentials: PostgresCredentials) {
    this.dbName = credentials.database;
    this.pool = new pg.Pool({
      host: credentials.host,
      port: credentials.port,
      database: credentials.database,
      user: credentials.username,
      password: credentials.password,
      ssl: credentials.ssl ? { rejectUnauthorized: false } : false,
      max: 5,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
    });
  }

  async testConnection(): Promise<{ success: boolean; error?: string }> {
    try {
      const client = await this.pool.connect();
      try {
        await client.query('SELECT 1');
        return { success: true };
      } finally {
        client.release();
      }
    } catch (err: any) {
      return { success: false, error: err.message || 'Failed to connect to PostgreSQL' };
    }
  }

  async getSchema(): Promise<SchemaSnapshot> {
    const client = await this.pool.connect();
    try {
      // Get all user tables with row counts from pg_stat_user_tables
      const tablesResult = await client.query(`
        SELECT
          t.table_name,
          COALESCE(s.n_live_tup, 0) AS row_count
        FROM information_schema.tables t
        LEFT JOIN pg_stat_user_tables s ON s.relname = t.table_name
        WHERE t.table_schema = 'public'
          AND t.table_type = 'BASE TABLE'
        ORDER BY t.table_name
      `);

      // Get all columns for public tables
      const columnsResult = await client.query(`
        SELECT
          table_name,
          column_name,
          data_type,
          is_nullable
        FROM information_schema.columns
        WHERE table_schema = 'public'
        ORDER BY table_name, ordinal_position
      `);

      // Build a lookup of columns by table
      const columnsByTable: Record<string, { name: string; type: string; nullable: boolean }[]> = {};
      for (const col of columnsResult.rows) {
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
        tables: tablesResult.rows.map((t) => ({
          name: t.table_name,
          row_count: Number(t.row_count),
          columns: columnsByTable[t.table_name] || [],
        })),
        database_name: this.dbName,
        captured_at: new Date().toISOString(),
      };
    } catch (err: any) {
      throw new Error(`Failed to get schema: ${err.message}`);
    } finally {
      client.release();
    }
  }

  async getSampleData(options: SampleOptions = {}): Promise<SampleData> {
    const maxRows = options.max_rows ?? 100;
    const client = await this.pool.connect();
    try {
      // Get target tables
      let tableNames: string[];
      if (options.tables && options.tables.length > 0) {
        tableNames = options.tables;
      } else {
        const res = await client.query(`
          SELECT table_name FROM information_schema.tables
          WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
          ORDER BY table_name
        `);
        tableNames = res.rows.map((r) => r.table_name);
      }

      const tables: SampleData['tables'] = [];

      for (const tableName of tableNames) {
        try {
          // Get total row count
          const countRes = await client.query(
            `SELECT COUNT(*) AS total FROM "${tableName}"`
          );
          const totalRows = Number(countRes.rows[0].total);

          // Build sample query
          let query = `SELECT * FROM "${tableName}"`;
          const params: any[] = [];

          if (options.date_column) {
            query += ` WHERE "${options.date_column}" > NOW() - INTERVAL '30 days'`;
          }
          query += ` LIMIT $${params.length + 1}`;
          params.push(maxRows);

          const dataRes = await client.query(query, params);
          const columns = dataRes.fields.map((f) => f.name);
          const rows = dataRes.rows.map((row) => columns.map((col) => row[col]));

          tables.push({
            name: tableName,
            columns,
            rows,
            total_rows: totalRows,
            sampled_rows: dataRes.rowCount ?? rows.length,
          });
        } catch (err: any) {
          // Skip tables we can't sample (permissions, etc.)
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
      client.release();
    }
  }

  async runQuery(sql: string): Promise<QueryResult> {
    const client = await this.pool.connect();
    try {
      const start = Date.now();
      const result = await client.query(sql);
      const duration_ms = Date.now() - start;

      const columns = result.fields.map((f) => f.name);
      const rows = result.rows.map((row) => columns.map((col) => row[col]));

      return {
        columns,
        rows,
        row_count: result.rowCount ?? rows.length,
        duration_ms,
      };
    } catch (err: any) {
      throw new Error(`Query failed: ${err.message}`);
    } finally {
      client.release();
    }
  }

  async disconnect(): Promise<void> {
    await this.pool.end();
  }
}
