// Adapter layer tests
// Tests the PostgresAdapter against a local PostgreSQL instance if available,
// and validates the factory function and interface contracts.

import { createAdapter } from './index';
import { PostgresAdapter } from './postgres';
import type { PostgresCredentials } from '@/types/connectors';

// --- Test helpers ---
function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`  FAIL: ${message}`);
    process.exit(1);
  }
  console.log(`  PASS: ${message}`);
}

// --- Test 1: Factory function ---
console.log('\n=== Test 1: createAdapter factory ===');

const pgCreds: PostgresCredentials = {
  host: 'localhost',
  port: 5432,
  database: 'test_db',
  username: 'postgres',
  password: 'postgres',
  ssl: false,
};

const adapter = createAdapter('postgres', pgCreds);
assert(adapter instanceof PostgresAdapter, 'Factory returns PostgresAdapter for "postgres" type');

try {
  createAdapter('oracle' as any, pgCreds);
  assert(false, 'Factory should throw for unsupported type');
} catch (err: any) {
  assert(err.message.includes('Unsupported'), 'Factory throws descriptive error for unsupported type');
}

// --- Test 2: Interface contract ---
console.log('\n=== Test 2: Interface contract ===');
assert(typeof adapter.testConnection === 'function', 'testConnection is a function');
assert(typeof adapter.getSchema === 'function', 'getSchema is a function');
assert(typeof adapter.getSampleData === 'function', 'getSampleData is a function');
assert(typeof adapter.runQuery === 'function', 'runQuery is a function');
assert(typeof adapter.disconnect === 'function', 'disconnect is a function');

// --- Test 3: Live PostgreSQL connection (requires local PG running) ---
console.log('\n=== Test 3: Live PostgreSQL connection ===');

async function testLivePostgres() {
  const liveCreds: PostgresCredentials = {
    host: process.env.PG_HOST || 'localhost',
    port: Number(process.env.PG_PORT) || 5432,
    database: process.env.PG_DATABASE || 'postgres',
    username: process.env.PG_USER || 'postgres',
    password: process.env.PG_PASSWORD || 'postgres',
    ssl: false,
  };

  const pg = new PostgresAdapter(liveCreds);

  // Test connection
  const connResult = await pg.testConnection();
  if (!connResult.success) {
    console.log(`  SKIP: No local PostgreSQL available (${connResult.error})`);
    console.log('  Set PG_HOST, PG_PORT, PG_DATABASE, PG_USER, PG_PASSWORD to test live.');
    await pg.disconnect();
    return;
  }
  assert(connResult.success, 'Connected to local PostgreSQL');

  // Get schema
  const schema = await pg.getSchema();
  assert(typeof schema.database_name === 'string', `Schema database: ${schema.database_name}`);
  assert(Array.isArray(schema.tables), `Found ${schema.tables.length} tables`);
  console.log(`  Schema snapshot:`);
  for (const table of schema.tables.slice(0, 5)) {
    console.log(`    - ${table.name}: ${table.row_count} rows, ${table.columns.length} columns`);
  }
  if (schema.tables.length > 5) {
    console.log(`    ... and ${schema.tables.length - 5} more tables`);
  }

  // Sample data
  const sample = await pg.getSampleData({ max_rows: 5 });
  assert(Array.isArray(sample.tables), `Sampled ${sample.tables.length} tables`);
  for (const table of sample.tables.slice(0, 3)) {
    console.log(`  Sample from "${table.name}": ${table.sampled_rows}/${table.total_rows} rows, columns: [${table.columns.join(', ')}]`);
  }

  // Run a query
  const queryResult = await pg.runQuery('SELECT current_database(), current_user, now()');
  assert(queryResult.row_count === 1, 'Query returned 1 row');
  assert(queryResult.columns.length === 3, `Query columns: [${queryResult.columns.join(', ')}]`);
  console.log(`  Query result: ${JSON.stringify(queryResult.rows[0])}`);
  assert(queryResult.duration_ms >= 0, `Query took ${queryResult.duration_ms}ms`);

  await pg.disconnect();
  assert(true, 'Disconnected cleanly');
}

testLivePostgres()
  .then(() => {
    console.log('\n✅ All adapter tests passed!');
  })
  .catch((err) => {
    console.error(`\n❌ Test error: ${err.message}`);
    process.exit(1);
  });
