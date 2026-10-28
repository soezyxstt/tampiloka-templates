import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { config } from 'dotenv';
import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { pushSchema } from 'drizzle-kit/api';
import * as schema from '../src/db/schema.ts';
import { cafeConfig } from '../src/config/cafe.ts';

config({ path: '.env.local', quiet: true });
config({ quiet: true });

const dataDir = resolve(process.env.CAFE_DEMO_DATA_DIR || `.local/${cafeConfig.venue.outletSlug}/cafe-db`);
await mkdir(dataDir, { recursive: true });
const client = new PGlite(dataDir);
try {
  const database = drizzle(client);
  const migration = await pushSchema(schema, database);
  if (migration.hasDataLoss) {
    throw new Error('Demo schema update would remove data. Use a new CAFE_DEMO_DATA_DIR.');
  }
  await migration.apply();
  console.log(`Demo database ready for ${cafeConfig.brand.name}: ${dataDir}`);
} finally {
  await client.close();
}
