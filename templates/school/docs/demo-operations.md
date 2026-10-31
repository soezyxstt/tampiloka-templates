# School demo operations

The demo owns a dedicated Worker, D1 database and private R2 bucket. It never shares credentials or storage with a client project.

- Worker: `tampiloka-school-demo`
- Intended origin: `https://school.tampiloka.site`
- Database: `tampiloka-school-demo`
- Private media: `tampiloka-school-demo-media`

The R2 lifecycle rule `expire-school-demo-uploads` expires objects under `demo:` after 86,400 seconds. Database namespace/session cleanup runs daily. Lifecycle deletion is asynchronous; do not promise exact-to-the-second retention. No live payment or notification provider credentials belong in this deployment.

## Release gates

`School quality gates` validates the source, generator, domain/API, registry, catalog, design tokens, type safety, production build, independent client project and browser journeys before deployment. Pull-request runs never receive deployment credentials. Pushes to `main` or the initial `feat/school-template` branch may deploy only after the school job passes.

The deploy job uses the tested build artifact, applies migrations only to the dedicated demo DB, and runs `tests/live-smoke.mjs` against the actual origin. This test refuses mutations unless bootstrap explicitly reports demo mode. It verifies all four presets, idempotency, shared staff/student state, guardian isolation, private R2 downloads, real D1 concurrent capacity, feature gates, and rejection of real payment initiation.

The same Chromium suite then runs against the deployed app. It captures desktop/mobile pages and four 1280x800 previews with the actual shared toolbar. Only a successful run publishes these captures under `/previews/`; the job compares hosted image bytes with the captured files. Evidence remains in the `school-live-verification` artifact for 14 days.

Catalog visibility is a separate release decision. Do not publish a family or entry until its actual URL, full mode links and corresponding preview have been checked. A successful source build is not proof that a deployed URL works.

## Review and reset

Open a new browser session for isolated fictional records. Use the shared toolbar to switch visitor/student/staff, or its appearance panel for tutor/guardian and reset. Reset removes only that session's demo records; it does not touch other visitors or production. A staff review changes the same persisted application seen by the student.

## Production boundary

Generated client projects remove the demo deployment config and use independent blank database/bucket settings. Configure client-owned credentials, replace fictional content, and finish the production checklist in `deployment.md`. A public demo success does not validate a real Midtrans merchant account, notification provider, privacy policy or disaster-recovery process.
