// Dry-run test for AI layer — validates everything except the actual Claude API call
import { buildDataContextFromRaw } from './sampler';
import { SYSTEM_PROMPT_INSIGHTS, SYSTEM_PROMPT_ASK, SYSTEM_PROMPT_ANOMALY } from './prompts';
import { z } from 'zod';

function assert(condition: boolean, msg: string) {
  if (!condition) { console.error(`  FAIL: ${msg}`); process.exit(1); }
  console.log(`  PASS: ${msg}`);
}

// --- Test 1: buildDataContextFromRaw ---
console.log('\n=== Test 1: Data context builder ===');

const mockSources = [
  {
    name: 'Shopify Sales DB',
    source_type: 'postgres',
    schema: {
      tables: [
        {
          name: 'orders',
          row_count: 14823,
          columns: [
            { name: 'id', type: 'uuid', nullable: false },
            { name: 'total_amount', type: 'numeric', nullable: false },
            { name: 'status', type: 'text', nullable: false },
            { name: 'created_at', type: 'timestamptz', nullable: false },
          ],
        },
        {
          name: 'customers',
          row_count: 8934,
          columns: [
            { name: 'id', type: 'uuid', nullable: false },
            { name: 'email', type: 'text', nullable: false },
            { name: 'lifetime_value', type: 'numeric', nullable: false },
          ],
        },
      ],
      database_name: 'shopify_sales',
    },
    sample: {
      tables: [
        {
          name: 'orders',
          columns: ['id', 'total_amount', 'status', 'created_at'],
          rows: [
            ['ord-001', 284.50, 'completed', '2026-03-15'],
            ['ord-002', 67.00, 'completed', '2026-03-15'],
            ['ord-003', 412.80, 'completed', '2026-03-14'],
          ],
          total_rows: 14823,
          sampled_rows: 3,
        },
        {
          name: 'customers',
          columns: ['id', 'email', 'lifetime_value'],
          rows: [
            ['cust-112', 'alice@example.com', 3420.50],
            ['cust-045', 'bob@example.com', 134.00],
          ],
          total_rows: 8934,
          sampled_rows: 2,
        },
      ],
    },
  },
];

const context = buildDataContextFromRaw(mockSources);
console.log(context);
console.log(`\nContext length: ${context.length} chars (~${Math.round(context.length / 4)} tokens)\n`);

assert(context.includes('SOURCE: Shopify Sales DB'), 'Context contains source name');
assert(context.includes('orders (14,823 rows)'), 'Context contains table with row count');
assert(context.includes('total_amount'), 'Context contains column names');
assert(!context.includes('284.5'), 'Context does NOT contain sample data values');
assert(context.includes('----'), 'Context has separator');

// --- Test 2: Prompts ---
console.log('\n=== Test 2: Prompts loaded ===');

assert(SYSTEM_PROMPT_INSIGHTS.includes('senior business analyst'), 'Insights prompt loaded');
assert(SYSTEM_PROMPT_INSIGHTS.includes('severity_chips'), 'Insights prompt has schema');
assert(SYSTEM_PROMPT_ASK.includes('{DATA_CONTEXT}'), 'Ask prompt has context placeholder');
assert(SYSTEM_PROMPT_ASK.includes('[CHART'), 'Ask prompt has chart format');
assert(SYSTEM_PROMPT_ASK.includes('[TABLE'), 'Ask prompt has table format');
assert(SYSTEM_PROMPT_ANOMALY.includes('anomaly'), 'Anomaly prompt loaded');

// --- Test 3: Ask prompt context injection ---
console.log('\n=== Test 3: Ask prompt context injection ===');

const askPrompt = SYSTEM_PROMPT_ASK.replace('{DATA_CONTEXT}', context);
assert(askPrompt.includes('SOURCE: Shopify Sales DB'), 'Ask prompt has injected context');
assert(!askPrompt.includes('{DATA_CONTEXT}'), 'Placeholder replaced');

// --- Test 4: Zod schema validates a mock Claude response ---
console.log('\n=== Test 4: Zod schema validation ===');

