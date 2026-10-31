# School demo operations

The demo owns a dedicated Worker, D1 database and private R2 bucket. It never shares credentials or storage with a client project.

- Worker: `tampiloka-school-demo`
- Verified origin: `https://school.tampiloka.site`
- Database: `tampiloka-school-demo`
- Private media: `tampiloka-school-demo-media`

The R2 lifecycle rule `expire-school-demo-uploads` expires objects under `demo:` after 86,400 seconds. Database namespace/session cleanup runs daily. Lifecycle deletion is asynchronous; do not promise exact-to-the-second retention. No live payment or notification provider credentials belong in this deployment.

## Schema provisioning

The repository's Cloudflare deployment token can upload Workers but cannot query D1. The initial `0001_school.sql` was applied to the dedicated demo database through the authenticated Cloudflare connection on 31 October 2026, then read back from `sqlite_master`. Its migration record was also written to `d1_migrations`.

The deploy workflow runs `scripts/check-demo-schema.mjs` against the exact migration file list and SHA-256 before deploying. It does not pretend to run a remote migration with an unauthorized token. A new or changed SQL file fails this guard. Apply a future migration through a D1-authorized connection and verify the resulting schema before updating the guard, or grant a narrowly scoped D1 migration token and restore `wrangler d1 migrations apply` in CI. The guard is a release record, not a replacement for remote verification.

Generated client projects still use the normal client-owned D1 migration workflow in `deployment.md`. They do not inherit the demo database or its account configuration.

## Release gates

`School quality gates` validates source, generator, domain/API, registry, catalog, design tokens, type safety, production build, an independent client project and browser journeys before deployment. Pull-request runs never receive deployment credentials. Pushes to `main` or the initial `feat/school-template` branch may deploy only after the school job passes.

The deploy job uses the tested build artifact and checks the schema release record. It then runs `tests/live-smoke.mjs` against the actual HTTPS origin. This test refuses mutations unless bootstrap explicitly reports demo mode. It verifies four presets, idempotency, shared staff/student state, guardian isolation, private R2 downloads, real D1 concurrent capacity, feature gates, and rejection of real payment initiation.

The same Chromium suite runs against the deployed app. It captures desktop/mobile pages and four 1280x800 previews with the actual shared toolbar. Only a successful run publishes those live captures under `/previews/`; the job compares hosted image bytes with the captured files. Evidence remains in the `school-live-verification` artifact for 14 days. A newly attached domain may need HTTPS/DNS propagation before the health probe passes; do not weaken application assertions to work around domain readiness.

Catalog visibility is a separate release decision. Publish a family only after its actual URL, mode links and corresponding preview have been checked. The school entries passed these checks on 31 October 2026. The main-branch catalog workflow releases the new metadata to the marketing site's runtime feed after merge; the feature branch does not replace that feed directly.

## Review and reset

Open a new browser session for isolated fictional records. Use the shared toolbar to switch visitor/student/staff, or its appearance panel for tutor/guardian and reset. Reset removes only that session's demo records; it does not touch other visitors or production. A staff review changes the same persisted application seen by the student.

## Production boundary

Generated client projects remove the demo deployment config and use independent blank database/bucket settings. Configure client-owned credentials, replace fictional content, and finish the production checklist in `deployment.md`. A public demo success does not validate a real Midtrans merchant account, notification provider, privacy policy or disaster-recovery process. Review `verification.md` for actual checks and limits.
