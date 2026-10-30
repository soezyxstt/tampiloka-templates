#!/usr/bin/env node
/** Run layout, preset and lifecycle browser gates against the built artifact. */
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { access } from 'node:fs/promises';
import { once } from 'node:events';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
await access(join(root, 'dist-demos/index.html')).catch(() => { throw new Error('Build the demos first: npm run demos:build'); });
const socket = createServer();
socket.listen(0, '127.0.0.1');
await once(socket, 'listening');
const port = socket.address().port;
await new Promise((resolve, reject) => socket.close(error => error ? reject(error) : resolve()));
const base = `http://127.0.0.1:${port}`;
const env = { ...process.env, CAFE_DEMO_BASE_URL: base, CAFE_DEMO_BASE_DOMAIN: '' };
const preview = spawn(process.execPath, [join(root, 'node_modules/vite/bin/vite.js'), 'preview', '--config', 'demos/vite.config.mts', '--host', '127.0.0.1', '--port', String(port), '--strictPort'], { cwd: root, env, stdio: 'inherit' });
let currentTest;
let interrupted = false;
const stop = () => { interrupted = true; currentTest?.kill('SIGTERM'); preview.kill('SIGTERM'); };
process.once('SIGINT', stop);
process.once('SIGTERM', stop);
try {
  const deadline = Date.now() + 30000;
  let ready = false;
  while (Date.now() < deadline && !interrupted && preview.exitCode === null) {
    try { ready = (await fetch(base, { signal: AbortSignal.timeout(1000) })).ok; } catch { /* Preview is still starting. */ }
    if (ready) break;
    await new Promise(resolve => setTimeout(resolve, 150));
  }
  if (!ready) throw new Error('The static demo preview did not become available.');
  const failures = [];
  for (const script of ['tests/demo-navigation.test.mjs', 'tests/demos-explorer.mjs', 'tests/demos-motion.mjs', 'tests/demos-compact-ui.mjs', 'tests/demos-staff-layout.mjs', 'tests/demos-browser.mjs', 'tests/demos-lifecycle.mjs', 'tests/language-browser.mjs']) {
    if (interrupted) throw new Error('Browser verification interrupted.');
    currentTest = spawn(process.execPath, ['--experimental-strip-types', script], { cwd: root, env, stdio: 'inherit' });
    const [code, signal] = await once(currentTest, 'exit');
    currentTest = undefined;
    if (code !== 0) failures.push(`${script} failed (${signal || code}).`);
  }
  if (failures.length) throw new Error(failures.join("\n"));
} finally {
  currentTest?.kill('SIGTERM');
  preview.kill('SIGTERM');
  process.removeListener('SIGINT', stop);
  process.removeListener('SIGTERM', stop);
}

