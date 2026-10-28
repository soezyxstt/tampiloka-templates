import { defineConfig } from "eslint/config";
import next from "eslint-config-next";

// The Next preset parses .ts/.tsx as TypeScript; include Node's module extensions.
export default defineConfig(next.map((config) => config.name === 'next/typescript'
  ? { ...config, files: ['**/*.{ts,tsx,mts,cts}'] }
  : config));
