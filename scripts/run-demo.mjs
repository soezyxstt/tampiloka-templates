#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const env = { ...process.env, CAFE_DEMO_DB: '1' };

function run(args) {
  return new Promise((resolveExit, reject) => {
    const child = spawn(process.execPath, args, { cwd: root, env, stdio: 'inherit' });
    const interrupt = () => child.kill('SIGINT');
    const terminate = () => child.kill('SIGTERM');
    process.once('SIGINT', interrupt);
    process.once('SIGTERM', terminate);
    const cleanup = () => {
      process.removeListener('SIGINT', interrupt);
      process.removeListener('SIGTERM', terminate);
    };
    child.once('error', error => { cleanup(); reject(error); });
    child.once('close', (code, signal) => {
      cleanup();
      resolveExit(code ?? (signal === 'SIGINT' ? 130 : 143));
    });
  });
}

try {
  const prepared = await run(['--experimental-strip-types', resolve(root, 'scripts/prepare-demo-db.ts')]);
  if (prepared !== 0) process.exitCode = prepared;
  else process.exitCode = await run([require.resolve('next/dist/bin/next'), 'dev', '--hostname', '0.0.0.0', ...process.argv.slice(2)]);
} catch (error) {
  console.error(`Cannot start the demo: ${error.message}`);
  process.exitCode = 1;
}
