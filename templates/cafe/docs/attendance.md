# Attendance plugin

Cafe/Resto and Operations can opt into the server-only attendance API. It is disabled until the host configures its server factory; an unconfigured route returns `ATTENDANCE_NOT_CONFIGURED`. A staff UI is available for a configured host; payroll and demo PIN authentication are not provided. Existing transaction gates remain independent. Location and a selfie do not establish identity; optional face/liveness requirements fail closed without an injected provider.

Apply `src/plugins/attendance/migrations/0001_attendance.sql` and `0002_evidence.sql`, then `0003_retention_schedule.sql` and `0004_canceled.sql` using the deployment's PostgreSQL migration system, or use the Cafe schema push for a new database, not both. SQLite and D1 are unsupported for attendance. Restrict database roles and enforce append-only audit privileges for events and corrections. The host must configure the factory in every server deployment, using real session verification and trusted current outlet membership, supervisor permissions and policy. Do not use demo PINs, request-supplied staff IDs or client-supplied policies. For example, edit `src/plugins/attendance/server-config.ts` (replace the host imports with real server-only adapters):

```ts
import { db } from '@/src/db/index';
import { createAttendanceRuntime } from '@/src/plugins/attendance/runtime';
import { realSessionAdapter, loadTrustedOutletPolicy, resolveTrustedUniqueOutlet } from '@/src/server/attendance-adapters';
import { createS3EvidenceStore } from '@/src/plugins/attendance/storage/index.mjs';
export function configureAttendance() {
 return createAttendanceRuntime({
  database: db,
  store: createS3EvidenceStore({ endpoint: process.env.ATTENDANCE_S3_ENDPOINT!, region: process.env.ATTENDANCE_S3_REGION!, bucket: process.env.ATTENDANCE_S3_BUCKET!, accessKeyId: process.env.ATTENDANCE_S3_ACCESS_KEY_ID!, secretAccessKey: process.env.ATTENDANCE_S3_SECRET_ACCESS_KEY!, sessionToken: process.env.ATTENDANCE_S3_SESSION_TOKEN, retentionSeconds: Number(process.env.ATTENDANCE_RETENTION_SECONDS) }),
  principal: realSessionAdapter, policy: loadTrustedOutletPolicy,
  resolveOutlet: resolveTrustedUniqueOutlet,
  allowedOrigins: ['https://your-cafe.example'],
});
}
```

The route and a trusted scheduled job use the same lazy accessor per server instance:

```ts
import { getAttendanceRuntime } from '@/src/plugins/attendance/accessor';
const runtime = await getAttendanceRuntime();
if (!runtime) throw new Error('Attendance is not configured');
await runtime.retain();
```

Attendance requires PostgreSQL or the explicitly selected local PGlite demo database; generated Turso and D1 selections are rejected at initialization. Private S3 evidence is configured separately above: the generated UploadThing selection is not inherited. Schedule retention frequently enough to drain the backlog: each run processes at most 25 newly expired items and 25 due retries or tombstones; retries and tombstones are revisited after at least a minute, indefinitely, to reconcile late writes. Monitor backlog and failures.

Do not expose the maintenance call as an unauthenticated HTTP endpoint. Keep provider credentials server-side and configure private bucket access and backups. Every failed physical deletion is recorded for a subsequent job retry; deleted metadata records the actor or retention job and time. Pending reservations permit cleanup after an interrupted upload. Monitor retries and provider lifecycle rules, including backups. See [storage](attendance-storage.md) for operational constraints.

All mutations require an exact configured `Origin` and reject cross-site fetches. Authenticate every request. `POST /api/attendance?resource=evidence&outletId=...` accepts raw JPEG, PNG or WebP bytes (maximum 5 MiB); it returns an opaque `evidenceKey`. Images are decoded and re-encoded, stripping metadata. `GET` and `DELETE` on the same resource with `id=<evidenceKey>` require the owner or an outlet supervisor; reads are private and no-store. The server retains scoped reference metadata and never accepts a client reference object or object URL. Uploads are valid for claim for ten minutes by default. A claim and attendance event commit atomically; an evidence item cannot be used for another event.

`POST /api/attendance` accepts JSON `action: "record"`, `outletId`, `kind: "IN" | "OUT"`, `idempotencyKey` (16–128 letters, digits, `_` or `-`), `evidenceKey`, and `location: { latitude, longitude, accuracyMeters, capturedAt }`. The server determines identity, attendance time and outlet policy. Retain the idempotency key and identical payload for a retry. Location and evidence are revalidated before replay, so delayed retries can fail. Retain the exact command until a committed event or terminal finalization confirms the outcome; a null status alone is not terminal. `action: "correct"` takes `outletId`, `eventId`, ISO `correctedAt` and a reason, and appends a supervisor correction without changing the original. The correction does not recalculate reports or implement payroll.

`runtime.test.ts` is an executable PGlite and private filesystem composition example using injected test-only authentication; never deploy that adapter. Production requires real PostgreSQL concurrency testing, a real auth adapter, private S3 provider validation, operational retention and privacy policy, and full Cafe regression before use.

Local PostgreSQL and optional S3 transport verification instructions and limits are in [attendance-storage.md](attendance-storage.md). Apply migrations once in order with version tracking; direct replay of 0001/0002 is not supported.

## Staff interface

The dedicated route `/staff/<tenant-slug>/<outlet-slug>/attendance` discovers access through the server's trusted `resolveOutlet` adapter. The canonical outlet ID from that response is used for all attendance requests. Missing, ambiguous, mismatched or unauthorized mappings fail closed. Capture and supervisor review are independent; a supervisor need not be an employee. The public demo has no attendance link. The host must supply production authentication, trusted outlet mapping, membership, origin and policy; demo PINs are not identity. See [the UI contract](attendance-ui-contract.md).

The interface requests one location fix and opens the front camera only on request; tracks stop on close, capture and unmount. It retains the exact pending command and operation ID in session storage for reconciliation, including location and an opaque evidence reference, but not image bytes. Clear session storage according to the host's shared-device privacy policy. If a retry is uncertain or its evidence or location expires, recovery sends the exact pending payload to terminal finalization. A committed result is shown as saved; a durable cancellation clears the capture and requires a new photo and location. An unavailable or ambiguous finalization retains the pending payload; a null status lookup does not prove that an earlier request cannot still commit. Optional biometric checks fail closed without a provider.

The repository-only isolated browser fixture runs with `pnpm --filter @tampiloka/template-cafe test:attendance:browser`. The serial entry also runs the bilingual message and loading matrix. It mounts the real route handler and runtime on loopback using PGlite, private temporary filesystem storage, signed test-only cookies and a trusted test mapping. It does not test production authentication, PostgreSQL, S3 or deployment. The fixture is not imported by production code.

Canceled operation receipts must remain durable indefinitely while a delayed record request can be replayed. Evidence retention does not remove them; protect these receipts against deletion and alteration alongside the immutable audit. The associated evidence reservation prevents reuse under a different key.
