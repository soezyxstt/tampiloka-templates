import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
process.chdir(fileURLToPath(new URL('..', import.meta.url)));
const wrangler = fileURLToPath(new URL('./bin/wrangler.js', import.meta.resolve('wrangler/package.json')));
const migrated = spawnSync(process.execPath, [wrangler, 'd1', 'migrations', 'apply', 'DB', '--local', '--persist-to', '.data'], { stdio: 'inherit' });
if (migrated.status !== 0) process.exit(migrated.status || 1);
const child = spawn(process.execPath, [wrangler, 'dev', '--local', '--port', '4174', '--persist-to', '.data', '--var', 'DEMO_MODE:true'], { stdio: 'inherit' });
child.on('exit', code => process.exit(code || 0));
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => child.kill(signal));
