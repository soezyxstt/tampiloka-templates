// The checked-in migrations end each statement on its own line. A trigger may
// have internal semicolons and may put BEGIN and END on that same final line.
export function parseSQLiteMigration(sql, file = 'migration') {
  const statements = [];
  let current = '', trigger = false;
  for (const line of sql.split('\n')) {
    if (!current.trim() && /^CREATE TRIGGER\b/i.test(line.trim())) trigger = true;
    current += line + '\n';
    if ((!trigger && /;\s*$/.test(line)) || (trigger && /(?:^\s*END;|^\s*BEGIN\s+SELECT\s+.*;\s*END;)\s*$/i.test(line))) {
      if (!/^\s*PRAGMA\s/i.test(current)) statements.push(current.trim());
      current = ''; trigger = false;
    }
  }
  if (current.trim()) throw new Error(`Incomplete SQL in ${file}`);
  return statements;
}
