# Client setup and deployment

## Local setup

Use Node 22.18+ and pnpm 10.28.2. After generation:

```sh
pnpm install
pnpm demo
```

The demo runs on `http://127.0.0.1:5176`. It uses `.data/school.sqlite` and `.data/files`, ignored by Git and never copied into generated clients.

For real client-mode validation, set three environment variables in your shell before `pnpm dev`: a random `AUTH_SECRET` of at least 32 characters, `BOOTSTRAP_ADMIN_EMAIL`, and a unique `BOOTSTRAP_ADMIN_PASSWORD` of at least 12 characters. Go to the staff view and sign in. Bootstrap can create only the first admin and cannot overwrite an existing admin. Remove the bootstrap password after creating the admin, but retain the auth secret. Changing that secret invalidates stored password verifiers and requires a deliberate credential recovery migration.

`.dev.vars.example` documents Worker secrets. The Node local server and migration script read `.dev.vars`; explicit process environment values take precedence. Never put secrets in `config/school.json`, `VITE_` variables, client source or Git.

## Database and object storage providers

The generator records independent selections in `config/storage.json` and Worker variables. D1 remains the default database. For D1 use the native `DB` binding and `pnpm db:local` / `pnpm db:remote`. For Turso set `DATABASE_PROVIDER=turso`, `TURSO_DATABASE_URL`, and, when required, `TURSO_AUTH_TOKEN`. For PostgreSQL set `DATABASE_PROVIDER=postgresql` and `DATABASE_URL`; the Worker uses `nodejs_compat`. Run `pnpm db:migrate` with those credentials before starting the server or deploying. This applies a provider-specific initial schema and migration ledger; coordinate migration runs, back up existing data, and migrate data separately when changing providers. The demo retains native D1 and R2 bindings.

For S3-compatible storage set `OBJECT_STORAGE_PROVIDER=s3`, `S3_ENDPOINT`, `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY` and optionally `S3_REGION` (default `auto`). Configure the bucket as private; the Worker checks permissions before streaming media. For UploadThing set `OBJECT_STORAGE_PROVIDER=uploadthing` and `UPLOADTHING_TOKEN`. The UploadThing application must enforce private file ACLs, including for newly uploaded files, so that its direct URLs cannot bypass School authorization. The adapter requests private ACLs for each upload. Verify that direct access without authorization fails before storing private learning materials. Never configure a public bucket or public provider URLs for private media.

The local demo uses SQLite and local media by default when no other database is selected. `pnpm dev` reads the selected providers; D1 uses local SQLite and remote choices require their credentials. Supply secrets through the shell locally or Worker secrets in deployment. The private media route and access rules are the same for each provider.

## Independent Cloudflare resources

```sh
pnpm exec wrangler d1 create client-school-db
pnpm exec wrangler r2 bucket create client-school-private
```

Put the returned D1 ID and the client-owned bucket name in `wrangler.jsonc`. Keep `DEMO_MODE=false`. The CLI removes Tampiloka routes/account IDs and copies no credentials. Then:

```sh
pnpm db:remote
pnpm exec wrangler secret put AUTH_SECRET
pnpm exec wrangler secret put BOOTSTRAP_ADMIN_EMAIL
pnpm exec wrangler secret put BOOTSTRAP_ADMIN_PASSWORD
pnpm build
pnpm exec wrangler deploy
```

A generated project removes the demo deployment config/script. The runtime does not show the Tampiloka toolbar in client mode. Demo handlers and role headers cannot bypass production authentication. Connect a client domain through the client's Worker settings. Vercel is not the deployment target of this adapter; use a separately implemented database/runtime adapter instead of assuming the Worker bundle runs unchanged on Vercel.

## Replace sample content before launch

Replace the institution profile, all photos and fictional tutors/testimonials. Update contacts, branch addresses, published program text, fees, enrollment windows, capacity, session times and policies. Use only fields needed for the process. Obtain appropriate student/guardian consent and define deletion/retention rules with the institution. Review image rights and local requirements rather than treating demo copy as legal policy.

Sample photography is illustrative. Sources are recorded in `content/photo-sources.json`; no photograph identifies the fictional tutor or learner named in the sample.

## Payments

Manual payment is the default. The portal tells learners to contact staff; an authorized staff member records receipt with a reference. Only record payment after checking the funds.

For Midtrans, change `payment.provider` to `midtrans`, set `MIDTRANS_SERVER_KEY` with Wrangler secrets, and set `MIDTRANS_ENVIRONMENT=sandbox` initially. Configure the provider notification URL to the client origin plus `/api/payments/callback`. Never expose the server key as a Vite variable. Test signature rejection, amount mismatch, duplicate callbacks, cancellation and delayed payments against the provider sandbox before going live. Then use the client's production merchant key and environment.

No live money has been used to verify this template. Automated tests mock canonical provider responses; the browser demo only simulates money. Checkout retries query canonical provider status before reusing a saved URL, so a missed expiry/cancellation callback does not trap an invoice on its old link. Verified expiry, cancellation or terminal `failure` permits a fresh order. Snap `deny` can be an early unsuccessful attempt on an order that later succeeds; it keeps the same order retryable. A provider 404 can mean the customer has not selected a payment method. New pages explicitly expire after 24 hours; the saved URL is reused until its recorded expiry, conservatively measured from receipt of the creation response. Only an expired page or a missing URL is regenerated under the same order ID. Legacy saved URLs without expiry information require operator reconciliation rather than invalidating a possibly active page. An in-progress creation lease expires after 60 seconds; a later retry reconciles the same order. A known pending transaction without a recoverable URL remains blocked for operator reconciliation. See [Snap multiple attempts and token recreation](https://docs.midtrans.com/docs/snap-advanced-feature) and [canonical transaction statuses](https://docs.midtrans.com/reference/transaction-status). Refund requests and partial payment plans require operational review or a later adapter.

## Notifications

Enable `notifications`, set `NOTIFICATION_URL` to an HTTPS adapter you control and store `NOTIFICATION_SECRET` as a secret. Verify HMAC-SHA256 of the raw JSON payload against `X-School-Signature`; deduplicate `Idempotency-Key`. The adapter sends email/WhatsApp and returns 2xx only after accepting the event. Configure consent, delivery logs and provider credentials in that adapter. Never publish recipient email lists.

The scheduled handler runs daily for expiry cleanup and retries; command execution also triggers a delivery attempt. Staff can retry pending events from Settings. Five failed attempts require operator review. A dedicated queue is appropriate for higher volumes.

## Operations and limits

Back up D1 before migrations and configure R2 retention. Monitor errors, provider failures, outbox age and `length(data)` in `school_state`. Keep the aggregate far below its 1.5 MB safety limit; archive historical cohorts or migrate to normalized tables before growth reaches it. Keep idempotency/event history long enough for retries and finance reconciliation. Do not delete financial audit rows casually.

The demo namespace expires after 24 hours. Cleanup removes expired DB sessions and states. R2 objects require a matching retention policy for public demo uploads; the database cleanup does not delete orphaned R2 bytes. Do not share the production R2 bucket with demos.

Password changes are available in both portals; forgotten-password recovery, email verification, MFA and SSO require an identity extension. Do not launch with an admin bootstrap password left in a shared terminal or visible to students.

`doctor` validates project structure, config, independent packages and production demo flags. Its warnings are not an assertion that provider keys, privacy policies, database backups or production security have been verified.

## Public search rendering

Public pages currently render with React in the browser. SEO fields update title and description after load; there is no server-rendered page-content layer or social-card renderer yet. Add prerendering or SSR before promising rich search indexing or social previews to clients.
