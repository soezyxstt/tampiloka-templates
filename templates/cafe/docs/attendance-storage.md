# Attendance private evidence storage

Server-only private storage for the opt-in Cafe attendance plugin (including the Operations preset). The registered attendance runtime connects it to authenticated routes and exposes a server-job retention method. Do not import it into client bundles or expose storage credentials, keys, or direct object URLs.

## Backend integration contract

The direct production dependency `sharp@0.35.5` is included in `@tampiloka/template-cafe`. The adapter decodes and re-encodes JPEG, PNG, and WebP using sharp, strips metadata, and enforces pixel and byte limits; it fails closed if sharp is unavailable. No new S3 SDK is required. The registered runtime enforces scoped access and records deletion attempts; the host owns authentication, authorization policy, retention scheduling, and operational monitoring. Never pass an untrusted client-supplied evidence reference: load the reference and scope from an authorized attendance record in PostgreSQL. Scope values must be stable opaque IDs, not names or email addresses.

```ts
import { createS3EvidenceStore } from '@/src/plugins/attendance/storage/index.mjs';
const store = createS3EvidenceStore({ endpoint, region, bucket, accessKeyId, secretAccessKey, retentionSeconds: 30 * 86400 });
// After authenticating and authorizing the staff member and outlet:
const ref = await store.put({ tenantId, outletId, employeeId }, bytes);
// Persist ref in the attendance record; compensate with delete if the DB write fails.
// Later: authenticate, authorize and load BOTH scope and ref from that record.
const image = await store.read(scope, ref); // { bytes, contentType }; stream only through an authorized no-store response
await store.delete(scope, ref); // retention job or authorized deletion
```

`put` returns `{ id, contentType, size, createdAt, expiresAt }`; these are database metadata, not an access grant. `read` and `delete` derive the key from the supplied scope and random ID; they never accept a key or URL. Reads fail at expiry, but physical deletion requires a backend retention job using persisted scope/reference, including backups and failed-deletion retry/audit. Deletes remain possible after expiry. Store metadata transactionally where possible; object writes and SQL cannot share a transaction. Do not log image bytes, authorization headers, credentials, or provider error bodies.

## Configuration and operations

Backend should map server-only secrets (for example `ATTENDANCE_S3_ENDPOINT`, `ATTENDANCE_S3_REGION`, `ATTENDANCE_S3_BUCKET`, `ATTENDANCE_S3_ACCESS_KEY_ID`, `ATTENDANCE_S3_SECRET_ACCESS_KEY`, optional `ATTENDANCE_S3_SESSION_TOKEN`, and `ATTENDANCE_RETENTION_SECONDS`) to constructor options. Endpoint is an HTTPS origin or base path; HTTP is permitted only for loopback development. AWS can use `https://s3.<region>.amazonaws.com`, R2 its account endpoint and region `auto`, and MinIO a private HTTPS endpoint. The adapter uses path-style requests and SigV4. Configure a private bucket, block public access, restrict IAM to this bucket/prefix, enforce TLS and encryption at rest, and configure provider lifecycle expiry as a defense in depth. Ensure endpoint, bucket, region, credentials, and retention are provisioned and validated by the server. Credentials never reach a browser. No presigned or permanent URLs are generated.

`createLocalEvidenceStore({ directory, retentionSeconds })` is for a single-process local/demo runtime only, using private files outside public/static directories; it is not a multi-instance production store. Protect its directory and backups and run the same retention job. The adapter creates files with restrictive permissions but cannot secure an unsafe parent directory or hosting configuration.

A local SeaweedFS S3 endpoint has been tested; AWS, R2, and MinIO have not been verified live. Operators must test their own endpoint, policies, clocks, deletion and recovery before production. Optional face/liveness providers are separate from this storage contract.

## Opt-in local engine and transport checks

`src/plugins/attendance/engine.integration.test.ts` exercises a real PostgreSQL connection when `ATTENDANCE_TEST_DATABASE_URL` points to a disposable local database. It creates a unique schema, applies migrations 0001–0004 in order with a test-only version table in a transaction, repeats the runner and checks existing records survive, then drops that schema. This runner is a verification fixture, not a production migration service or concurrency-safe deployment tool. Use a proper version-tracked deployment system; 0001 and 0002 cannot be directly replayed. The fixture cookie and policy are strictly test identities, not production authentication.

For a private, already-created disposable local S3-compatible bucket, set `ATTENDANCE_TEST_S3_ENDPOINT`, `ATTENDANCE_TEST_S3_BUCKET`, `ATTENDANCE_TEST_S3_REGION`, `ATTENDANCE_TEST_S3_ACCESS_KEY`, and `ATTENDANCE_TEST_S3_SECRET_KEY` in the environment and run `pnpm --filter @tampiloka/template-cafe exec node --experimental-strip-types --test src/plugins/attendance/engine.integration.test.ts`. The opt-in test checks upload, read, delete, metadata stripping, scope isolation, anonymous denial and rejection of a wrong signing secret. When both endpoints are configured, it also exercises PostgreSQL retention with delayed network writes, a deletion failure and retry, and a backlog. Do not point these tests at real data. Tests explicitly skip without their respective endpoint variables. Local PostgreSQL and local S3 results do not establish hosted provider configuration, TLS, IAM, or production authentication.


For a self-contained local run, install Docker, `uv`, Python 3 and the locked workspace dependencies, then run `templates/cafe/src/plugins/attendance/local-transport.sh` from the repository. It pulls `postgres:17-alpine` and `chrislusf/seaweedfs:3.80`, installs boto3 1.44.0 in a temporary directory, generates disposable credentials and creates a private test bucket. It binds only loopback ports 25439 and 28333, creates uniquely named resource-limited containers, and removes those containers and its temporary directory on exit. Free those ports first. It applies the four migrations through the fixture's version table and drops its unique schema. The database and bucket are disposable; this is not a production migration procedure. The local daemon and HTTP transport do not establish hosted IAM, TLS, production scheduling or provider interoperability.
