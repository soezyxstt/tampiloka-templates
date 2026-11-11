import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { storageEnv } from './env.mjs';
process.chdir(fileURLToPath(new URL('..', import.meta.url)));
const wrangler = fileURLToPath(new URL('./bin/wrangler.js', import.meta.resolve('wrangler/package.json')));
const vite = fileURLToPath(new URL('./bin/vite.js', import.meta.resolve('vite/package.json')));
const env = await storageEnv(new URL('../', import.meta.url));
const provider = env.DATABASE_PROVIDER;
const migrated = provider === 'd1'
  ? spawnSync(process.execPath, [wrangler, 'd1', 'migrations', 'apply', 'DB', '--local', '--persist-to', '.data'], { stdio: 'inherit' })
  : spawnSync(process.execPath, [fileURLToPath(new URL('./migrate.mjs', import.meta.url))], { stdio: 'inherit' });
if (migrated.status !== 0) process.exit(migrated.status || 1);
const children = [
  spawn(process.execPath, [wrangler, 'dev', '--local', '--port', '8787', '--persist-to', '.data', '--var', 'DEMO_MODE:true'], { stdio: 'inherit' }),
  spawn(process.execPath, [vite, '--host', '127.0.0.1', '--port', '5174'], { stdio: 'inherit' }),
];
let closing = false;
function stop(code = 0) { if (closing) return; closing = true; for (const child of children) child.kill('SIGTERM'); setTimeout(() => process.exit(code), 150).unref(); }
for (const child of children) child.on('exit', code => { if (!closing) stop(code || 0); });
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => stop());
console.log('\nCommerce: http://127.0.0.1:5174 (API: http://127.0.0.1:8787)');
