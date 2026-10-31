import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const registry = JSON.parse(read('packages/registry/templates.json'));
const catalog = JSON.parse(read('packages/registry/public-demos.json'));
const scripts = JSON.parse(read('package.json')).scripts;
const readme = read('README.md').replace(/\r\n/g, '\n');
const table = readme.match(/\| Template ID \| Status CLI \| Entri katalog demo \|[\s\S]*?(?=\n\n)/)?.[0];
assert.ok(table, 'README template overview is missing');
const rows = [...table.matchAll(/^\| `([^`]+)` \| `([^`]+)` \| (.+) \|$/gm)];
assert.equal(rows.length, registry.templates.length, 'README must list every registry family once');
assert.equal(new Set(rows.map((row) => row[1])).size, rows.length, 'README has duplicate family rows');
for (const template of registry.templates) {
  const row = rows.find((entry) => entry[1] === template.id);
  assert.ok(row, `README missing ${template.id}`);
  assert.equal(row[2], template.status, `README status differs for ${template.id}`);
  const family = catalog.families.find((item) => item.template === template.id && item.visibility === 'public' && item.ready);
  const hasEntries = family?.entries.some((item) => item.visibility === 'public' && item.ready) ?? false;
  assert.match(row[3], hasEntries ? /^Ada:/ : /^Belum ada$/, `README catalog status differs for ${template.id}`);
}
const start = readme.split('## Mulai')[1]?.split('## Satu CLI')[0];
assert.ok(start, 'README first-run section is missing');
const commands = [...start.matchAll(/^pnpm ([\w:-]+)/gm)].map((match) => match[1]);
assert.ok(commands.includes('install') && commands.includes('tampiloka'), 'README first-run commands are incomplete');
for (const command of commands) assert.ok(command === 'install' || Object.hasOwn(scripts, command), `Unknown root command: pnpm ${command}`);
for (const template of registry.templates.filter((item) => item.status === 'available')) {
  assert.ok(commands.includes(`dev:${template.id}`), `README missing local demo command for ${template.id}`);
}
console.log('Documentation overview and first-run commands match registry, catalog metadata, and root scripts.');

