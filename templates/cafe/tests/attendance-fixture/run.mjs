import { spawn } from 'node:child_process';
import { once } from 'node:events';
const server = spawn(process.execPath, ['--experimental-strip-types', 'tests/attendance-fixture/server.mjs'], { stdio: ['ignore', 'pipe', 'inherit'] });
try {
 await new Promise((resolve, reject) => { const timer = setTimeout(() => reject(Error('fixture startup timed out')), 120000); server.stdout.on('data', data => { process.stdout.write(data); if (String(data).includes('fixture ready')) { clearTimeout(timer); resolve(); } }); server.once('exit', code => { clearTimeout(timer); reject(Error(`fixture exited ${code}`)); }); });
 const test = spawn(process.execPath, ['tests/attendance-fixture/browser.mjs'], { stdio: 'inherit', env: { ...process.env, INSTABOX_HEADLESS: '1' } });
 const [code] = await once(test, 'exit'); if (code !== 0) process.exitCode = code || 1; else { const publicTest = spawn(process.execPath, ['tests/attendance-fixture/public-demo.mjs'], { stdio: 'inherit', env: { ...process.env, INSTABOX_HEADLESS: '1' } }); const [publicCode] = await once(publicTest, 'exit'); if (publicCode !== 0) process.exitCode = publicCode || 1; }
} finally { server.kill('SIGTERM'); await once(server, 'exit'); }

if (!process.exitCode) {
 const matrix = spawn(process.execPath, ['tests/attendance-fixture/language-matrix.mjs'], { stdio: 'inherit', env: { ...process.env, INSTABOX_HEADLESS: '1' } });
 const [code] = await once(matrix, 'exit'); if (code !== 0) process.exitCode = code || 1;
}
