import { build } from 'esbuild';
import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
process.chdir(fileURLToPath(new URL('..', import.meta.url)));
await mkdir('dist-worker', { recursive: true });
await build({ entryPoints: ['worker/index.ts'], outfile: 'dist-worker/index.js', bundle: true,
  format: 'esm', platform: 'browser', target: 'es2022', minify: true,
  sourcemap: false, conditions: ['workerd', 'worker', 'browser'], external: ['cloudflare:*'] });
console.log('Worker built: dist-worker/index.js');
