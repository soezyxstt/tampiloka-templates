# Open issue repair verification — 2026-11-01

Source baseline: `428f5b3`. Seven GPT-6.1 Terra high lanes supplied isolated commits; the parent integrated them, completed the release gate and remaining regressions, and ran the checks below. No issues have been closed and no public deployment or billing change was performed.

| Issue | Change and verification | Remaining acceptance |
| --- | --- | --- |
| #20 | Cloudflare remote preview with the demo D1 binding reproduced a write failure: `D1_ERROR: Your account has exceeded D1's free tier daily row write limit`. Diagnostics identified `rateLimit` as the failing operation. The Worker now returns retryable `503 storage_capacity_exceeded`, with safe exception classification and no application answers in logs. A regression checks that a failed submission adds no enrollment. | Restore account capacity, deploy the repaired release, then pass the existing hosted smoke, Chromium journeys and preview-byte checks. The current account failure is confirmed; no historical exception log was available for the original Actions failure. |
| #21 | Packed CLI generates Commerce outside the workspace. Fresh dependency install, typecheck, production build and Chromium storefront checks pass with no demo toolbar. CI builds generated clients outside the checkout. | New hosted CI workflow has not run yet. |
| #22 | Four available families, planned Dashboard, actual local commands and separate gallery/catalog ownership are documented. The repeatable docs consistency check passes and runs in CI. | Local first-run startup was not exhaustively repeated for all families. |
| #23 | Family design/development/test/release map, onboarding and available/ready definitions added to AGENTS.md. | None for documentation scope. |
| #24 | Generated Cafe retains both font packages and npm lockfile entries. Outside-workspace `npm ci` and `npm run build` pass. Both font families occur in built CSS, and their referenced font files return HTTP 200 from the generated server. | None for local generated-client verification. |
| #25 | Unique payment attempts, terminal expiry/cancellation retries, canonical reconciliation, expiring creation lease and duplicate/late callback handling have Worker regressions. Active concurrent creation remains blocked; stale creation reconciles the same order. | Mocked provider responses only; merchant-specific sandbox verification remains required. |
| #26 | Booking-scoped authorized availability excludes only the appointment being moved. Backend tests cover general availability, other allocations, authorization and forged input. Chromium offers and submits overlapping moves for customer and staff against local Workerd/D1. | Hosted repaired-release verification. |
| #27 | Every checked-in family manifest, including Dashboard, validates against JSON Schema; invalid keys, axis syntax and duplicates are rejected. | Axis schema defines syntax/uniqueness; family option lists remain registry-owned. |
| #28 | Booking and School declarations match runtime root exports; strict TypeScript consumer imports through the package export map. | None for local package-consumer verification. |
| #29 | All four families have deployment-owned identity, successful hosted-job artifacts, automatic candidate injection and catalog reconciliation. Tests reject stale/forged evidence and retain a failed family's previous entries while allowing independent changes. Source changes at unchanged URLs require fresh evidence. | Actual GitHub/Cloudflare execution and marketing consumer compatibility with the additive family `release` field. Disable the legacy Cafe Pages Git deployment from the old repository when adopting the canonical uploader. |
| #30 | Effective registration schema includes identifiable extension fields; collisions are rejected. Chromium fills a required extension field in the real learner form and verifies its labeled answer in staff review. | None for local form-to-Worker verification. |
| #31 | Packed CLI supports `--modules catalog` independently of the existing waiter-request `catalog` preset. Generated modules are exactly `catalog`, `CAFE_DEMO_DB=0`; menu loads and transactional POSTs return `503 LIVE_ADAPTER_REQUIRED`. | Hosted CI execution. |
| #32 | Copy fixtures resolve from the test module. Root Turbo test run passes while executing CLI tests from `packages/cli`; root CLI test command also passes. | None for local cwd regression. |

## Passed checks

- `pnpm install --frozen-lockfile`
- `pnpm test`: all six package test tasks passed, including the CLI working-directory regression.
- `pnpm typecheck`: all four template tasks passed.
- `pnpm test:docs`, `pnpm lint:design` (`Design tokens OK`, 136 files), and `git diff --check`.
- Registry promotion and release-evidence regressions, including altered asset bytes under the same filename; catalog build and publication-script syntax checks.
- Booking production/demo build and focused Chromium reschedule test using local Workerd/D1 at customer 390px and staff 1024px.
- School build and required-extension Chromium test at 390px and 1024px. The isolated School lane also reported 39 passing local Chromium scenarios and standalone generation verification before integration.
- Packed CLI installed into `D:/Work/Tampiloka/issue-verification-20261101/cli`; generated `store` and `menu` siblings have their own dependencies and build output. The external `check-clients.mjs` passed at 390px and 1440px, checked fonts and blocked Cafe transactions. Screenshots are retained in that verification directory; extension and Booking screenshots remain under each template's ignored `test-results` directory.
- Actionlint passed for changed workflows with only `.*queue.*` diagnostics excluded. The downloaded linter does not recognize `queue: max`; [GitHub documents this supported queue option](https://docs.github.com/en/actions/how-tos/write-workflows/choose-when-workflows-run/control-workflow-concurrency). No other workflow findings were suppressed.

The remote preview used isolated fictional demo sessions and was stopped after diagnosis. Public School is unchanged. Restoring D1 capacity may involve waiting for the provider reset or an account plan decision; no account upgrade was authorized or attempted. Hosted release acceptance remains pending rather than inferred from local tests.
