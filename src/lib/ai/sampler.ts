// Data sampling utilities to prepare representative subsets for AI analysis.
// Builds a structured text summary of all active data sources for a workspace.
import { createAdminClient } from '@/lib/supabase/admin';

const MAX_CONTEXT_CHARS = 24000; // ~6000 tokens at ~4 chars/token

interface SchemaTable {
  name: string;
  row_count: number;
  columns: { name: string; type: string; nullable: boolean }[];
}

interface SchemaSnapshot {
  tables: SchemaTable[];
  database_name: string;
}

interface SampleTable {
  name: string;
  columns: string[];
  rows: any[][];
  total_rows: number;
  sampled_rows: number;
}

interface SampleData {
  tables: SampleTable[];
}

function formatSchema(tables: SchemaTable[]): string {
  return tables.map((t) => {
    const cols = t.columns.map((c) => `    ${c.name} (${c.type}${c.nullable ? ', nullable' : ''})`).join('\n');
    return `  ${t.name} (${t.row_count.toLocaleString()} rows):\n${cols}`;
  }).join('\n');
}

function formatSampleRows(table: SampleTable, maxRows: number): string {
  if (!table.rows || table.rows.length === 0) return '    (no sample data)';
  const header = `    | ${table.columns.join(' | ')} |`;
  const rows = table.rows.slice(0, maxRows).map((row) => {
    const cells = row.map((cell) => {
      if (cell === null || cell === undefined) return 'NULL';
      const str = String(cell);
      return str.length > 40 ? str.slice(0, 37) + '...' : str;
    });
    return `    | ${cells.join(' | ')} |`;
  });
  return [header, ...rows].join('\n');
}

export async function buildDataContext(workspaceId: string, projectId?: string, sourceIds?: string[]): Promise<string> {
  const supabase = createAdminClient();

  let query = supabase
    .from('data_sources')
    .select('id, name, source_type, schema_snapshot, sample_data, row_count')
    .eq('status', 'active');

  if (sourceIds && sourceIds.length > 0) {
    query = query.in('id', sourceIds);
  } else if (projectId) {
    query = query.eq('project_id', projectId);
  } else {
    query = query.eq('workspace_id', workspaceId);
  }

  const { data: sources, error } = await query;

  if (error || !sources || sources.length === 0) {
    return 'No active data sources found for this workspace.';
  }

  const sections: string[] = [];

  for (const source of sources) {
    const schema = source.schema_snapshot as unknown as SchemaSnapshot | null;
    const sample = source.sample_data as unknown as SampleData | null;

    let section = `SOURCE: ${source.name} (${source.source_type})\n`;

    if (schema?.tables) {
      section += `TABLES: ${schema.tables.map((t) => `${t.name} (${t.row_count.toLocaleString()} rows)`).join(', ')}\n`;
      section += `SCHEMA:\n${formatSchema(schema.tables)}\n`;
    }

    if (sample?.tables) {
      section += `SAMPLE DATA (first 5 rows per table):\n`;
      for (const table of sample.tables) {
        section += `  ${table.name}:\n${formatSampleRows(table, 5)}\n`;
      }
    }

    section += '----';
    sections.push(section);
  }

  let context = sections.join('\n\n');

  // Truncate if over budget — drop sample data first, keep schema
  if (context.length > MAX_CONTEXT_CHARS) {
    const schemaSections: string[] = [];
    for (const source of sources) {
      const schema = source.schema_snapshot as unknown as SchemaSnapshot | null;
      let section = `SOURCE: ${source.name} (${source.source_type})\n`;
      if (schema?.tables) {
        section += `TABLES: ${schema.tables.map((t) => `${t.name} (${t.row_count.toLocaleString()} rows)`).join(', ')}\n`;
        section += `SCHEMA:\n${formatSchema(schema.tables)}\n`;
      }
      section += '(sample data truncated for brevity)\n----';
      schemaSections.push(section);
    }
    context = schemaSections.join('\n\n');

    // If still too long, hard truncate
    if (context.length > MAX_CONTEXT_CHARS) {
      context = context.slice(0, MAX_CONTEXT_CHARS) + '\n... (truncated)';
    }
  }

  return context;
}

/**
 * Build context from raw schema/sample objects (no Supabase fetch).
 * Used for testing and when data is already in memory.
 */
export function buildDataContextFromRaw(
  sources: { name: string; source_type: string; schema: SchemaSnapshot; sample: SampleData }[]
): string {
  const sections: string[] = [];

  for (const source of sources) {
    let section = `SOURCE: ${source.name} (${source.source_type})\n`;
    section += `TABLES: ${source.schema.tables.map((t) => `${t.name} (${t.row_count.toLocaleString()} rows)`).join(', ')}\n`;
    section += `SCHEMA:\n${formatSchema(source.schema.tables)}\n`;
    section += `SAMPLE DATA (first 5 rows per table):\n`;
    for (const table of source.sample.tables) {
      section += `  ${table.name}:\n${formatSampleRows(table, 5)}\n`;
    }
    section += '----';
    sections.push(section);
  }

  let context = sections.join('\n\n');
  if (context.length > MAX_CONTEXT_CHARS) {
    context = context.slice(0, MAX_CONTEXT_CHARS) + '\n... (truncated)';
  }
  return context;
}
