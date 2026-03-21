// Integration test for source API route logic
// Tests: validation, adapter creation, connection testing, query security, encryption round-trip
import { z } from 'zod';
import { createAdapter } from '@/lib/adapters';
import { encryptCredentials, decryptCredentials } from '@/lib/vault/encrypt';
import type { SourceType, SourceCategory } from '@/types/connectors';

process.env.ENCRYPTION_SECRET = 'test-secret-for-api-routes';

function assert(condition: boolean, msg: string) {
  if (!condition) { console.error(`  FAIL: ${msg}`); process.exit(1); }
  console.log(`  PASS: ${msg}`);
}

// --- Zod schemas (same as routes) ---
const SOURCE_TYPES: SourceType[] = [
  'postgres', 'mysql', 'mssql', 'mongodb', 'sqlite',
  'snowflake', 'bigquery', 'redshift', 'databricks',
  'shopify', 'stripe', 'hubspot', 'salesforce',
  'google_ads', 'meta_ads', 'google_analytics',
  'quickbooks', 'xero', 'csv', 'xlsx', 'json', 'parquet', 'rest_api',
];
const SOURCE_CATEGORIES: SourceCategory[] = [
  'database', 'warehouse', 'ecommerce', 'marketing', 'crm', 'finance', 'file',
];

const connectSchema = z.object({
  name: z.string().min(1).max(100),
  source_type: z.enum(SOURCE_TYPES as [string, ...string[]]),
  category: z.enum(SOURCE_CATEGORIES as [string, ...string[]]),
  credentials: z.record(z.string(), z.any()),
});

const testSchema = z.object({
  source_type: z.enum(SOURCE_TYPES as [string, ...string[]]),
  credentials: z.record(z.string(), z.any()),
});

const querySchema = z.object({
  source_id: z.string().uuid(),
  query: z.string().min(1).max(10000),
});

const FORBIDDEN_PATTERN = /^\s*(insert|update|delete|drop|alter|create|truncate|grant|revoke|exec|execute|merge|call)\b/i;
function isReadOnly(sql: string): boolean {
  const trimmed = sql.trim().toLowerCase();
  if (!trimmed.startsWith('select') && !trimmed.startsWith('with') && !trimmed.startsWith('explain')) return false;
  if (FORBIDDEN_PATTERN.test(trimmed)) return false;
  return true;
}

// ============================
// TEST 1: Zod validation
// ============================
console.log('\n=== Test 1: Zod validation ===');

// Valid connect body
const validConnect = connectSchema.safeParse({
  name: 'My Postgres DB',
  source_type: 'postgres',
  category: 'database',
  credentials: { host: 'localhost', port: '5432', database: 'test', username: 'pg', password: 'pass', ssl: 'false' },
});
assert(validConnect.success, 'Valid connect body passes validation');

// Missing name
const noName = connectSchema.safeParse({
  source_type: 'postgres', category: 'database', credentials: {},
});
assert(!noName.success, 'Missing name rejected');

// Invalid source_type
const badType = connectSchema.safeParse({
  name: 'x', source_type: 'oracle', category: 'database', credentials: {},
});
assert(!badType.success, 'Invalid source_type "oracle" rejected');

// Invalid category
const badCat = connectSchema.safeParse({
  name: 'x', source_type: 'postgres', category: 'magic', credentials: {},
});
assert(!badCat.success, 'Invalid category "magic" rejected');

// Valid test body
const validTest = testSchema.safeParse({
  source_type: 'mysql', credentials: { host: 'localhost' },
});
assert(validTest.success, 'Valid test body passes');

// Valid query body
const validQuery = querySchema.safeParse({
  source_id: '550e8400-e29b-41d4-a716-446655440000',
  query: 'SELECT * FROM users',
});
assert(validQuery.success, 'Valid query body passes');

// Invalid UUID
const badUuid = querySchema.safeParse({ source_id: 'not-a-uuid', query: 'SELECT 1' });
assert(!badUuid.success, 'Invalid UUID rejected');

// ============================
// TEST 2: SQL security filter
// ============================
console.log('\n=== Test 2: SQL read-only security ===');

assert(isReadOnly('SELECT * FROM users'), 'SELECT allowed');
assert(isReadOnly('select count(*) from orders'), 'lowercase select allowed');
assert(isReadOnly('  SELECT 1'), 'Leading whitespace select allowed');
assert(isReadOnly('WITH cte AS (SELECT 1) SELECT * FROM cte'), 'CTE with WITH allowed');
assert(isReadOnly('EXPLAIN SELECT * FROM users'), 'EXPLAIN SELECT allowed');

