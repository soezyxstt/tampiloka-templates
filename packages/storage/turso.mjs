import { createClient } from '@libsql/client/http';

export function tursoClient({ TURSO_DATABASE_URL, TURSO_AUTH_TOKEN }) {
  if (!TURSO_DATABASE_URL || !TURSO_AUTH_TOKEN) throw new Error('Turso database credentials are missing.');
  const url = new URL(TURSO_DATABASE_URL.replace(/^libsql:/, 'https:'));
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash) {
    throw new Error('Expected a secure Turso database URL.');
  }
  return createClient({ url: url.href, authToken: TURSO_AUTH_TOKEN });
}

function result({ columns, rows, rowsAffected }) {
  return {
    results: rows.map(row => Object.fromEntries(columns.map((name, i) => [name, row[i]]))),
    meta: { changes: rowsAffected },
    success: true,
  };
}

// Bind once per Worker request or scheduled task. Every batch runs on one connection.
export function databaseFromClient(client) {
  const queries = new WeakMap();
  function prepare(sql, args = []) {
    const query = { sql, args };
    const execute = async () => result(await client.execute(query));
    const statement = {
      bind: (...values) => prepare(sql, values),
      run: execute,
      all: execute,
      async first(column) {
        const row = (await execute()).results[0];
        return (column === undefined ? row : row?.[column]) ?? null;
      },
    };
    queries.set(statement, query);
    return statement;
  }
  return {
    prepare,
    async batch(statements) {
      if (!statements.length) return [];
      const bound = statements.map(statement => {
        const query = queries.get(statement);
        if (!query) throw new TypeError('Statement belongs to another database.');
        return query;
      });
      return (await client.batch(bound, 'write')).map(result);
    },
  };
}

export function createTursoDatabase(bindings) {
  return databaseFromClient(tursoClient(bindings));
}
