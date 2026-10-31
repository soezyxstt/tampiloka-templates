# Verification

Run the following from the monorepo:

```sh
pnpm test:school
pnpm --filter @tampiloka/template-school typecheck
pnpm build:school
pnpm lint:design
pnpm test:cli
pnpm test:registry
pnpm catalog:test
pnpm test:school:browser
```

Backend tests exercise all levels/presets, state transitions, simultaneous registrations against capacity, retries, payment integrity, authorization, guardian links, content publishing, extensions and real production sessions. Browser tests cover 360/390/1024/1440 widths, normal/reduced motion, all layouts, loaded images, overflow, toolbar measurement, role changes, language, deep links, draft/submission/review/acceptance/payment/cancellation and content publishing.

Browser screenshots/results are under `test-results/school`. Each layout gets desktop/mobile full-page PNGs and a 1280×800 JPEG preview. Other evidence includes application, portal, staff and content editor screens. This directory is ignored in source; GitHub Actions retains it as a private workflow artifact.

Standalone checks generate outside the monorepo, install dependencies, typecheck, build and run server tests with no parent workspace. A successful source build alone does not count as standalone proof.

Public catalog metadata intentionally remains `visibility: private`, `ready: false` until a live deployment and hosted preview images have been checked. Local/CI screenshots alone are not evidence of a working public URL. Final measured results and remaining limits belong in the PR and workflow evidence, not fabricated pass statements here.
