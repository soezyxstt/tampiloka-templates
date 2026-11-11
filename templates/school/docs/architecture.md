# Architecture

## Choice of CMS

The template uses React/Vite, a typed content registry and a Cloudflare Worker. Turso stores server state, identities and audit data. R2 stores media. The local adapter runs the same Web Request/Response handlers against SQLite. Shared UI core supplies Radix dialogs, controls, motion and the Tampiloka demo shell.

Payload was considered. It supports typed collections, access control, blocks and database adapters, including a documented D1 adapter. This is **not** a claim that Payload cannot run with D1. The choice here avoids introducing a second Next.js admin runtime into the existing Vite/Worker generation path and allows one small, purpose-built staff experience. The tradeoff is explicit: this focused CMS does not provide Payload's complete ecosystem, collaborative editor, relationship query API or automatic migration generation. Do not describe it as a drop-in replacement for Payload.

References reviewed: https://payloadcms.com/docs/database/sqlite and https://developers.cloudflare.com/d1/worker-api/d1-database/.

## Boundaries

`src/domain/types.ts` defines separate content, admissions, finance and academic models. A page editor cannot edit invoices, payment states or enrollment status. `service.ts` implements authorized commands, state transitions, validation and role-filtered snapshots. `worker/api.ts` owns HTTP, sessions, secrets, provider verification and uploads. External requests never run inside a retried transaction callback.

`src/cms/registry.ts` defines collections, blocks, custom form fields, modules, admin views and enrollment hooks. `content/presets.json` supplies genuinely different subject trees, outcomes, requirements, levels, certificates-as-information and admissions journeys. Preset data is replaceable, not business logic.

## Persistence and concurrency

A SQLite row stores a versioned `SchoolState` aggregate per client/demo namespace. The aggregate contains separately typed arrays rather than a generic content document masquerading as finance. Each command loads a revision, computes and validates a new state, then updates with `WHERE revision = expected`. A failed comparison retries the pure command against current data. Only the successful update produces a result. The same mechanism makes capacity checks, event writes, invoice creation and idempotency recording atomic.

`school_sessions`, `school_visitors`, `school_limits` and `school_payment_routes` are separate SQL tables. The Worker talks to Turso over HTTP and checks the affected row count after each conditional update.

This is intentionally a **small-center** storage strategy. One institution serializes writes. The adapter rejects aggregates larger than 1.5 MB instead of risking truncated records. Revisions are bounded to 20 per content record. Enrollment events and idempotency records are not automatically purged. Track aggregate size and archive or migrate to normalized transactional tables well before the limit. This is not a high-volume school ERP. Changing storage must preserve compare-and-swap/transactional guarantees, not replace them with an in-memory mutex.

## Enrollment states

`draft` reserves no seat. Submitting validates published program, student ownership, cohort window and form fields. A submission with capacity becomes `submitted`; a full class becomes `waitlisted`. `submitted`, `under_review`, `accepted`, `awaiting_payment` and `active` each reserve one seat. Staff may review, waitlist, accept or reject under a validated transition graph. Optimistic record versions prevent stale reviews.

Acceptance adds an audit event. Without a payment requirement it activates enrollment. In Full mode, a positive tuition amount and required payment create one immutable invoice and leave enrollment `awaiting_payment`. A verified full payment activates only an approved enrollment. Payment alone never approves an application.

Cancellation releases capacity. Paid cancellation and late payments require staff reconciliation; they never silently reactivate a cancelled application. Completion releases the seat but preserves the authorized learner's resources/history. Occupied cohorts cannot shrink below reserved capacity or change their program/branch. There is no automatic unpaid-seat expiry in this release: staff must cancel stale reservations according to client policy.

## Money and provider safety

Invoice lines and totals are safe integer rupiah, with explicit tuition and registration lines. The total is limited to IDR 1 billion. The current release records one full invoice payment, not partial installments or automatic refunds.

Manual payment requires staff authority and a reference. Demo payments never call a provider. Midtrans Snap creates a unique server-side order and uses independent client credentials. Only one concurrent start can claim an order. Ambiguous creation failures require reconciliation; the app does not create a second charge blindly.

Callbacks verify SHA-512 over the documented fields, then query the provider's canonical status. The server validates order, amount and currency before applying it. Duplicate notifications do not duplicate payment or activation. Pending/failed notifications cannot regress a paid payment. Refund events flag manual review. Merchant settlements and banking reconciliation remain outside the template.

References: https://docs.midtrans.com/docs/https-notification-webhooks and https://docs.midtrans.com/reference/get-transaction-status.

## Access

| Role | Access |
| --- | --- |
| Visitor | Published public content, course metadata and public intake schedules |
| Student | Own application history; Full adds own invoices, active classes/resources and progress |
| Guardian | Same scope, limited to explicitly linked students |
| Tutor | Assigned cohorts/sessions, relevant roster, attendance, materials and progress; no payments or application answers |
| Editor | Public content and teacher profiles, including draft/publish/revisions/media; no admissions/finance |
| Staff | Programs/schedules, admissions/records and Full operations/finance |
| Admin | Staff rights plus settings, modules, form schema, branch and account management |

Production never trusts demo role headers. It authenticates opaque, hashed, expiring server sessions. Passwords use salted PBKDF2 plus a server-side secret; secrets and password hashes never appear in snapshots. Password changes invalidate all sessions. Signups cannot choose staff roles or attach arbitrary existing students. Guardians start with a newly created dependent; staff verifies and links existing records manually.

There is no automated email verification, forgotten-password email, MFA or SSO in this version. Account creation and initial-password delivery need an institution's trusted process. A provider-based identity adapter is a recommended extension before broad deployment to sensitive student populations.

## Demo and files

Random HttpOnly demo cookies select isolated server namespaces, with 24-hour expiry. Presets have separate namespaces; feature levels do not, so feature switching preserves state. Demo users and records are fictional. New demo learner names are replaced with a fictional label, but form answers remain editable: never enter real child data in a public demo.

Uploads use allowlisted types, a 5 MB cap, content signature checks and random storage keys. HTML/SVG are not accepted. Only editors can make image assets public. Private resources require authorized staff/tutor or active/completed enrollment, and use attachment, no-store and nosniff responses. Do not place private materials in `public/`. Signature checks are not a malware scanner; a production deployment may add scanning and retention hooks.

## Notifications

An enabled module creates an outbox alongside the committed enrollment event. A configured HTTPS adapter receives an HMAC-signed payload and stable idempotency key. Worker `waitUntil` attempts delivery after a command; the scheduled handler and staff retry action can retry failures. The receiver must deduplicate by key. Delivery is at-least-once, not exactly-once. Missing provider settings do not produce false success. The retry cap is five attempts, with ten messages per batch; large volumes should use a dedicated queue.
