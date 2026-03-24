/**
 * Shared source type constants and helpers.
 * Import these instead of defining inline arrays in each page.
 */

export const FILE_TYPES = ['csv', 'xlsx', 'json', 'parquet'] as const
export const DB_TYPES = ['postgres', 'mysql', 'mssql', 'mongodb', 'snowflake', 'bigquery', 'redshift', 'databricks'] as const
export const SAAS_TYPES = ['shopify', 'stripe', 'google_ads', 'meta_ads', 'google_analytics', 'quickbooks', 'xero'] as const

export function isFileSource(type: string): boolean {
  return (FILE_TYPES as readonly string[]).includes(type)
}

export function isDbSource(type: string): boolean {
  return (DB_TYPES as readonly string[]).includes(type)
}

export function isSaasSource(type: string): boolean {
  return (SAAS_TYPES as readonly string[]).includes(type)
}
