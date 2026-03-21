// TypeScript types for data source connector configurations and credentials

export type SourceType =
  | 'postgres' | 'mysql' | 'mssql' | 'mongodb' | 'sqlite'
  | 'snowflake' | 'bigquery' | 'redshift' | 'databricks'
  | 'shopify' | 'stripe' | 'hubspot' | 'salesforce'
  | 'google_ads' | 'meta_ads' | 'google_analytics'
  | 'quickbooks' | 'xero'
  | 'csv' | 'xlsx' | 'json' | 'parquet'
  | 'rest_api';

export type SourceCategory =
  | 'database' | 'warehouse' | 'ecommerce'
  | 'marketing' | 'crm' | 'finance' | 'file';

// --- Database credentials ---

export interface PostgresCredentials {
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
  ssl: boolean;
}

export interface MysqlCredentials {
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
  ssl: boolean;
}

export interface MssqlCredentials {
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
  encrypt: boolean;
}

export interface MongodbCredentials {
  connection_string: string;
  database: string;
}

export interface SqliteCredentials {
  file_path: string;
}

// --- Warehouse credentials ---

export interface SnowflakeCredentials {
  account: string;
  username: string;
  password: string;
  warehouse: string;
  database: string;
  schema: string;
}

export interface BigQueryCredentials {
  project_id: string;
  dataset: string;
  service_account_json: string;
}

export interface RedshiftCredentials {
  cluster_identifier: string;
  database: string;
  db_user: string;
  region: string;
  access_key_id: string;
  secret_access_key: string;
}

export interface DatabricksCredentials {
  host: string;
  token: string;
  http_path: string;
  catalog: string;
  schema: string;
}

// --- E-commerce credentials ---

export interface ShopifyCredentials {
  shop_domain: string;
  access_token: string;
}

export interface StripeCredentials {
  secret_key: string;
}

// --- CRM credentials ---

export interface HubspotCredentials {
  access_token: string;
  portal_id: string;
}

export interface SalesforceCredentials {
  instance_url: string;
  access_token: string;
  refresh_token: string;
}

// --- Marketing credentials ---

export interface GoogleAdsCredentials {
  client_id: string;
  client_secret: string;
  refresh_token: string;
  customer_id: string;
}

export interface MetaAdsCredentials {
  access_token: string;
  ad_account_id: string;
}

export interface GoogleAnalyticsCredentials {
  property_id: string;
  service_account_json: string;
}

// --- Finance credentials ---

export interface QuickbooksCredentials {
  client_id: string;
  client_secret: string;
  refresh_token: string;
  realm_id: string;
}

export interface XeroCredentials {
  client_id: string;
  client_secret: string;
  refresh_token: string;
  tenant_id: string;
}

// --- File credentials ---

export interface CSVCredentials {
  storage_path: string;
  filename: string;
  row_count: number;
  columns: { name: string; type: string }[];
}

export interface XlsxCredentials {
  storage_path: string;
  filename: string;
  sheet_name: string;
  row_count: number;
  columns: { name: string; type: string }[];
}

export interface JsonCredentials {
  storage_path: string;
  filename: string;
  record_count: number;
}

export interface ParquetCredentials {
  storage_path: string;
  filename: string;
  row_count: number;
  columns: { name: string; type: string }[];
}

// --- REST API credentials ---

export interface RestApiCredentials {
  base_url: string;
  auth_type: 'bearer' | 'api_key' | 'basic' | 'none';
  auth_token?: string;
  api_key?: string;
  username?: string;
  password?: string;
  headers?: Record<string, string>;
}

// --- Union type ---

export type AnyCredentials =
  | PostgresCredentials
  | MysqlCredentials
  | MssqlCredentials
  | MongodbCredentials
  | SqliteCredentials
  | SnowflakeCredentials
  | BigQueryCredentials
  | RedshiftCredentials
  | DatabricksCredentials
  | ShopifyCredentials
  | StripeCredentials
  | HubspotCredentials
  | SalesforceCredentials
  | GoogleAdsCredentials
  | MetaAdsCredentials
  | GoogleAnalyticsCredentials
  | QuickbooksCredentials
  | XeroCredentials
  | CSVCredentials
  | XlsxCredentials
  | JsonCredentials
  | ParquetCredentials
  | RestApiCredentials;

// --- Mapping source type to category ---

export const SOURCE_CATEGORY_MAP: Record<SourceType, SourceCategory> = {
  postgres: 'database',
  mysql: 'database',
  mssql: 'database',
  mongodb: 'database',
  sqlite: 'database',
  snowflake: 'warehouse',
  bigquery: 'warehouse',
  redshift: 'warehouse',
  databricks: 'warehouse',
  shopify: 'ecommerce',
  stripe: 'ecommerce',
  hubspot: 'crm',
  salesforce: 'crm',
  google_ads: 'marketing',
  meta_ads: 'marketing',
  google_analytics: 'marketing',
  quickbooks: 'finance',
  xero: 'finance',
  csv: 'file',
  xlsx: 'file',
  json: 'file',
  parquet: 'file',
  rest_api: 'database',
};
