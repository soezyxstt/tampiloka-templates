// The checked-in migration format uses $$ for PL/pgSQL bodies. Semicolons
// inside those bodies do not terminate a migration statement.
export function splitPostgresMigration(sql, name = 'migration') {
  const parsed = sql.split(/(\$\$)/).reduce((state, part) => {
    if (part === '$$') { state.current += part; state.quoted = !state.quoted; }
    else if (state.quoted) state.current += part;
    else { const chunks = part.split(';'); state.current += chunks.shift(); for (const chunk of chunks) { if (state.current.trim()) state.statements.push(state.current.trim()); state.current = chunk; } }
    return state;
  }, { statements: [], current: '', quoted: false });
  if (parsed.quoted || parsed.current.trim()) throw new Error(`Unterminated SQL in ${name}`);
  return parsed.statements;
}
