// Claude AI client wrapper for interacting with the Anthropic API
import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';
import { buildDataContext, buildDataContextFromRaw } from './sampler';
import {
  SYSTEM_PROMPT_INSIGHTS,
  SYSTEM_PROMPT_ASK,
  SYSTEM_PROMPT_ANOMALY,
} from './prompts';

// --- Singleton client ---

let _client: Anthropic | null = null;

function getClient(): Anthropic {
  if (!_client) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error('ANTHROPIC_API_KEY environment variable is not set');
    }
    _client = new Anthropic({ apiKey });
  }
  return _client;
}

// --- Zod schemas for response validation ---

const severityChipSchema = z.object({
  label: z.string(),
  level: z.enum(['critical', 'warning', 'info', 'success']),
});

const kpiSchema = z.object({
  label: z.string(),
  value: z.union([z.string(), z.number()]),
  change: z.number().optional(),
  trend: z.enum(['up', 'down', 'flat']).optional(),
});

const keyFindingSchema = z.object({
  title: z.string(),
  description: z.string(),
  severity: z.string(),
  metric: z.string().optional(),
});

const recommendationSchema = z.object({
  title: z.string(),
  description: z.string(),
  impact: z.string(),
  effort: z.string(),
});

const anomalySchema = z.object({
  metric: z.string(),
  value: z.number(),
  expected: z.number(),
  deviation: z.number(),
  explanation: z.string(),
});

const deepDiveSchema = z.object({
  title: z.string(),
  content: z.string(),
});

const insightResponseSchema = z.object({
  title: z.string(),
  executive_summary: z.string(),
  severity_chips: z.array(severityChipSchema),
  kpis: z.array(kpiSchema),
  key_findings: z.array(keyFindingSchema),
  recommendations: z.array(recommendationSchema),
  anomalies: z.array(anomalySchema),
  deep_dives: z.array(deepDiveSchema),
});

export type InsightResponse = z.infer<typeof insightResponseSchema>;

// --- Core functions ---

/**
 * Generate structured insights from all active data sources in a workspace.
 */
export async function generateInsights(workspaceId: string): Promise<InsightResponse> {
  const client = getClient();
  const context = await buildDataContext(workspaceId);
  return _generateInsightsFromContext(client, context);
}

/**
 * Generate insights from a raw context string (for testing without Supabase).
 */
export async function generateInsightsFromContext(context: string): Promise<InsightResponse> {
  const client = getClient();
  return _generateInsightsFromContext(client, context);
}

async function _generateInsightsFromContext(client: Anthropic, context: string): Promise<InsightResponse> {
  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 4000,
    system: SYSTEM_PROMPT_INSIGHTS,
    messages: [
      {
        role: 'user',
        content: `Analyse this business data and return insights JSON:\n\n${context}`,
      },
    ],
  });

  // Extract text content
  const textBlock = response.content.find((block) => block.type === 'text');
  if (!textBlock || textBlock.type !== 'text') {
    throw new Error('No text response from Claude');
  }

  // Parse JSON — handle potential markdown wrapping
  let jsonStr = textBlock.text.trim();
  if (jsonStr.startsWith('```')) {
    jsonStr = jsonStr.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
  }

  let parsed;
  try {
    parsed = JSON.parse(jsonStr);
  } catch (e) {
    throw new Error(`Failed to parse Claude response as JSON: ${(e as Error).message}\nRaw: ${jsonStr.slice(0, 500)}`);
  }

  // Validate with Zod
  const validated = insightResponseSchema.safeParse(parsed);
  if (!validated.success) {
    throw new Error(`Claude response does not match InsightDocument schema: ${JSON.stringify(validated.error.flatten().fieldErrors)}`);
  }

  return validated.data;
}

/**
 * Stream responses for the Ask Data conversational interface.
 */
export async function* streamAskData(
  workspaceId: string,
  message: string,
  history: { role: string; content: string }[]
): AsyncGenerator<string> {
  const client = getClient();
  const context = await buildDataContext(workspaceId);
  const systemPrompt = SYSTEM_PROMPT_ASK.replace('{DATA_CONTEXT}', context);

  const messages: { role: 'user' | 'assistant'; content: string }[] = [
    ...history.map((h) => ({
      role: h.role as 'user' | 'assistant',
      content: h.content,
    })),
    { role: 'user', content: message },
  ];

  const stream = client.messages.stream({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 2000,
    system: systemPrompt,
    messages,
  });

  for await (const event of stream) {
    if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
      yield event.delta.text;
    }
  }
}

/**
 * Explain a detected anomaly in plain English.
 */
export async function explainAnomaly(
  metricName: string,
  currentValue: number,
  baselineValue: number,
  deviationPct: number
): Promise<string> {
  const client = getClient();

  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 300,
    system: SYSTEM_PROMPT_ANOMALY,
    messages: [
      {
        role: 'user',
        content: `Metric: ${metricName}\nCurrent value: ${currentValue}\nBaseline value: ${baselineValue}\nDeviation: ${deviationPct > 0 ? '+' : ''}${deviationPct.toFixed(1)}%`,
      },
    ],
  });

  const textBlock = response.content.find((block) => block.type === 'text');
  if (!textBlock || textBlock.type !== 'text') {
    throw new Error('No text response from Claude');
  }

  return textBlock.text.trim();
}
