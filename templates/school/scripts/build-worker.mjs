import { build } from 'esbuild';
// Wrangler resolves the server-only provider SDKs with its Node compatibility layer.
await build({ entryPoints: ['worker/index.ts'], bundle: true, format: 'esm', target: 'es2022', platform: 'browser', external: ['@tampiloka/storage'], outfile: 'dist-worker/index.js' });
