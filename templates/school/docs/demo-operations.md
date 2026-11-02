# School demo operations

The demo owns a dedicated Worker, Turso database and private R2 bucket. It never shares credentials or storage with a client project.

- Worker: `tampiloka-school-demo`
- Verified origin: `https://school.tampiloka.site`
- Database: `tampiloka-school-demo`
- Private media: `tampiloka-school-demo-media`

The R2 lifecycle rule `expire-school-demo-uploads` expires objects under `demo:` after 86,400 seconds. Database namespace/session cleanup runs daily. Lifecycle deletion is asynchronous; do not promise exact-to-the-second retention. No live payment or notification provider credentials belong in this deployment.

## Schema provisioning

The demo database URL lives in `wrangler.demo.jsonc`. Store its database-scoped token in the GitHub Actions secret `TURSO_SCHOOL_AUTH_TOKEN`. Before a schema change, run `pnpm db:remote` from this directory with the same URL and a migration token. The release job compares the live migration ledger and schema to the SQL in this repository, then deploys the Worker with its runtime token.

Generated client projects use separate Turso credentials and R2 buckets. See `deployment.md`.

## Release gates

The `School quality gates` workflow checks the source, generator, domain/API, registry, catalog, design tokens, type safety, build, standalone client and browser journeys. Pull requests run without deploy credentials.

On `main`, `release-demos.yml` builds the demo, captures its previews, verifies the Turso schema and migration ledger and deploys the Worker. The hosted `tests/live-smoke.mjs` refuses mutations unless bootstrap identifies demo mode. It checks enrollment concurrency, visitor and role isolation, private R2 downloads and payment boundaries.

The release runs Chromium against the deployed app and checks the hosted build identity and preview bytes. Find test results in `demo-checks-school` (14 days) and the release record in `demo-release-school` (90 days).

Catalog visibility is a separate release decision. Publish a family only after its actual URL, mode links and corresponding preview have been checked. The school entries passed these checks on 31 October 2026. The main-branch catalog workflow releases the new metadata to the marketing site's runtime feed after merge; the feature branch does not replace that feed directly.

## Review and reset

Open a new browser session for isolated fictional records. Use the shared toolbar to switch visitor/student/staff, or its appearance panel for tutor/guardian and reset. Reset removes only that session's demo records; it does not touch other visitors or production. A staff review changes the same persisted application seen by the student.

## Production boundary

Generated client projects remove the demo deployment config and use independent blank database/bucket settings. Configure client-owned credentials, replace fictional content, and finish the production checklist in `deployment.md`. A public demo success does not validate a real Midtrans merchant account, notification provider, privacy policy or disaster-recovery process. Review `verification.md` for actual checks and limits.
