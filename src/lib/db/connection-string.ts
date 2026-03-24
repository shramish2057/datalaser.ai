/**
 * Build a SQLAlchemy-compatible connection string from credentials.
 * Normalizes key casing (handles both "Host" and "host").
 */
export function buildConnectionString(sourceType: string, creds: Record<string, string>): string {
  // Normalize keys to lowercase
  const n: Record<string, string> = {}
  for (const [k, v] of Object.entries(creds)) {
    n[k.toLowerCase()] = v
  }

  const { host, port, database, username, password, account, warehouse, schema: dbSchema, connection_string } = n

  // MongoDB may use a raw connection string
  if (sourceType === 'mongodb' && connection_string) return connection_string

  const encPass = encodeURIComponent(password || '')

  switch (sourceType) {
    case 'postgres':
      return `postgresql://${username}:${encPass}@${host}:${port || 5432}/${database}`
    case 'mysql':
      return `mysql+pymysql://${username}:${encPass}@${host}:${port || 3306}/${database}`
    case 'mssql':
      return `mssql+pyodbc://${username}:${encPass}@${host}:${port || 1433}/${database}?driver=ODBC+Driver+18+for+SQL+Server`
    case 'snowflake':
      return `snowflake://${username}:${encPass}@${account}/${database}/${dbSchema || 'PUBLIC'}?warehouse=${warehouse}`
    case 'bigquery':
      return `bigquery://${database}`
    case 'redshift':
      return `redshift+psycopg2://${username}:${encPass}@${host}:${port || 5439}/${database}`
    default:
      return `postgresql://${username}:${encPass}@${host}:${port || 5432}/${database}`
  }
}
