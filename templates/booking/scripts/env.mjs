import { readFile } from 'node:fs/promises';

// Wrangler's local secrets file is also used by migration scripts. Explicit
// process environment values always take precedence.
export async function localEnv(root, processEnv = process.env) {
  let vars = {};
  try {
    const contents = await readFile(new URL('.dev.vars', root), 'utf8');
    for (const line of contents.split(/\r?\n/)) {
      const match = line.match(/^\s*([A-Z][A-Z0-9_]*)\s*=\s*(.*?)\s*$/);
      if (match) vars[match[1]] = match[2].replace(/^(["'])(.*)\1$/, '$2');
    }
  } catch (error) { if (error.code !== 'ENOENT') throw error; }
  return { ...vars, ...processEnv };
}
