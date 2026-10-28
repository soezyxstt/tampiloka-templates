import { defineConfig } from 'vite';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const harness = dirname(fileURLToPath(import.meta.url));
const root = resolve(harness, '../..');
const database = resolve(root, 'src/db/index.ts');
export default defineConfig({
  root: harness,
  publicDir: false,
  plugins: [{
    name: 'browser-demo-database', enforce: 'pre',
    resolveId(source, importer) {
      if (importer && source.startsWith('.') && resolve(dirname(importer.split('?')[0]), source) === database) return resolve(root, 'src/demo-runtime/worker-database.ts');
      return null;
    },
  }],
  resolve: { alias: [{ find: /^node:crypto$/, replacement: resolve(root, 'src/demo-runtime/crypto.ts') }] },
  define: { 'process.env.CAFE_DEMO_DB': JSON.stringify('1'), 'process.env.CAFE_DEMO_EMPTY': JSON.stringify('0') },
  optimizeDeps: { exclude: ['@electric-sql/pglite', '@electric-sql/pglite/worker'] },
  worker: { format: 'es', plugins: () => [{
    name: 'browser-demo-worker-database', enforce: 'pre',
    resolveId(source, importer) {
      if (importer && source.startsWith('.') && resolve(dirname(importer.split('?')[0]), source) === database) return resolve(root, 'src/demo-runtime/worker-database.ts');
      return null;
    },
  }] },
  build: { target: 'es2022' },
  server: { host: '127.0.0.1', port: 3013, strictPort: true, fs: { allow: [root] } },
});
