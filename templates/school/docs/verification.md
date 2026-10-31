# Verification

## Verified release

Application commit: `71ac260c41a89aa53df0f4b0d8bbde6f88c98a29`.
Verified on 31 October 2026 against `https://school.tampiloka.site`.

- [School quality gates and deployed verification](https://github.com/soezyxstt/tampiloka-templates/actions/runs/41155368668): successful. The first deployment attempt encountered new-domain HTTPS readiness; the failed deployment job was rerun after the route returned a healthy response. Source checks remained successful.
- [Cafe and commerce regression suite](https://github.com/soezyxstt/tampiloka-templates/actions/runs/41155368682): successful, including their browser journeys and cafe motion/layout/preset/lifecycle checks.

| Check | Observed result |
| --- | --- |
| School domain, HTTP API and palette tests | 40 passed |
| CLI tests, including all 16 school preset/level combinations | 28 passed |
| Existing registry tests | 11 passed |
| Existing public catalog tests | 5 passed |
| Design-token lint | 113 files passed |
| School typecheck and production build | Passed |
| Independent generated application | Install, typecheck, build, 40 server tests and doctor passed |
| Local Chromium suite | 39 scenarios passed; no page errors |
| Deployed Chromium suite | 39 scenarios passed; no page errors |
| Actual deployed D1/R2 API checks | 46 passed |
| Hosted preview integrity | All four JPEG files matched live capture bytes |

The catalog-release commit adds two tests for school routing, preview names, all mode URLs and publication gates. Both passed alongside the five existing catalog tests before commit. The CI result for the release commit is the authoritative check for the full registry suite after those additions.

## What the checks exercise

Backend tests cover every feature level and business preset, enrollment states, simultaneous capacity claims, idempotency, forged or repeated payment callbacks, role/ownership/guardian/tutor access, production sessions, content validation/publication, modules, media and extension registration.

The live API suite uses actual D1 and R2, not an in-memory mock. It refuses mutations unless bootstrap explicitly identifies a demo. It verifies all four preset journeys, duplicate registration/payment requests, approval/invoice separation, shared staff/student state, guardian and other-student boundaries, visitor isolation, private resource upload/download, and cancellation revocation. Six concurrent applications plus the seeded application compete for three places: exactly three reserve a seat and four waitlist. Profile/WhatsApp mutations and real provider-payment initiation in the demo are rejected. Test namespaces are reset afterward.

The browser matrix is four layouts by 360/390/1024/1440 pixels by normal/reduced motion, plus four full preset journeys and three shared-operation scenarios. It checks loaded images, page overflow, toolbar height, contrast, dropdown keyboard/mouse focus return, independent appearance/preset/level settings, ID/EN, reload/back/forward/deep links, draft recovery, staff review, payment, tutor/guardian views, private downloads, cancellation confirmation, and content publication. Status assertions inspect the current enrollment state, not an old event badge.

## Screenshot evidence

The `school-live-verification` workflow artifact contains 34 real screenshots and JSON results under `live-school/` and `live-smoke/`. It is retained for 14 days. Desktop/mobile captures cover every layout, plus application forms, learner portals, tutor tools, staff tables and the content studio. Visual review found distinct layout structure, readable hierarchy and no horizontal page overflow at the tested sizes.

The four public preview images are exactly 1280 by 800 pixels, include the shared toolbar, and were captured from the deployed app. The deployment fetched the hosted files and compared SHA-256 with the capture files.

| Preview | SHA-256 of reviewed release |
| --- | --- |
| academic-editorial-preview.jpg | `ae1e5953bf98ad9e0f0bee53070d97e3a95b4999f4a39bbe67007951cc7de643` |
| course-discovery-preview.jpg | `0f092c57d5d9dc9532f648007f0812023bdffa85eb51266b660adca81aea83b5` |
| contemporary-learning-preview.jpg | `f7aa011af39bf54b72ff361b103c536f68dab9cfcd0d04555b35d0020efec3d0` |
| institutional-preview.jpg | `1c883a96ea8648907f133baa7cc9f48220458bc12667285e0e3737664b7fbb91` |

Files are served under `https://school.tampiloka.site/previews/`. Later verified deployments may replace the captures. The catalog metadata matches each capture's preset, layout, palette and typography; CLI defaults remain independent.

## Reproduce

```sh
pnpm test:school
pnpm --filter @tampiloka/template-school typecheck
pnpm build:school
pnpm lint:design
pnpm test:cli
pnpm test:registry
pnpm catalog:test
pnpm test:school:browser
pnpm --filter @tampiloka/template-school test:standalone
pnpm catalog:build
```

The standalone test creates a project outside the monorepo, installs its own dependencies and verifies it without the parent workspace. The requested prima-academy/full, lingua-center/enrollment and sekolah-mandiri/profile commands were also generated and passed doctor. Expected production-setup warnings remain until the client supplies resources, credentials and content.

To exercise the dedicated live demo:

```sh
cd templates/school
SCHOOL_URL=https://school.tampiloka.site node tests/live-smoke.mjs
SCHOOL_URL=https://school.tampiloka.site SCHOOL_SCREENSHOTS=test-results/live-school pnpm test:e2e
```

Do not target a client site with these mutating fixtures. Browser screenshots alone do not prove callback security; unit/provider-contract checks and deployed state checks are separate evidence.

## Remaining boundaries

The verified demo uses fictional records and simulated payments. No real payment or production notification was sent. Midtrans merchant/sandbox integration needs client-specific validation. Public content is client-rendered, not SSR. Password recovery/email verification/MFA/SSO and malware scanning need adapters. The small-center aggregate has a 1.5 MB ceiling; archive or normalize before growth. Stale unpaid seat reservations require staff cancellation. Partial installment plans, automatic refunds, assignments, quizzes, certificates, trial booking and recurring billing are not implemented default modules.

Public metadata is marked ready only after the live checks above. The shared production catalog publishes from main; this branch's entries reach the marketing gallery after the PR is merged and that catalog workflow succeeds. No marketing-source edit is required. This verification is not a claim of production security certification or enterprise-scale load testing.
