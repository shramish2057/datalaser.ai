// API route: POST /api/sources/test
// Tests connectivity to a data source without saving anything.
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { createAdapter } from '@/lib/adapters';
import type { SourceType } from '@/types/connectors';

const SOURCE_TYPES: SourceType[] = [
  'postgres', 'mysql', 'mssql', 'mongodb', 'sqlite',
  'snowflake', 'bigquery', 'redshift', 'databricks',
  'shopify', 'stripe', 'hubspot', 'salesforce',
  'google_ads', 'meta_ads', 'google_analytics',
  'quickbooks', 'xero',
  'csv', 'xlsx', 'json', 'parquet',
  'rest_api',
];

const testSchema = z.object({
  source_type: z.enum(SOURCE_TYPES as [string, ...string[]]),
  credentials: z.record(z.string(), z.any()),
});

export async function POST(request: NextRequest) {
  try {
    // 1. Validate request body first
    const body = await request.json();
    const parsed = testSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
        { status: 422 }
      );
    }

    const { source_type, credentials } = parsed.data;

    // 2. Authenticate
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // 3. Create adapter and test connection only
    let adapter;
    try {
      adapter = createAdapter(source_type as SourceType, credentials as any);
    } catch (err: any) {
      return NextResponse.json(
        { error: `Unsupported source type: ${source_type}`, message: err.message },
        { status: 400 }
      );
    }

    const result = await adapter.testConnection();
    await adapter.disconnect();

    if (result.success) {
      return NextResponse.json({
        success: true,
        message: 'Connection successful',
      });
    } else {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 400 }
      );
    }
  } catch (err: any) {
    return NextResponse.json(
      { error: 'Internal server error', message: err.message },
      { status: 500 }
    );
  }
}