const insightResponseSchema = z.object({
  title: z.string(),
  executive_summary: z.string(),
  severity_chips: z.array(z.object({ label: z.string(), level: z.enum(['critical', 'warning', 'info', 'success']) })),
  kpis: z.array(z.object({ label: z.string(), value: z.union([z.string(), z.number()]), change: z.number().optional(), trend: z.enum(['up', 'down', 'flat']).optional() })),
  key_findings: z.array(z.object({ title: z.string(), description: z.string(), severity: z.string(), metric: z.string().optional() })),
  recommendations: z.array(z.object({ title: z.string(), description: z.string(), impact: z.string(), effort: z.string() })),
  anomalies: z.array(z.object({ metric: z.string(), value: z.number(), expected: z.number(), deviation: z.number(), explanation: z.string() })),
  deep_dives: z.array(z.object({ title: z.string(), content: z.string() })),
});

const mockResponse = {
  title: 'E-Commerce Health Report — March 2026',
  executive_summary: 'Strong revenue growth with $284.50 avg order value. Customer LTV shows healthy segmentation.',
  severity_chips: [
    { label: 'Revenue Growing', level: 'success' },
    { label: 'Inventory Alert', level: 'warning' },
  ],
  kpis: [
    { label: 'Total Orders', value: 14823, change: 12.3, trend: 'up' },
    { label: 'Avg Order Value', value: '$254.76', change: -2.1, trend: 'down' },
    { label: 'Customer Count', value: 8934, change: 8.5, trend: 'up' },
    { label: 'Refund Rate', value: '3.2%', change: 0.5, trend: 'flat' },
  ],
  key_findings: [
    { title: 'High-value repeat customers', description: 'VIP segment shows $3,420 LTV', severity: 'info', metric: 'lifetime_value' },
    { title: 'Mobile channel underperforming', description: 'Mobile orders avg $67 vs $284 web', severity: 'warning', metric: 'total_amount' },
  ],
  recommendations: [
    { title: 'Invest in VIP retention', description: 'Top customers drive disproportionate revenue', impact: 'high', effort: 'medium' },
    { title: 'Improve mobile UX', description: 'Mobile AOV is 76% lower than web', impact: 'high', effort: 'high' },
  ],
  anomalies: [
    { metric: 'Yoga Mat Pro inventory', value: 0, expected: 89, deviation: -100, explanation: 'Stock depleted — likely stockout' },
  ],
  deep_dives: [
    { title: 'Channel Performance Analysis', content: 'Web drives 65% of revenue with significantly higher AOV...' },
  ],
};

const validated = insightResponseSchema.safeParse(mockResponse);
assert(validated.success, 'Mock Claude response validates against Zod schema');

// Test invalid response
const badResponse = { ...mockResponse, severity_chips: [{ label: 'X', level: 'INVALID' }] };
const badResult = insightResponseSchema.safeParse(badResponse);
assert(!badResult.success, 'Invalid severity level rejected by Zod');

// --- Test 5: Context truncation ---
console.log('\n=== Test 5: Context truncation ===');

const hugeSources = Array.from({ length: 50 }, (_, i) => ({
  name: `Source ${i}`,
  source_type: 'postgres',
  schema: {
    tables: Array.from({ length: 20 }, (_, j) => ({
      name: `table_${i}_${j}`,
      row_count: 100000,
      columns: Array.from({ length: 10 }, (_, k) => ({
        name: `col_${k}`,
        type: 'text',
        nullable: true,
      })),
    })),
    database_name: `db_${i}`,
  },
  sample: {
    tables: Array.from({ length: 20 }, (_, j) => ({
      name: `table_${i}_${j}`,
      columns: Array.from({ length: 10 }, (_, k) => `col_${k}`),
      rows: Array.from({ length: 100 }, () => Array.from({ length: 10 }, () => 'sample_value')),
      total_rows: 100000,
      sampled_rows: 100,
    })),
  },
}));

const hugeContext = buildDataContextFromRaw(hugeSources);
assert(hugeContext.length <= 24100, `Huge context truncated to ${hugeContext.length} chars (limit 24000)`);

console.log('\n✅ All dry-run AI tests passed!');
console.log('\nTo run the live Claude API test, set ANTHROPIC_API_KEY in .env.local and run:');
console.log('  npx tsx --tsconfig tsconfig.json -r tsconfig-paths/register src/lib/ai/ai.test.ts');
