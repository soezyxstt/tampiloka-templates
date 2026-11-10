import { spawn } from 'node:child_process';
import { mkdir, access, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../', import.meta.url));
const demo = process.argv.includes('--demo');
const children = [];
function run(args) {
  const child = spawn('pnpm', args, { cwd: root, stdio: 'inherit', env: { ...process.env, WRANGLER_SEND_METRICS: 'false' } });
  children.push(child);
  child.on('error', error => { console.error(error); close(); process.exitCode = 1; });
  child.on('exit', code => { if (code && !closing) { close(); process.exitCode = code; } });
}
let closing = false;
function close() { closing = true; for (const child of children) child.kill('SIGTERM'); }
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => { close(); process.exit(); });
await mkdir(new URL('../dist/', import.meta.url), { recursive: true });
try { await access(new URL('../dist/index.html', import.meta.url)); }
catch { await writeFile(new URL('../dist/index.html', import.meta.url), '<p>Use Vite on port 5177.</p>'); }
run(['exec', 'wrangler', 'dev', '--local', '--config', demo ? 'wrangler.demo.jsonc' : 'wrangler.jsonc', '--persist-to', demo ? '.wrangler/state/demo' : '.wrangler/state/client', '--port', '8788', '--ip', '127.0.0.1']);
run(['exec', 'vite', '--mode', demo ? 'demo' : 'development']);
