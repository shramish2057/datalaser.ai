// CSV file adapter for parsing and querying uploaded CSV data
// Files are stored in Supabase Storage; this adapter reads and parses them.
import { createAdminClient } from '@/lib/supabase/admin';
import type { CSVCredentials } from '@/types/connectors';
import type { DataAdapter, SchemaSnapshot, SampleOptions, SampleData, QueryResult } from './index';

function inferType(value: string): string {
  if (value === '' || value === null || value === undefined) return 'null';
  if (!isNaN(Number(value)) && value.trim() !== '') return 'number';
  if (value === 'true' || value === 'false') return 'boolean';
  if (!isNaN(Date.parse(value)) && value.length > 4) return 'date';
  return 'string';
}

function parseCSV(raw: string): { headers: string[]; rows: string[][] } {
  const lines = raw.split('\n').filter((line) => line.trim() !== '');
  if (lines.length === 0) return { headers: [], rows: [] };

  const headers = lines[0].split(',').map((h) => h.trim().replace(/^"|"$/g, ''));
  const rows = lines.slice(1).map((line) =>
    line.split(',').map((cell) => cell.trim().replace(/^"|"$/g, ''))
  );

  return { headers, rows };
}

export class CSVAdapter implements DataAdapter {
  private credentials: CSVCredentials;
  private parsedData: { headers: string[]; rows: string[][] } | null = null;

  constructor(credentials: CSVCredentials) {
    this.credentials = credentials;
  }

  private async loadFile(): Promise<{ headers: string[]; rows: string[][] }> {
    if (this.parsedData) return this.parsedData;

    const supabase = createAdminClient();
    const { data, error } = await supabase.storage
      .from('uploads')
      .download(this.credentials.storage_path);

    if (error || !data) {
      throw new Error(`Failed to download CSV: ${error?.message || 'File not found'}`);
    }

    const text = await data.text();
    this.parsedData = parseCSV(text);
    return this.parsedData;
  }

  async testConnection(): Promise<{ success: boolean; error?: string }> {
    try {
      const supabase = createAdminClient();
      const { data, error } = await supabase.storage
        .from('uploads')
        .list(this.credentials.storage_path.split('/').slice(0, -1).join('/'));

      if (error) {
        return { success: false, error: error.message };
      }

      const filename = this.credentials.storage_path.split('/').pop();
      const exists = data?.some((f) => f.name === filename);

      return exists
        ? { success: true }
        : { success: false, error: `File not found: ${this.credentials.storage_path}` };
    } catch (err: any) {
      return { success: false, error: err.message || 'Failed to verify CSV file' };
    }
  }

  async getSchema(): Promise<SchemaSnapshot> {
    try {
      const { headers, rows } = await this.loadFile();

      // Infer column types from first 10 rows
      const sampleRows = rows.slice(0, 10);
      const columns = headers.map((name, idx) => {
        const types = sampleRows
          .map((row) => inferType(row[idx]))
          .filter((t) => t !== 'null');
        const dominantType = types.length > 0 ? types[0] : 'string';

        return { name, type: dominantType, nullable: true };
      });

      return {
        tables: [
          {
            name: this.credentials.filename,
            row_count: rows.length,
            columns,
          },
        ],
        database_name: 'csv_upload',
        captured_at: new Date().toISOString(),
      };
    } catch (err: any) {
      throw new Error(`Failed to get CSV schema: ${err.message}`);
    }
  }

  async getSampleData(options: SampleOptions = {}): Promise<SampleData> {
    const maxRows = options.max_rows ?? 100;
    try {
      const { headers, rows } = await this.loadFile();
      const sampledRows = rows.slice(0, maxRows);

      return {
        tables: [
          {
            name: this.credentials.filename,
            columns: headers,
            rows: sampledRows,
            total_rows: rows.length,
            sampled_rows: sampledRows.length,
          },
        ],
      };
    } catch (err: any) {
      throw new Error(`Failed to sample CSV: ${err.message}`);
    }
  }

  /**
   * CSV does not support SQL queries. Use getSampleData() instead.
   * This method throws to indicate that SQL is not supported.
   */
  async runQuery(_sql: string): Promise<QueryResult> {
    throw new Error(
      'CSV adapter does not support SQL queries. Use getSampleData() to retrieve data.'
    );
  }

  async disconnect(): Promise<void> {
    this.parsedData = null;
  }
}