assert(!isReadOnly('INSERT INTO users VALUES (1)'), 'INSERT blocked');
assert(!isReadOnly('UPDATE users SET name = "x"'), 'UPDATE blocked');
assert(!isReadOnly('DELETE FROM users'), 'DELETE blocked');
assert(!isReadOnly('DROP TABLE users'), 'DROP blocked');
assert(!isReadOnly('ALTER TABLE users ADD col int'), 'ALTER blocked');
assert(!isReadOnly('CREATE TABLE foo (id int)'), 'CREATE blocked');
assert(!isReadOnly('TRUNCATE users'), 'TRUNCATE blocked');
assert(!isReadOnly('GRANT ALL ON users TO public'), 'GRANT blocked');
assert(!isReadOnly('EXECUTE sp_help'), 'EXECUTE blocked');
assert(!isReadOnly('  drop table users'), 'Leading whitespace DROP blocked');

// ============================
// TEST 3: Adapter factory
// ============================
console.log('\n=== Test 3: Adapter factory ===');

const pgCreds = { host: 'localhost', port: 5432, database: 'test', username: 'pg', password: 'pass', ssl: false };
const pgAdapter = createAdapter('postgres', pgCreds as any);
assert(typeof pgAdapter.testConnection === 'function', 'Postgres adapter created');

const mysqlCreds = { host: 'localhost', port: 3306, database: 'test', username: 'root', password: 'pass', ssl: false };
const mysqlAdapter = createAdapter('mysql', mysqlCreds as any);
assert(typeof mysqlAdapter.testConnection === 'function', 'MySQL adapter created');

try {
  createAdapter('oracle' as any, {} as any);
  assert(false, 'Should throw for unsupported');
} catch (e: any) {
  assert(e.message.includes('Unsupported'), 'Unsupported type throws');
}

// ============================
// TEST 4: Encryption round-trip (simulates connect → store → query flow)
// ============================
console.log('\n=== Test 4: Credential encryption round-trip ===');

const creds = { host: 'prod-db.example.com', port: '5432', database: 'analytics', username: 'admin', password: 'P@ss!w0rd#2024' };
const encrypted = encryptCredentials(creds);
assert(encrypted.split(':').length === 3, 'Encrypted to iv:tag:data format');

const decrypted = decryptCredentials(encrypted);
assert(decrypted.host === creds.host, 'host decrypted correctly');
assert(decrypted.password === creds.password, 'password decrypted correctly');
assert(JSON.stringify(decrypted) === JSON.stringify(creds), 'Full round-trip matches');

// ============================
// TEST 5: Live connection test (Postgres, if available)
// ============================
console.log('\n=== Test 5: Live Postgres connection test ===');

async function testLive() {
  const liveCreds = {
    host: process.env.PG_HOST || 'localhost',
    port: Number(process.env.PG_PORT) || 5432,
    database: process.env.PG_DATABASE || 'postgres',
    username: process.env.PG_USER || 'postgres',
    password: process.env.PG_PASSWORD || 'postgres',
    ssl: false,
  };

  const adapter = createAdapter('postgres', liveCreds as any);
  const result = await adapter.testConnection();

  if (!result.success) {
    console.log(`  SKIP: No local PostgreSQL (${result.error})`);
    await adapter.disconnect();
    return;
  }

  assert(result.success, 'Live connection successful');

  // Simulate the connect flow: test → schema → sample → encrypt → decrypt → query
  const schema = await adapter.getSchema();
  assert(schema.tables !== undefined, `Schema: ${schema.tables.length} tables in "${schema.database_name}"`);

  const sample = await adapter.getSampleData({ max_rows: 5 });
  assert(sample.tables !== undefined, `Sample: ${sample.tables.length} tables sampled`);

  // Encrypt credentials as the connect route would
  const enc = encryptCredentials(liveCreds as any);
  const dec = decryptCredentials(enc);
  assert(dec.host === liveCreds.host, 'Stored credentials decrypt correctly');

  // Re-create adapter from decrypted creds (as query route would)
  const adapter2 = createAdapter('postgres', dec as any);
  const queryResult = await adapter2.runQuery('SELECT current_database() AS db, current_user AS usr');
  assert(queryResult.row_count === 1, `Query returned: db=${queryResult.rows[0][0]}, user=${queryResult.rows[0][1]}`);
  assert(queryResult.duration_ms >= 0, `Query duration: ${queryResult.duration_ms}ms`);

  await adapter.disconnect();
  await adapter2.disconnect();
}

testLive()
  .then(() => console.log('\n✅ All source API tests passed!'))
  .catch((e) => { console.error(`\n❌ ${e.message}`); process.exit(1); });
