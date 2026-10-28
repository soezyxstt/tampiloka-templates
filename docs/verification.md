# Verification and delivery record

Verified on 28 October 2026 against the reusable cafe template implementation. Local tools: Node.js 24.22.1, Next.js 15.5.28, Playwright 1.56.1 and Chromium. The repository CI configuration uses Node.js 22; this local record does not claim that a remote Actions run has completed.

## Results

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

## Evidence

- [Machine-readable verification summary](../design-runs/2026-10-28/evidence/verification-summary.json)
- [Production browser results](../design-runs/2026-10-28/evidence/browser-workflows.json)
- [Static catalog browser results](../design-runs/2026-10-28/evidence/static-catalog/static-catalog-browser.json)
- [Fresh catalog production build/start result](../design-runs/2026-10-28/evidence/static-catalog/catalog-production.json)
- [Independent phone/tablet geometry review](../design-runs/2026-10-28/evidence/theme-review/final-review.json)

| View | Screenshot |
| --- | --- |
| Customer phone | [390 px menu](../design-runs/2026-10-28/evidence/theme-review/final-customer-390-viewport.png) |
| Cashier tablet | [1024 px workspace](../design-runs/2026-10-28/evidence/theme-review/final-staff-1024.png) |
| Real static catalog | [Generated client](../design-runs/2026-10-28/evidence/static-catalog/catalog-mobile.png) |
| Checkout | [Cart and price review](../design-runs/2026-10-28/evidence/customer-cart.png) |
| Payment simulation | [Explicit demo QR](../design-runs/2026-10-28/evidence/customer-payment-demo.png) |
| Multi-item POS | [Server-reviewed order](../design-runs/2026-10-28/evidence/cashier-order-review.png) |
| Themes | [Boxy](../design-runs/2026-10-28/evidence/theme-boxy-mobile.png), [Rounded](../design-runs/2026-10-28/evidence/theme-rounded-mobile.png), [Editorial](../design-runs/2026-10-28/evidence/theme-editorial-mobile.png), [Playful](../design-runs/2026-10-28/evidence/theme-playful-mobile.png), [Airy](../design-runs/2026-10-28/evidence/theme-airy-mobile.png) |

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
