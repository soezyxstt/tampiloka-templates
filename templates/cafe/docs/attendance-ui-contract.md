# Attendance UI API contract

The mounted `/api/attendance` route is disabled until a server runtime supplies production authentication, trusted outlet policy, private evidence storage and allowed origins. Demo PINs are not authentication. All responses are `Cache-Control: no-store`; mutating requests require an allowed Origin and reject cross-site fetches. Times are ISO UTC; business dates use the trusted outlet timezone and cutoff.

Authenticated GET requests use `outletId` and `resource` query parameters:

- `status`: returns `serverTime`, `businessDate`, `policy` (timezone, cutoff, location accuracy/age and biometric requirements), `capabilities` (capture, review), `current` (latest original event with its effective correction), and optionally `operation` when `idempotencyKey` is supplied. A null operation means no committed event was found at that instant. After an uncertain response retain the original operation ID and exact payload; reconcile and retry with that same ID, never create a new ID for the same operation.
- `history`: own events only; accepts `limit` (1–50, default 20) and opaque `cursor`.
- `review`: supervisor only, scoped to the authorized outlet; accepts the same pagination and optional `staffId`. A staff filter requires a trusted host membership adapter and is denied if membership cannot be established.

Lists return `{ events, nextCursor }` ordered by original occurrence time descending, then event ID descending. Each event includes immutable original time, business date, shift and ID; `effectiveAt` reflects the latest correction, while `corrections` contains correction IDs, timestamps, reason and supervisor. Evidence is either null or an authenticated relative read reference, never a storage key or permanent URL. Evidence may expire between listing and reading. Pagination is a live view, not a snapshot.

Existing POST `record` and `correct` commands remain unchanged. Invalid pagination is `INVALID_REQUEST` (400); unauthorized outlet or review/filter is `FORBIDDEN` (403); unauthenticated is 401; unavailable or unconfigured runtime is 503. Other command errors retain their existing codes. Compose tests with PGlite/PostgreSQL, a trusted principal/policy adapter, private test store and explicit allowed origins; never enable public Pages by default.

Response shapes (all fields present):

```ts
type Event = { id: string; staffId: string; kind: string; occurredAt: string; businessDate: string; shiftId: string; sequence: number; effectiveAt: string; corrections: { id: string; supervisorId: string; reason: string; correctedAt: string; recordedAt: string; sequence: number }[]; correctionsTruncated: boolean; evidence: { readUrl: string } | null };
type Status = { serverTime: string; businessDate: string; policy: { timezone: string; businessCutoff: string; maxAccuracyMeters: number; maxLocationAgeMs: number; requireFace: boolean; requireLiveness: boolean }; capabilities: { capture: boolean; review: boolean }; current: Event | null; operation: Event | null };
type Page = { events: Event[]; nextCursor: string | null };
```

Corrections are newest first, limited to 50 per event, with `correctionsTruncated` indicating older entries. `current.kind === 'IN'` indicates an open shift; corrections change effective time, not shift transitions. Evidence `readUrl` is relative to the mounted API URL.

`capabilities.capture` is false when the outlet requires biometrics and no provider is configured. Capture can still fail due to location, evidence or provider rejection. Replays currently revalidate location and evidence; an expired original payload can fail even with the same key, so reconcile via status before taking further action.

## Route capability discovery

Before using canonical outlet APIs, call `GET /api/attendance?resource=capabilities&tenantSlug=<route tenant slug>&outletSlug=<route outlet slug>`. Both slugs must occur exactly once and be nonempty. The host's server-only `resolveOutlet` adapter maps the pair to zero or more `{ tenantId, outletId }` records. It must resolve the exact pair from trusted host data, never infer an outlet from a browser role, PIN, or first membership. Configure it alongside the runtime; existing canonical APIs do not require it. A host may use a unique database lookup or a static fixture such as `async (tenantSlug, outletSlug) => tenantSlug === 'demo' && outletSlug === 'central' ? [{ tenantId: 'tenant', outletId: 'outlet' }] : []`.

A unique mapping must match the authenticated principal's tenant, an employee or supervisor outlet membership, and the corresponding trusted outlet policy. Success returns:

```ts
type Capabilities = { tenantId: string; outletId: string; employee: boolean; supervisor: boolean; capabilities: { capture: boolean; review: boolean }; policy: { timezone: string; businessCutoff: string; maxAccuracyMeters: number; maxLocationAgeMs: number; requireFace: boolean; requireLiveness: boolean } };
```

Use the returned `outletId` in subsequent existing APIs. `capture` requires employee membership and any required biometric provider; `review` requires supervisor membership. Supervisor-only users can call `review` and `correct`, but cannot call employee `status`, `history`, upload evidence, or record punches. Do not infer permissions from the UI role. Policy excludes coordinates and radius.

Unknown mappings, tenant/membership mismatch, and invalid or missing policy return `FORBIDDEN` (403) without outlet details. Missing resolver returns `OUTLET_RESOLVER_NOT_CONFIGURED` (503); duplicate or malformed resolver results return `OUTLET_MAPPING_INVALID` (503): the host must fix its outlet mapping. Malformed query returns `INVALID_REQUEST` (400), unauthenticated requests return `UNAUTHENTICATED` (401), and a disabled runtime returns `ATTENDANCE_NOT_CONFIGURED` (503). A provider required by policy but not configured sets `capture` false; it does not prevent review.

## Finalizing an uncertain record

`POST /api/attendance` with the usual authenticated session and Origin protection accepts `{ action: "finalize", outletId, kind, idempotencyKey, location, evidenceKey }`, containing the exact original record payload. The server derives tenant and staff from the session and computes the payload digest itself. It returns `{ outcome: "committed", event: { id, kind, occurredAt, businessDate, shiftId } }` or `{ outcome: "canceled" }`. Finalization is idempotent and serializes with record; a canceled key cannot subsequently commit. It works after location or evidence expiry. A changed payload for a known key yields `IDEMPOTENCY_CONFLICT` (409); a canceled record replay that passes preliminary capture validation yields `OPERATION_CANCELED` (409); expired location or evidence may be rejected earlier. Authorization, Origin and availability errors follow the existing command contract.

Only after receiving a successful finalization response may the UI clear an uncertain pending capture: show the committed event, or discard the canceled capture and start a new capture with a new key and evidence. An absent status result, failed finalization, timeout, or lost finalization response is not proof of cancellation; retain the exact payload and retry finalization. Canceled operation receipts are retained indefinitely while delayed requests can be replayed; evidence retention must not remove those receipts.

On reload, the employee UI checks `status` with `pendingEvidenceKey` before exposing a stored pending operation. The response field `pendingOwned` confirms that the evidence belongs to the authenticated employee and outlet, including expired evidence. An unverifiable operation remains stored and blocks new capture; it cannot be recovered through another employee session. Recovery remains available when capture is disabled by policy.
