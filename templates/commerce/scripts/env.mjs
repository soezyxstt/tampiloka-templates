import { readFile } from 'node:fs/promises';

export async function storageEnv(root, processEnv = process.env) {
  const vars = {};
  try {
    const source = await readFile(new URL('.dev.vars', root), 'utf8');
    for (const line of source.split(/\r?\n/)) {
      const match = line.match(/^\s*([A-Z][A-Z0-9_]*)\s*=\s*(.*?)\s*$/);
      if (match) vars[match[1]] = match[2].replace(/^(["'])(.*)\1$/, '$2');
    }
  } catch (error) { if (error.code !== 'ENOENT') throw error; }
  let selected = {};
  try { selected = JSON.parse(await readFile(new URL('config/storage.json', root), 'utf8')); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
  const env = { ...vars, ...processEnv };
  env.DATABASE_PROVIDER ||= selected.database || 'turso';
  return env;
}
