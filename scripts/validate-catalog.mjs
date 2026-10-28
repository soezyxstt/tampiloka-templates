#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { validateCatalogContent } from '../src/catalog/schema.ts';

try {
  const menu = JSON.parse(await readFile(resolve('content/menu.json'), 'utf8'));
  const tables = JSON.parse(await readFile(resolve('content/tables.json'), 'utf8'));
  const valid = validateCatalogContent(menu, tables);
  console.log(`Catalog valid: ${valid.menu.items.length} items, ${valid.menu.categories.length} categories, ${valid.tables.tables.length} tables. sample=${valid.menu.sample}.`);
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
