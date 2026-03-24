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

interface TableProfile {
  name: string;
  quality_score: number;
  quality_level: string;
  total_rows: number;
  total_columns: number;
  columns?: ColumnStats[];
}

interface ColumnStats {
  name: string;
  dtype: string;
  null_rate?: number;
  unique_count?: number;
  min_value?: number | null;
  max_value?: number | null;
  mean_value?: number | null;
  top_values?: { value: string; count: number }[];
}

interface DataProfile {
  overall_quality: number;
  table_profiles: TableProfile[];
  profiled_at: string;
}

function formatSchema(tables: SchemaTable[]): string {
  return tables.map((t) => {
    const cols = t.columns.map((c) => `    ${c.name} (${c.type}${c.nullable ? ', nullable' : ''})`).join('\n');
    return `  ${t.name} (${t.row_count.toLocaleString()} rows):\n${cols}`;
  }).join('\n');
}

function formatStatistics(tables: SchemaTable[], profile?: DataProfile | null): string {
  const profileMap = new Map<string, TableProfile>();
  if (profile?.table_profiles) {
    for (const tp of profile.table_profiles) {
      profileMap.set(tp.name, tp);
    }
  }

  return tables.map((t) => {
    const tp = profileMap.get(t.name);
    const colStats = tp?.columns;
    const colMap = new Map<string, ColumnStats>();
    if (colStats) {
      for (const c of colStats) colMap.set(c.name, c);
    }

    const lines = t.columns.map((c) => {
      const stats = colMap.get(c.name);
      if (!stats) return `    ${c.name} (${c.type})`;

      const parts: string[] = [];
      if (stats.min_value != null && stats.max_value != null) {
        parts.push(`min=${stats.min_value}, max=${stats.max_value}`);
      }
      if (stats.mean_value != null) {
        parts.push(`avg=${Number(stats.mean_value).toFixed(1)}`);
      }
      if (stats.null_rate != null) {
        parts.push(`nulls=${Math.round(stats.null_rate * 100)}%`);
      }
      if (stats.unique_count != null) {
        parts.push(`${stats.unique_count} unique values`);
      }
      if (stats.top_values && stats.top_values.length > 0) {
        const totalCount = stats.top_values.reduce((s, v) => s + v.count, 0);
        const topStr = stats.top_values.slice(0, 3).map((v) => {
          const pct = totalCount > 0 ? Math.round((v.count / totalCount) * 100) : 0;
          return `"${v.value}" (${pct}%)`;
        }).join(', ');
        parts.push(`top: ${topStr}`);
      }

      const suffix = parts.length > 0 ? `: ${parts.join(', ')}` : '';
      return `    ${c.name} (${stats.dtype || c.type})${suffix}`;
    });

    return `  ${t.name}:\n${lines.join('\n')}`;
  }).join('\n');
}

export async function buildDataContext(workspaceId: string, projectId?: string, sourceIds?: string[]): Promise<string> {
  const supabase = createAdminClient();

  let query = supabase
    .from('data_sources')
    .select('id, name, source_type, schema_snapshot, data_profile, row_count, cleaned_file_path, file_path')
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
    const cleanedPath = source.cleaned_file_path as string | null;
    const schema = source.schema_snapshot as unknown as SchemaSnapshot | null;
    const profile = source.data_profile as unknown as DataProfile | null;

    let section = `SOURCE: ${source.name} (${source.source_type})`;
    if (cleanedPath) section += ` [CLEANED]`;
    section += '\n';

    // If cleaned data exists in Storage, extract column names and row count only
    if (cleanedPath) {
      try {
        const { data: blob } = await supabase.storage
          .from('data-sources')
          .download(cleanedPath);
        if (blob) {
          const text = await blob.text();
          const lines = text.split('\n').filter(l => l.trim());
          const headers = lines[0];
          section += `COLUMNS: ${headers}\n`;
          section += `ROWS: ${lines.length - 1}\n`;
          section += '----';
          sections.push(section);
          continue;
        }
      } catch {
        // Fall through to schema
      }
    }

    if (schema?.tables) {
      section += `TABLES: ${schema.tables.map((t) => `${t.name} (${t.row_count.toLocaleString()} rows)`).join(', ')}\n`;
      section += `SCHEMA:\n${formatSchema(schema.tables)}\n`;

      // Add aggregate statistics from profile (no raw data values)
      const stats = formatStatistics(schema.tables, profile);
      if (stats.trim()) {
        section += `STATISTICS:\n${stats}\n`;
      }
    }

    section += '----';
    sections.push(section);
  }

  let context = sections.join('\n\n');

  // Truncate if over budget — drop statistics first, keep schema
  if (context.length > MAX_CONTEXT_CHARS) {
    const schemaSections: string[] = [];
    for (const source of sources) {
      const schema = source.schema_snapshot as unknown as SchemaSnapshot | null;
      let section = `SOURCE: ${source.name} (${source.source_type})\n`;
      if (schema?.tables) {
        section += `TABLES: ${schema.tables.map((t) => `${t.name} (${t.row_count.toLocaleString()} rows)`).join(', ')}\n`;
        section += `SCHEMA:\n${formatSchema(schema.tables)}\n`;
      }
      section += '(statistics truncated for brevity)\n----';
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
 * Build context from raw schema objects (no Supabase fetch).
 * Used for testing and when data is already in memory.
 */
export function buildDataContextFromRaw(
  sources: { name: string; source_type: string; schema: SchemaSnapshot; profile?: DataProfile | null }[]
): string {
  const sections: string[] = [];

  for (const source of sources) {
    let section = `SOURCE: ${source.name} (${source.source_type})\n`;
    section += `TABLES: ${source.schema.tables.map((t) => `${t.name} (${t.row_count.toLocaleString()} rows)`).join(', ')}\n`;
    section += `SCHEMA:\n${formatSchema(source.schema.tables)}\n`;

    const stats = formatStatistics(source.schema.tables, source.profile);
    if (stats.trim()) {
      section += `STATISTICS:\n${stats}\n`;
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
