// AI integration test — generates insights from mock sales data via Claude
import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

import { buildDataContextFromRaw } from './sampler';
import { generateInsightsFromContext, explainAnomaly } from './claude';

// ANTHROPIC_API_KEY must be set in environment
if (!process.env.ANTHROPIC_API_KEY) {
  console.error('ERROR: Set ANTHROPIC_API_KEY environment variable to run this test.');
  process.exit(1);
}

// --- Mock data: an e-commerce company with sales + inventory data ---

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
            { name: 'customer_id', type: 'uuid', nullable: false },
            { name: 'total_amount', type: 'numeric', nullable: false },
            { name: 'status', type: 'text', nullable: false },
            { name: 'channel', type: 'text', nullable: true },
            { name: 'created_at', type: 'timestamptz', nullable: false },
          ],
        },
        {
          name: 'order_items',
          row_count: 38210,
          columns: [
            { name: 'id', type: 'uuid', nullable: false },
            { name: 'order_id', type: 'uuid', nullable: false },
            { name: 'product_id', type: 'uuid', nullable: false },
            { name: 'quantity', type: 'integer', nullable: false },
            { name: 'unit_price', type: 'numeric', nullable: false },
            { name: 'discount_pct', type: 'numeric', nullable: true },
          ],
        },
        {
          name: 'customers',
          row_count: 8934,
          columns: [
            { name: 'id', type: 'uuid', nullable: false },
            { name: 'email', type: 'text', nullable: false },
            { name: 'first_order_at', type: 'timestamptz', nullable: true },
            { name: 'total_orders', type: 'integer', nullable: false },
            { name: 'lifetime_value', type: 'numeric', nullable: false },
            { name: 'segment', type: 'text', nullable: true },
          ],
        },
        {
          name: 'products',
          row_count: 342,
          columns: [
            { name: 'id', type: 'uuid', nullable: false },
            { name: 'name', type: 'text', nullable: false },
            { name: 'category', type: 'text', nullable: false },
            { name: 'price', type: 'numeric', nullable: false },
            { name: 'cost', type: 'numeric', nullable: false },
            { name: 'inventory_count', type: 'integer', nullable: false },
          ],
        },
      ],
      database_name: 'shopify_sales',
    },
    sample: {
      tables: [
        {
          name: 'orders',
          columns: ['id', 'customer_id', 'total_amount', 'status', 'channel', 'created_at'],
          rows: [
            ['ord-001', 'cust-112', 284.50, 'completed', 'web', '2026-03-15T10:23:00Z'],
            ['ord-002', 'cust-045', 67.00, 'completed', 'mobile', '2026-03-15T11:05:00Z'],
            ['ord-003', 'cust-112', 412.80, 'completed', 'web', '2026-03-14T09:15:00Z'],
            ['ord-004', 'cust-891', 23.50, 'refunded', 'mobile', '2026-03-14T14:32:00Z'],
            ['ord-005', 'cust-234', 189.99, 'completed', 'instagram', '2026-03-13T16:45:00Z'],
          ],
          total_rows: 14823,
          sampled_rows: 5,
        },
        {
          name: 'customers',
          columns: ['id', 'email', 'first_order_at', 'total_orders', 'lifetime_value', 'segment'],
          rows: [
            ['cust-112', 'alice@example.com', '2025-06-12', 12, 3420.50, 'VIP'],
            ['cust-045', 'bob@example.com', '2026-01-03', 2, 134.00, 'new'],
            ['cust-891', 'carol@example.com', '2025-11-20', 5, 892.30, 'active'],
            ['cust-234', 'dave@example.com', '2025-09-08', 8, 1567.80, 'active'],
            ['cust-567', 'eve@example.com', '2026-02-28', 1, 45.00, 'new'],
          ],
          total_rows: 8934,
          sampled_rows: 5,
        },
        {
          name: 'products',
          columns: ['id', 'name', 'category', 'price', 'cost', 'inventory_count'],
          rows: [
            ['prod-001', 'Premium Headphones', 'Electronics', 189.99, 62.00, 45],
            ['prod-002', 'Organic Coffee Beans 1kg', 'Food & Beverage', 34.50, 12.00, 230],
            ['prod-003', 'Yoga Mat Pro', 'Fitness', 67.00, 18.50, 0],
            ['prod-004', 'Wireless Charger', 'Electronics', 29.99, 8.50, 412],
            ['prod-005', 'Leather Notebook', 'Stationery', 23.50, 7.00, 89],
          ],
          total_rows: 342,
          sampled_rows: 5,
        },
      ],
    },
  },
];

async function runTest() {
  console.log('=== Building data context ===');
  const context = buildDataContextFromRaw(mockSources);
  console.log(context);
  console.log(`\nContext length: ${context.length} chars (~${Math.round(context.length / 4)} tokens)\n`);

  // --- Test 1: generateInsights ---
  console.log('=== Test 1: Generating insights via Claude ===');
  console.log('Calling claude-sonnet-4-20250514...\n');

  const startTime = Date.now();
  const insights = await generateInsightsFromContext(context);
  const duration = Date.now() - startTime;

  console.log('--- FULL INSIGHT RESPONSE ---');
  console.log(JSON.stringify(insights, null, 2));
  console.log(`\nGenerated in ${duration}ms`);

  // Validate structure
  console.log('\n=== Validating response structure ===');
  const checks = [
    ['title', typeof insights.title === 'string' && insights.title.length > 0],
    ['executive_summary', typeof insights.executive_summary === 'string' && insights.executive_summary.length > 0],
    ['severity_chips', Array.isArray(insights.severity_chips) && insights.severity_chips.length > 0],
    ['kpis', Array.isArray(insights.kpis) && insights.kpis.length > 0],
    ['key_findings', Array.isArray(insights.key_findings) && insights.key_findings.length > 0],
    ['recommendations', Array.isArray(insights.recommendations) && insights.recommendations.length > 0],
    ['anomalies', Array.isArray(insights.anomalies)],
    ['deep_dives', Array.isArray(insights.deep_dives)],
  ] as const;

  let allPassed = true;
  for (const [field, ok] of checks) {
    const status = ok ? 'PASS' : 'FAIL';
    if (!ok) allPassed = false;
    console.log(`  ${status}: ${field}`);
  }

  // --- Test 2: explainAnomaly ---
  console.log('\n=== Test 2: Explain anomaly ===');
  const explanation = await explainAnomaly(
    'Yoga Mat Pro inventory',
    0,
    89,
    -100
  );
  console.log(`Anomaly explanation: ${explanation}`);
  const anomalyOk = explanation.length > 20;
  console.log(`  ${anomalyOk ? 'PASS' : 'FAIL'}: Anomaly explanation generated (${explanation.length} chars)`);
  if (!anomalyOk) allPassed = false;

  console.log(allPassed ? '\n✅ All AI tests passed!' : '\n❌ Some tests failed');
  if (!allPassed) process.exit(1);
}

runTest().catch((err) => {
  console.error(`\n❌ Test error: ${err.message}`);
  process.exit(1);
});
