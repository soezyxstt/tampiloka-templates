# Verification and delivery record

## Cross-tab refresh follow-up, 10 November 2026

`node --experimental-strip-types --test --test-concurrency=1 templates/cafe/tests/browser-runtime-scope.test.mjs templates/cafe/tests/snapshot-refresh-gate.test.mjs templates/cafe/tests/demo-navigation.test.mjs templates/cafe/tests/browser-runtime-coordination.test.mjs templates/cafe/tests/browser-runtime-order-notifications.test.mjs` passed 17 tests. These lightweight checks cover preset and launcher identity, refreshes received during commands, the subscription gap, worker coordination, navigation and notification deduplication. `git diff --check` and `node --check` for the changed JavaScript tests passed. The browser workflow now requires the customer order to appear in the cashier queue with polling disabled and a different staff theme. That browser regression, design lint, the full suites, build and typecheck were not run for this follow-up; they remain required before release.

Verified on 28 October 2026 against the reusable cafe template implementation. Local tools: Node.js 24.22.1, Next.js 15.5.28, Playwright 1.56.1 and Chromium. The repository CI configuration uses Node.js 22. The original showcase release is recorded in [PR #1](https://github.com/soezyxstt/cafe-template/pull/1); the lifecycle corrections described below supersede its narrower operational coverage.

## Version 0.3.1: complete visit lifecycle

The release verifies explicit seating through departure and cleaning, with backend guards and actual customer/staff UI interaction. The [lifecycle guide](lifecycle.md) contains the reproducible data matrix and operating instructions.

| Gate | Verified result | Coverage |
| --- | --- | --- |
| Core suite | 91 tests passed | 19 config/CLI, 10 catalog, 30 domain/capability/billing, and 32 database tests including 30 lifecycle scenario subtests |
| Browser adapter and mock-state suite | 22 tests passed | Existing crypto/schema/durability checks plus all 14 mock states, module restrictions and invalid-loader preservation |
| Final lifecycle browser run | 11 cases / 24 checks passed | Prepay, pay later, add-on, partial cash/change, cancelled/successful QR, kitchen, takeaway, rejection, immediate/deferred refund, split/merge, manager exception, external counter, private waitlist and all mock states |
| Final preset browser run | Nine presets / 37 checks passed | Mobile customer, tablet staff, module gates, images and connected UI workflows |
| Generated client HTTP tests | 10/10 passed | All nine presets and catalog-only without database credentials |
| Fresh catalog client core suite | 91 tests passed | Inherited backend fixtures run independently from the client's selected modules |
| Build and static checks | Passed | TypeScript, ESLint, Next.js production build and Vite showcase build |

The final local browser runs used `/assets/index-DsNKL03W.js` and confirmed that all 89 application/configuration source files remained unchanged during verification. The lifecycle run covered customer width 390 px and staff width 1024 px. Both browser suites recorded zero page errors, console errors and attempted network mutations. Reports are generated at `test-results/lifecycle-final/` and `test-results/demos-final/`, not committed as screenshot archives.

Backend cases also cover conflicting seating/acceptance/departure, stale quote reuse across table generations, invalid cleanup/enable actions, waitlist ownership/capacity/expiry, private ticket privacy, invalid payment policies, rejected cash-out, modifier stock, multiple-receipt refunds, no-open-drawer rollback, and funding dependencies after split/merge. A floor-plan draft cannot change live geometry; publication is blocked while the room is occupied.

The CI workflow now installs Chromium and runs both browser suites against its own built artifact. JSON reports and screenshots are retained as the **cafe-browser-verification** artifact. Public-domain checks are repeated after merge/deployment; the release PR records the exact commit, CI runs and Pages deployment.

The [Figma lifecycle review](https://www.figma.com/design/eXWI36xzNr8gtLBxFW0G6r/Design-Kit?node-id=169-4063) adds five component families with 11 states to the existing v2 page, reusing its variables, text styles, buttons and fields.

## Version 0.3.0: public showcase and cleanup verification

The public showcase reuses the application UI and domain service, with a browser-local database adapter for Cloudflare Pages. It does not use a shared public transaction database or collect real payments.

| Check | Result | Coverage |
| --- | --- | --- |
| Current core suite | 51 tests pass | 19 config/CLI, 10 catalog, 21 domain/capability, and one isolated database integration scenario |
| Browser adapter unit suite | 5 tests pass | Node-compatible hashes and IDs, generated schema freshness, strict persistence acknowledgement and storage failure handling |
| Browser runtime integration | 6 workflow groups pass | Cross-tab idempotent order submission, simulated settlement, kitchen, discounted POS, cash/change, shifts, persistence after leader closure, independent visitors and reset |
| All preset Pages browser suite | 9 presets and 37 checks pass | Actual static Pages server, customer width 390, staff width 1024, module controls, images, and complete UI workflows |
| Public hub review | Pass | Nine package cards, customer/staff filters, all five theme previews, local links, phone/desktop layout and keyboard navigation |
| Fresh independent client | Pass | Actual locked installation, typecheck, lint, 51 core tests and Next production build after showcase dependencies/source are excluded |
| Production builds | Pass | Main Next.js application and static Vite showcase |
| TypeScript and ESLint | Pass | Final runtime, application, showcase, scripts and tests |

The all-preset suite tested actual UI order submission, staff acceptance in a second tab, simulated QR settlement, a two-line POS order with a Rp5,000 discount, reload/shared-bill persistence and toolbar reset. It reported zero page errors, console/CSP errors, broken visible images or network mutation requests. The catalog does not initialize the browser database. Browser evidence is generated locally at `test-results/demos/demos-browser.json` and is excluded from version control.

The isolated production runtime harness measured cold initialization at 2.496 seconds, warm snapshots at 79–112 ms and ordinary commands at 87–134 ms. These are local measurements, not network performance guarantees. Complete domain operations execute inside one elected database worker; each action awaits a strict IndexedDB flush before returning. The tests also close the leader tab and reload to verify persistence.

The fresh client installation contains no Vite, Wrangler, Miniflare, Workerd, showcase font packages or browser crypto helper package. Its lockfile retains only the reachable dependency graph, preserving pinned versions. The source repository's additional CI demo steps use `--if-present`, so the same workflow remains valid after scaffolding.

Run commands and public addresses are documented in the [showcase guide](demos.md). The earlier implementation checks below describe the template before adding the public showcase and remain useful as historical coverage.

## Template v2 implementation checks

| Check | Result | Coverage |
| --- | --- | --- |
| TypeScript | Pass | Application, CLI declarations, server routes and catalog types |
| ESLint | Pass, no errors or warnings | Source and scripts; the one-time browser storage hydration has a narrow documented exception |
| Config and CLI | 18 tests pass | All 512 module combinations; presets, themes, contrast, invalid input, safe scaffolding, no overwrite, no secret/database copy, exact CI-file allowlist |
| Static catalog | 10 tests pass | Public content validation, default variants, availability, QR identifiers, public export and runtime boundary |
| Domain and capabilities | 21 tests pass | Money, charges, cash/change, stock, kitchen transitions, enabled modules and customer/staff command restrictions |
| Isolated database integration | 1 scenario passes | Real quote, POS discount, idempotent submission/acceptance, cash receipts, insufficient cash, active external attempt, demo settlement, invalid backward kitchen transition and changed prices |
| Generated client integration | All 9 demo presets pass | Separate client directories and databases, enabled/disabled routes, public snapshots, QR entry, ordering and cashier workflows |
| Database-free catalog HTTP | Pass | Home and valid QR 200; invalid QR, staff page and staff snapshot 404; mutations blocked; no database directory created |
| Production builds | Pass | Main full-demo configuration and a fresh catalog client |
| Full demo browser | 9 checks pass | Tested against the built production server, not just a development render |
| Static catalog browser | 5 checks pass | Phone layout, read-only item details, QR sharing, no-table fallback and absence of database access |

The database test deliberately logs rejected invalid operations; those expected errors are covered by assertions. These are not failing test results.

## Browser journeys

The full demo check creates fictional test orders and verifies:

1. Mobile search, empty results and reset.
2. QR menu → item options → cart → customer name → server price review → submission, without requiring GPS again for a valid table QR.
3. Staff acceptance creates an order and bill.
4. Online checkout creates a clearly labeled, nonpayable demo QR and remains pending.
5. A shared bill URL opens the matching payment screen on its first render.
6. The staff simulation records settlement for that exact bill.
7. A two-item POS order applies a Rp5,000 discount after server review.
8. All five themes render at 390 px without document overflow or broken images.
9. No browser page errors occur.

The static catalog check runs in a fresh CLI-generated client at 390 × 844. It checks sample-content and manual-availability labels, item descriptions/variants, absent order/cart/staff controls, a valid table QR, and a copied menu link. With an empty table list, both header and profile show venue information instead of an invented table; sharing opens the root menu. No database is created.

Independent visual review covered customer screens at 390 × 844 and staff screens at 1024 × 768. It identified and corrected crowded phone header actions, an oversized mobile introduction, truncated tablet bill identities, and a clipped cash-payment amount. Tablet navigation now uses the top bar below 1280 px. The final payment action fits its full amount, and document width matches viewport width.

Earlier responsive checks also exercised customer widths 320, 768 and 1440 and the desktop staff view. The retained final images below are the focused phone/tablet review and the production browser journeys; they should be used for the current visual handoff.

## Repository cleanup

The cleanup was measured against [commit `7fb253d`](https://github.com/soezyxstt/cafe-template/commit/7fb253d648ebe015fdd82f786de3ea4ae6a793d8). It removes **448 obsolete files totaling 77.20 MB** from the current file tree: **98.01%** of that revision's 78.76 MB of uncompressed file content. This measures the checked-out files, not Git's compressed storage; the historical revision remains available.

| Removed material | Files | Uncompressed size |
| --- | ---: | ---: |
| AI Studio temporary captures | 69 | 6.99 MB |
| Historical benchmark gallery | 62 | 20.01 MB |
| Earlier application screenshots | 48 | 5.06 MB |
| Earlier UI test gallery and duplicate ZIP | 243 | 43.75 MB |
| Generated verification images and results | 18 | 1.05 MB |
| Unused Firebase/AI Studio setup, responsive helper, old ESLint config, duplicate Bun lockfile, and superseded Python check | 8 | 0.33 MB |

Active application code, domain/database logic, CLI and automated tests, the npm lockfile, public content, and all nine source menu illustrations are retained. [Benchmark notes](benchmark-notes.md) preserve the design observations. Evidence links below point to the historical revision so new client projects and deployments do not need to carry screenshot archives.

## Historical evidence

The following evidence records the verified implementation at commit `7fb253d`. Links are pinned to that revision. Generated screenshots and test output were removed from the reusable source tree during repository cleanup; current checks write fresh local output under `test-results/`.

- [Machine-readable verification summary](https://github.com/soezyxstt/cafe-template/blob/7fb253d648ebe015fdd82f786de3ea4ae6a793d8/design-runs/2026-10-28/evidence/verification-summary.json)
- [Production browser results](https://github.com/soezyxstt/cafe-template/blob/7fb253d648ebe015fdd82f786de3ea4ae6a793d8/design-runs/2026-10-28/evidence/browser-workflows.json)
- [Static catalog browser results](https://github.com/soezyxstt/cafe-template/blob/7fb253d648ebe015fdd82f786de3ea4ae6a793d8/design-runs/2026-10-28/evidence/static-catalog/static-catalog-browser.json)
- [Fresh catalog production build/start result](https://github.com/soezyxstt/cafe-template/blob/7fb253d648ebe015fdd82f786de3ea4ae6a793d8/design-runs/2026-10-28/evidence/static-catalog/catalog-production.json)
- [Independent phone/tablet geometry review](https://github.com/soezyxstt/cafe-template/blob/7fb253d648ebe015fdd82f786de3ea4ae6a793d8/design-runs/2026-10-28/evidence/theme-review/final-review.json)

| View | Screenshot |
| --- | --- |
| Customer phone | [390 px menu](https://github.com/soezyxstt/cafe-template/blob/7fb253d648ebe015fdd82f786de3ea4ae6a793d8/design-runs/2026-10-28/evidence/theme-review/final-customer-390-viewport.png) |
| Cashier tablet | [1024 px workspace](https://github.com/soezyxstt/cafe-template/blob/7fb253d648ebe015fdd82f786de3ea4ae6a793d8/design-runs/2026-10-28/evidence/theme-review/final-staff-1024.png) |
| Real static catalog | [Generated client](https://github.com/soezyxstt/cafe-template/blob/7fb253d648ebe015fdd82f786de3ea4ae6a793d8/design-runs/2026-10-28/evidence/static-catalog/catalog-mobile.png) |
| Checkout | [Cart and price review](https://github.com/soezyxstt/cafe-template/blob/7fb253d648ebe015fdd82f786de3ea4ae6a793d8/design-runs/2026-10-28/evidence/customer-cart.png) |
| Payment simulation | [Explicit demo QR](https://github.com/soezyxstt/cafe-template/blob/7fb253d648ebe015fdd82f786de3ea4ae6a793d8/design-runs/2026-10-28/evidence/customer-payment-demo.png) |
| Multi-item POS | [Server-reviewed order](https://github.com/soezyxstt/cafe-template/blob/7fb253d648ebe015fdd82f786de3ea4ae6a793d8/design-runs/2026-10-28/evidence/cashier-order-review.png) |
| Themes | [Boxy](https://github.com/soezyxstt/cafe-template/blob/7fb253d648ebe015fdd82f786de3ea4ae6a793d8/design-runs/2026-10-28/evidence/theme-boxy-mobile.png), [Rounded](https://github.com/soezyxstt/cafe-template/blob/7fb253d648ebe015fdd82f786de3ea4ae6a793d8/design-runs/2026-10-28/evidence/theme-rounded-mobile.png), [Editorial](https://github.com/soezyxstt/cafe-template/blob/7fb253d648ebe015fdd82f786de3ea4ae6a793d8/design-runs/2026-10-28/evidence/theme-editorial-mobile.png), [Playful](https://github.com/soezyxstt/cafe-template/blob/7fb253d648ebe015fdd82f786de3ea4ae6a793d8/design-runs/2026-10-28/evidence/theme-playful-mobile.png), [Airy](https://github.com/soezyxstt/cafe-template/blob/7fb253d648ebe015fdd82f786de3ea4ae6a793d8/design-runs/2026-10-28/evidence/theme-airy-mobile.png) |

The isolated catalog production record includes a warning from the inherited `output: 'standalone'` configuration. That setting was subsequently removed so `npm start` is the correct runner. The final main build and production browser suite passed with the corrected configuration; the older isolated record is annotated, not rewritten to imply an unperformed rerun.

## Figma handoff

The existing [Design Kit](https://www.figma.com/design/eXWI36xzNr8gtLBxFW0G6r/Design-Kit?node-id=116-43) now has a dedicated **12 Cafe Template v2** page. Original pages are preserved. Readback confirmed 80 variables across three collections, 11 text styles, nine UI component families with 44 main variants, five phone screens, three staff screens, and three editable source illustrations. The latest ink token is shared with the runtime's readable custom-brand treatment.

The kit contains editable text, vectors, variables and components. Its source map is documented in [design-system.md](design-system.md). This is an explicit design/implementation contract, not automatic two-way synchronization. Figma's editorial font is Lora because Georgia is unavailable in the connected font inventory; the code uses Georgia. That substitution is documented.

## Practical limits

The read-only catalog can serve a real client's reviewed content now. Transactional modules are working local demos and remain gated behind `CAFE_DEMO_DB=1`. The sample staff PINs are not authentication, customer identities are not signed production sessions, and online settlement is simulated. The unsigned webhook is blocked.

A live ordering installation needs authenticated staff/customer sessions, enforced roles and outlet ownership, a private durable database with migrations/backups, and a verified payment adapter. A member/loyalty rollout also needs real identity and OTP integration. Reports show sales and receipts, not profit or a full accounting ledger. The fixture assumes one client per database.

The automated UI run uses Chromium. Safari, Firefox, physical QR scanners, receipt printers, network-loss reconciliation across devices, and real provider settlement have not been verified. Check those against the chosen client's deployment and hardware. Configuration validation and readable color tokens improve reuse; they do not constitute a complete accessibility or security certification.

## Repeat the checks

See [scripts/README.md](../scripts/README.md#verification) for commands. `npm test` is isolated from client databases. `npm run test:presets` creates and cleans temporary projects. `npm run test:browser` intentionally writes demo orders and simulated payments, so point it only at a dedicated full-service demo. The browser suite rejects a snapshot that is not explicitly marked as a demo.
