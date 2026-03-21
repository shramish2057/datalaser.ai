// API route: POST /api/sources/query
// Executes a read-only query against a connected data source.
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { createAdapter } from '@/lib/adapters';
import { decryptCredentials } from '@/lib/vault/decrypt';
import type { SourceType } from '@/types/connectors';

const querySchema = z.object({
  source_id: z.string().uuid('Invalid source ID'),
  query: z.string().min(1, 'Query is required').max(10000),
});

// Security: only allow SELECT statements
const FORBIDDEN_PATTERN = /^\s*(insert|update|delete|drop|alter|create|truncate|grant|revoke|exec|execute|merge|call)\b/i;

function isReadOnly(sql: string): boolean {
  const trimmed = sql.trim().toLowerCase();
  if (!trimmed.startsWith('select') && !trimmed.startsWith('with') && !trimmed.startsWith('explain')) {
    return false;
  }
  if (FORBIDDEN_PATTERN.test(trimmed)) {
    return false;
  }
  return true;
}

export async function POST(request: NextRequest) {
  try {
    // 1. Validate request body and check SQL safety FIRST (before auth, as defense in depth)
    const body = await request.json();
    const parsed = querySchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
        { status: 422 }
      );
    }

    const { source_id, query } = parsed.data;

    // 2. Security: reject non-SELECT queries immediately
    if (!isReadOnly(query)) {
      return NextResponse.json(
        { error: 'Only SELECT queries are allowed. INSERT, UPDATE, DELETE, DROP and other write operations are forbidden.' },
        { status: 403 }
      );
    }

    // 3. Authenticate
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // 4. Fetch source and verify ownership (RLS handles this, but be explicit)
    const { data: source, error: fetchError } = await supabase
      .from('data_sources')
      .select('*')
      .eq('id', source_id)
      .single();

    if (fetchError || !source) {
      return NextResponse.json(
        { error: 'Data source not found' },
        { status: 404 }
      );
    }

    if (source.workspace_id !== user.id) {
      return NextResponse.json(
        { error: 'Forbidden' },
        { status: 403 }
      );
    }

    if (!source.encrypted_credentials) {
      return NextResponse.json(
        { error: 'Data source has no stored credentials' },
        { status: 400 }
      );
    }

    // 5. Decrypt credentials and run query
    const credentials = decryptCredentials(source.encrypted_credentials);
    const adapter = createAdapter(source.source_type as SourceType, credentials as any);

    const testResult = await adapter.testConnection();
    if (!testResult.success) {
      await adapter.disconnect();
      return NextResponse.json(
        { error: 'Failed to connect to data source', message: testResult.error },
        { status: 502 }
      );
    }

    const result = await adapter.runQuery(query);
    await adapter.disconnect();

    return NextResponse.json({
      success: true,
      result,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: 'Query execution failed', message: err.message },
      { status: 500 }
    );
  }
}
