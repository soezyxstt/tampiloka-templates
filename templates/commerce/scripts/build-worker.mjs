import { build } from 'esbuild';
import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
process.chdir(fileURLToPath(new URL('..', import.meta.url)));
await mkdir('dist-worker', { recursive: true });
await build({ entryPoints: ['worker/index.ts'], outfile: 'dist-worker/index.js', bundle: true,
  format: 'esm', platform: 'browser', target: 'es2022', minify: true,
  // Wrangler resolves the server-only provider SDKs with its Node compatibility
  // layer when it bundles the Worker for deployment.
  sourcemap: false, conditions: ['workerd', 'worker', 'browser'], external: ['cloudflare:*', '@tampiloka/storage'] });
console.log('Worker built: dist-worker/index.js');
