// API route: POST /api/sources/connect
// Validates credentials, tests connection, pulls schema/sample, encrypts, and saves.
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { createAdapter } from '@/lib/adapters';
import { encryptCredentials } from '@/lib/vault/encrypt';
import type { SourceType, SourceCategory } from '@/types/connectors';
import { isDbSource } from '@/lib/source-types';

const SOURCE_TYPES: SourceType[] = [
  'postgres', 'mysql', 'mssql', 'mongodb', 'sqlite',
  'snowflake', 'bigquery', 'redshift', 'databricks',
  'shopify', 'stripe', 'hubspot', 'salesforce',
  'google_ads', 'meta_ads', 'google_analytics',
  'quickbooks', 'xero',
  'csv', 'xlsx', 'json', 'parquet',
  'rest_api',
];

const SOURCE_CATEGORIES: SourceCategory[] = [
  'database', 'warehouse', 'ecommerce', 'marketing', 'crm', 'finance', 'file',
];

const connectSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  source_type: z.enum(SOURCE_TYPES as [string, ...string[]]),
  category: z.enum(SOURCE_CATEGORIES as [string, ...string[]]),
  credentials: z.record(z.string(), z.any()),
  project_id: z.string().uuid().optional(),
});

export async function POST(request: NextRequest) {
  try {
    // 1. Validate request body first
    const body = await request.json();
    const parsed = connectSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
        { status: 422 }
      );
    }

    const { name, source_type, category, credentials, project_id } = parsed.data;

    // 2. Authenticate
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // 3. Test connection before saving
    let adapter;
    try {
      adapter = createAdapter(source_type as SourceType, credentials as any);
    } catch (err: any) {
      return NextResponse.json(
        { error: `Unsupported source type: ${source_type}`, message: err.message },
        { status: 400 }
      );
    }

    const testResult = await adapter.testConnection();
    if (!testResult.success) {
      await adapter.disconnect();
      return NextResponse.json(
        { error: 'Connection failed', message: testResult.error },
        { status: 400 }
      );
    }

    // 4. Pull schema (and sample data for file sources only)
    let schemaSnapshot, sampleData;
    try {
      schemaSnapshot = await adapter.getSchema();
      // For DB sources: only get schema, skip sample data — we never copy raw rows
      if (isDbSource(source_type)) {
        sampleData = { tables: [] };
      } else {
        // File sources: get both (files are already uploaded, not live)
        sampleData = await adapter.getSampleData({ max_rows: 100 });
      }
    } catch (err: any) {
      await adapter.disconnect();
      return NextResponse.json(
        { error: 'Connected but failed to retrieve schema', message: err.message },
        { status: 400 }
      );
    }

    await adapter.disconnect();

    // 5. Encrypt credentials and save
    const encryptedCreds = encryptCredentials(credentials as Record<string, string>);

    const totalRows = schemaSnapshot.tables.reduce((sum, t) => sum + t.row_count, 0);

    // Resolve org_id from project if provided
    let orgId: string | undefined;
    if (project_id) {
      const { data: proj } = await supabase
        .from('projects')
        .select('org_id')
        .eq('id', project_id)
        .single();
      orgId = proj?.org_id;
    }

    const insertData: Record<string, unknown> = {
      workspace_id: user.id,
      name,
      source_type,
      category,
      encrypted_credentials: encryptedCreds,
      status: 'active',
      schema_snapshot: schemaSnapshot,
      sample_data: sampleData,
      row_count: totalRows,
      last_synced_at: new Date().toISOString(),
    };

    if (project_id) insertData.project_id = project_id;
    if (orgId) insertData.org_id = orgId;

    const { data: source, error: insertError } = await supabase
      .from('data_sources')
      .insert(insertData)
      .select('id, name, source_type, category, status, schema_snapshot, row_count, created_at')
      .single();

    if (insertError) {
      return NextResponse.json(
        { error: 'Failed to save data source', message: insertError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      source,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: 'Internal server error', message: err.message },
      { status: 500 }
    );
  }
}
