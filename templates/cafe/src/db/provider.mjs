/** Select the server database without silently treating SQLite as PostgreSQL. */
export function postgresConnectionConfig(env) {
  const provider = env.DATABASE_PROVIDER || 'postgresql';
  if (provider !== 'postgresql') {
    throw new Error(`Cafe database provider "${provider}" is not implemented: its PostgreSQL transaction service cannot run against SQLite.`);
  }
  if (env.DATABASE_URL) return { connectionString: env.DATABASE_URL };
  return { host: env.SQL_HOST, user: env.SQL_USER, password: env.SQL_PASSWORD, database: env.SQL_DB_NAME };
}
