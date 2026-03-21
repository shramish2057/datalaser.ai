// MongoDB adapter using the mongodb native driver
// Note: MongoDB does not support SQL. runQuery() uses a JSON-based filter instead.
import { MongoClient, Db } from 'mongodb';
import type { MongodbCredentials } from '@/types/connectors';
import type { DataAdapter, SchemaSnapshot, SampleOptions, SampleData, QueryResult } from './index';

export class MongoDBAdapter implements DataAdapter {
  private client: MongoClient;
  private db: Db | null = null;
  private dbName: string;

  constructor(credentials: MongodbCredentials) {
    this.dbName = credentials.database;
    this.client = new MongoClient(credentials.connection_string, {
      connectTimeoutMS: 10000,
      serverSelectionTimeoutMS: 10000,
    });
  }

  private async getDb(): Promise<Db> {
    if (!this.db) {
      await this.client.connect();
      this.db = this.client.db(this.dbName);
    }
    return this.db;
  }

  async testConnection(): Promise<{ success: boolean; error?: string }> {
    try {
      const db = await this.getDb();
      await db.command({ ping: 1 });
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || 'Failed to connect to MongoDB' };
    }
  }

  async getSchema(): Promise<SchemaSnapshot> {
    try {
      const db = await this.getDb();
      const collections = await db.listCollections().toArray();

      const tables: SchemaSnapshot['tables'] = [];

      for (const col of collections) {
        const collection = db.collection(col.name);
        const count = await collection.countDocuments();

        // Infer schema from a sample document
        const sample = await collection.findOne();
        const columns: { name: string; type: string; nullable: boolean }[] = [];

        if (sample) {
          for (const [key, value] of Object.entries(sample)) {
            columns.push({
              name: key,
              type: value === null ? 'null' : typeof value === 'object'
                ? (Array.isArray(value) ? 'array' : 'object')
                : typeof value,
              nullable: true, // MongoDB fields are always optional
            });
          }
        }

        tables.push({
          name: col.name,
          row_count: count,
          columns,
        });
      }

      return {
        tables,
        database_name: this.dbName,
        captured_at: new Date().toISOString(),
      };
    } catch (err: any) {
      throw new Error(`Failed to get schema: ${err.message}`);
    }
  }

  async getSampleData(options: SampleOptions = {}): Promise<SampleData> {
    const maxRows = options.max_rows ?? 100;
    const db = await this.getDb();

    let collectionNames: string[];
    if (options.tables && options.tables.length > 0) {
      collectionNames = options.tables;
    } else {
      const collections = await db.listCollections().toArray();
      collectionNames = collections.map((c) => c.name);
    }

    const tables: SampleData['tables'] = [];

    for (const name of collectionNames) {
      try {
        const collection = db.collection(name);
        const totalRows = await collection.countDocuments();

        let filter: Record<string, any> = {};
        if (options.date_column) {
          const thirtyDaysAgo = new Date();
          thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
          filter[options.date_column] = { $gte: thirtyDaysAgo };
        }

        const docs = await collection.find(filter).limit(maxRows).toArray();

        // Normalise docs to columnar format
        const columnSet = new Set<string>();
        for (const doc of docs) {
          for (const key of Object.keys(doc)) {
            columnSet.add(key);
          }
        }
        const columns = Array.from(columnSet);
        const rows = docs.map((doc) => columns.map((col) => (doc as any)[col] ?? null));

        tables.push({
          name,
          columns,
          rows,
          total_rows: totalRows,
          sampled_rows: docs.length,
        });
      } catch {
        tables.push({
          name,
          columns: [],
          rows: [],
          total_rows: 0,
          sampled_rows: 0,
        });
      }
    }

    return { tables };
  }

  /**
   * MongoDB does not support SQL. This method accepts a JSON string:
   * { "collection": "name", "filter": {...}, "limit": 100 }
   */
  async runQuery(queryJson: string): Promise<QueryResult> {
    try {
      const start = Date.now();
      const { collection: colName, filter = {}, limit = 100 } = JSON.parse(queryJson);

      if (!colName) {
        throw new Error('Query must include a "collection" field');
      }

      const db = await this.getDb();
      const docs = await db.collection(colName).find(filter).limit(limit).toArray();
      const duration_ms = Date.now() - start;

      const columnSet = new Set<string>();
      for (const doc of docs) {
        for (const key of Object.keys(doc)) {
          columnSet.add(key);
        }
      }
      const columns = Array.from(columnSet);
      const rows = docs.map((doc) => columns.map((col) => (doc as any)[col] ?? null));

      return {
        columns,
        rows,
        row_count: docs.length,
        duration_ms,
      };
    } catch (err: any) {
      throw new Error(`MongoDB query failed: ${err.message}`);
    }
  }

  async disconnect(): Promise<void> {
    await this.client.close();
    this.db = null;
  }
}
