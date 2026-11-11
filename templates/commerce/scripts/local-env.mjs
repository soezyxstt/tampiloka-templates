import { readFileSync } from 'node:fs';
import { parseEnv } from 'node:util';

const keys = ['DEMO_MODE', 'COMMERCE_LEVEL', 'ALLOWED_ORIGIN', 'STAFF_OWNER_PASSWORD', 'STAFF_OPERATIONS_PASSWORD', 'STAFF_VIEWER_PASSWORD', 'MIDTRANS_ENVIRONMENT', 'MIDTRANS_SERVER_KEY', 'RESEND_API_KEY', 'MEMBER_EMAIL_FROM', 'OBJECT_STORAGE_PROVIDER', 'S3_ENDPOINT', 'S3_BUCKET', 'S3_ACCESS_KEY_ID', 'S3_SECRET_ACCESS_KEY', 'S3_REGION', 'S3_PUBLIC_URL', 'UPLOADTHING_TOKEN'];

// Local overrides take precedence over shell values, as with Wrangler's .dev.vars.
export function localEnv(db, processEnv = process.env, path = '.dev.vars') {
  let local = {};
  try { local = parseEnv(readFileSync(path, 'utf8')); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
  const values = { DEMO_MODE: 'false' };
  for (const key of keys) {
    if (processEnv[key] !== undefined) values[key] = processEnv[key];
    if (local[key] !== undefined) values[key] = local[key];
  }
  return { ...values, DB: db };
}
