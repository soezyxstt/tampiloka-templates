import { build } from 'esbuild';
await build({ entryPoints: ['worker/index.ts'], bundle: true, format: 'esm', target: 'es2022', platform: 'browser', outfile: 'dist-worker/index.js' });
