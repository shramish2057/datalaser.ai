import { NextResponse } from 'next/server';
import { suggestMetrics } from '@/lib/ai/claude';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { files, locale } = body;

    if (!files || !Array.isArray(files) || files.length === 0) {
      return NextResponse.json(
        { error: 'No file data provided' },
        { status: 400 }
      );
    }

    // Validate that at least one file has columns
    const hasColumns = files.some(
      (f: { columns?: unknown[] }) => f.columns && f.columns.length > 0
    );
    if (!hasColumns) {
      return NextResponse.json(
        { error: 'No column data found in uploaded files' },
        { status: 400 }
      );
    }

    const suggestions = await suggestMetrics(files, locale || 'en');
    return NextResponse.json(suggestions);
  } catch (error) {
    console.error('Metric suggestion error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to suggest metrics' },
      { status: 500 }
    );
  }
}
