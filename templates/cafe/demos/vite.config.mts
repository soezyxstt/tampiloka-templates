import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { dirname, isAbsolute, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { cpSync } from 'node:fs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
function browserAliases(): Plugin {
  const replacements = new Map([
    [resolve(root, 'src/db/index.ts'), resolve(root, 'src/demo-runtime/worker-database.ts')],
    [resolve(root, 'src/config/cafe.ts'), resolve(root, 'demos/config.ts')],
    [resolve(root, 'src/config/cafe'), resolve(root, 'demos/config.ts')],
  ]);
  return { name: 'cafe-browser-runtime', enforce: 'pre', resolveId(source, importer) {
    if (source === 'node:crypto') return resolve(root, 'src/demo-runtime/crypto.ts');
    if (source === 'next/image') return resolve(root, 'demos/image.tsx');
    const candidate = source.startsWith('@/') ? resolve(root, source.slice(2)) : source.startsWith('.') && importer ? resolve(dirname(importer.split('?')[0]), source) : isAbsolute(source) ? resolve(source.split('?')[0]) : source;
    return replacements.get(candidate) || null;
  } };
}

export default defineConfig({
  root: resolve(root, 'demos'),
  publicDir: resolve(root, 'public'),
  plugins: [browserAliases(), react(), { name: 'pages-output', closeBundle() { cpSync(resolve(root, 'demos/public'), resolve(root, 'dist-demos'), { recursive: true }); } }],
  resolve: { alias: { '@': root } },
  define: { 'process.env.CAFE_DEMO_DB': '"1"', 'process.env.CAFE_DEMO_EMPTY': '"0"' },
  optimizeDeps: { exclude: ['@electric-sql/pglite', '@electric-sql/pglite/worker'] },
  worker: { format: 'es', plugins: () => [browserAliases()] },
  build: { outDir: resolve(root, 'dist-demos'), emptyOutDir: true, assetsInlineLimit: 0, target: 'es2022' },
  server: { host: '127.0.0.1', port: 4173 },
  preview: { host: '127.0.0.1', port: 4173 },
});
