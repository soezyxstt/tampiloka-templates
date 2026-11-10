# Cafe template design system

## Manager periods and six-tab simulation, 10 November 2026

Reports support daily, Monday–Sunday weekly, calendar-month and inclusive custom periods. Selected bills, daily rollups, shift records and localized CSV use the same range. The report is based on bill business dates; receipt/refund totals are the current totals of those bills, including later settlements. It does not calculate profit or replace a transaction-date cash-flow ledger.

A six-tab Chromium simulation used one browser context for owner, cashier, waiter, kitchen, bar and customer. All business actions went through the UI. It began with an empty cafe, published A01 as a round four-seat table at 900 × 800 mm, opened a Rp200,000 float, seated three guests, ordered from the table QR, accepted and paid, prepared across kitchen/bar, resolved a guest request, served, approved departure and cleaned the table. A second takeaway was entered at the POS, paid, prepared and picked up. Both visits ended closed. The final two bills totalled Rp100,485, both settled; outstanding balance was zero. Counted drawer cash was Rp300,485 with no difference.

The simulation found a stale QR-entry table list despite synchronized database state. The entry now listens for data changes and refreshes its prepared snapshot, with a transient retry error. A01 → A02 → A01 was observed live without customer navigation or reload. The explorer suite now covers this with a second manager tab editing an available outdoor table and restoring its label. Floor-plan successes now use Sonner; takeaway bills are labelled as takeaway rather than as physical tables.

Verification: reporting/calendar helpers join the 32 passing domain tests; JavaScript typecheck and Vite build passed. The explorer, including the live-entry regression, passed; the separate full-service browser suite passed 10 checks including reload persistence. The interactive scenario completed 12 checks and saved 16 original screenshots and ID/EN CSVs with no page errors or network transaction writes. Its REPL reached the 30-minute resource limit after the scenario/export finished; an extra reload check in that session did not complete and is not claimed as passed. See `test-results/cafe-simulation/README.md`, `gallery.html`, `evidence.json`, and the machine's `cafe-simulation-*.log` files. No hosted deployment is claimed.

## Operational contrast review, 10 November 2026

A quiet interface still needs visible task boundaries. Staff lists now place each order, visit, service request, menu entry and stock record on a white surface with a strong boundary and space between records, over the muted warm canvas. Thin decorative dividers are reserved for rows inside one record. Floor service requests and the guest waitlist have separate task destinations, so staff do not need to scan two operational queues together. Kitchen ticket headers distinguish table/station identity from preparation items. Owner reports group related figures rather than creating one dashboard card per number.

The shared `Surface` task variant and record styles own this treatment. Selected bills use a check mark, a leading rule and an accent fill; selection does not depend on color alone. Customer menu photography remains the main boundary between dishes; cart lines and order-status groups use stronger outlines. Small shared buttons now have a 44px minimum target, and quantity controls use the strong input border.

Existing tokens are reused. On the white task surface, the default foreground contrast is 16.04:1, secondary text 6.41:1 and the strong boundary 3.43:1. This visual review supplements functional tests; it is not a usability study with cafe staff.

Follow-up verification: JavaScript typecheck and Vite production build passed. Compact UI passed 40 checks across customer themes and phone/tablet/desktop sizes; the full-service staff layout passed 17 checks over eight widths (the previous log footer incorrectly said all presets, so the reporter now states the actual selected count). The full-service checkout/POS flow passed 10 checks and language persistence passed. After splitting floor tasks, both pay-later service handling and customer-to-staff waitlist lifecycles passed, including assertions that the unrelated queue is absent. The final CSS-only canvas fix was rebuilt, and the resulting staff surfaces and phone overflow checks were inspected directly.

Manual review covered customer menu/cart, cashier orders/bills, floor visits/requests/waitlist, kitchen/bar tickets, owner reports, catalogue and settings. All nine 1280 × 800 public previews were refreshed from loaded pages; final PNG evidence and measured geometry are in `test-results/contrast-review`. Resource-intensive checks ran sequentially under the existing CPU/RAM limits. No deployment is claimed.


## Focused operational workspace, 9 November 2026

The showcase keeps exploration controls in the shared top toolbar. Theme, service mode, customer/staff view and staff identity belong to that toolbar; the customer menu and internal workspace use the same task-oriented composition as a generated cafe project. Sample payment instructions must still clearly say they cannot be paid. Reset and sample scenarios remain secondary exploration actions.

A customer can begin with a table QR before opening the menu. Direct table QR and shared-bill links preserve their existing destination. Owners start with reports when that module is enabled; kitchen/bar roles start with their station and floor staff with visits. Staff work should show one task at a time: incoming requests, bills/payments, and active visits have separate destinations. Counts belong to their task labels rather than a row of summary cards competing with the actual queue. Kitchen preparation, payment settlement, departure approval and table cleaning remain separate operations.

Successful actions use the shared Sonner toaster, mounted once in `MotionProvider` for both the Next.js app and the Pages showcase. Toasts use semantic surface, text, border and shadow tokens; close controls are 44px. Validation errors remain next to the form or task they block. Never show a failed request using a success badge. Essential transaction status remains visible in the order or bill after its short-lived toast disappears.

The browser showcase shares a scoped database across tabs on the same origin and preset, regardless of theme, language or staff identity. Views revalidate after subscribing and retain peer changes received during a pending local command. Browser audio requires a user gesture; staff must be able to enable or disable audible order alerts explicitly. Opening a seeded queue must not announce every pre-existing order as new. Cross-device and cross-origin sync require a production server and are not implied by same-browser pitching.

Verification results for this change are recorded separately after running the affected checks; this section describes the contract, not a passing test claim.

## Shared demo exploration, 30 October 2026

The public cafe entry opens the full interactive demo. Visitors choose the theme and service mode in the top toolbar, without first finding a card lower on a hub page. The gallery remains at `https://tampiloka.site/templates` and the outlined Tampiloka logo returns to its current language.

`@tampiloka/ui-core/demo` supplies `DemoToolbarShell`, and `@tampiloka/ui-core/demo.css` supplies the shared layout, select treatment and floating language control. Commerce uses those exact exports too. Keep the CSS import after application styles. The shell accepts `family`, `label`, `galleryLabel`, `galleryUrl`, `controls`, `views`, `activeView`, `viewLabel`, and `actions`. `views` contains stable IDs, labels, optional icons, and either a local `href` or `onSelect`. It measures its height into `--demo-height`; sticky staff headers and sidebars sit below it.

The select appearance follows Tampiloka's existing form controls: a quiet outlined trigger, 8px corners, an aligned popup 6px below the trigger, a right-side check, and 200ms entrance/150ms exit motion. Existing Radix primitives retain keyboard, focus and popup behavior. All demo controls have 44px touch targets; mobile select text is 16px. The narrow layout keeps brand and role actions above two full-width selectors. Theme changes affect the cafe preview, while demo navigation retains the same Tampiloka treatment.

Cafe links use `/p/<preset>/` and `/p/<preset>/staff` on the current origin. Explicit mode paths take priority over legacy preset subdomains; all old subdomains, table and bill routes remain supported. `theme` and `lang` query parameters survive mode and role changes and reloads. Within the same mode, navigation retains other query values and the hash; a tab-scoped customer return route restores table links after visiting staff. A new mode clears only mode-bound bill/table/principal values and the old hash. A mode change keeps the staff view when the next mode supports it, otherwise it opens the first available view. The toolbar only offers available surfaces. In-app customer/staff actions report actual view changes to the wrapper so active navigation and the URL stay in sync; mounting or re-rendering does not rewrite a deep link.

ID/EN stays fixed at the lower right, matching commerce. In the cafe customer view it sits above the bottom navigation so it cannot cover an order action. The locale from `?lang=id` or `?lang=en` takes priority over the browser default. The root loads one language control.

Demo chrome tokens in `demos/showcase.css` map to the same values as commerce: espresso `--demo-chrome-bg`, warm light foreground, muted text, strong borders and hover roles; neutral light `--demo-panel-*` roles for popups. These tokens do not alter the client's cafe brand settings. The original outlined SVG comes from `tampiloka/apps/tampiloka/public/brand/logos/dark/tampiloka-wordmark-dark.svg`; it is copied unchanged into `ui-core`, with no live-text recreation.

The shared package is a cafe development dependency because the CLI excludes public showcase code from client projects. `SHOWCASE_PACKAGES` removes it from the generated client's manifest, preserving standalone installation.

`tests/demo-navigation.test.mjs` covers explicit paths, legacy hosts and table routes. `tests/demos-explorer.mjs` covers the direct entry, 320/390/1440px geometry, popup bounds, keyboard selection and focus return, theme/mode/role/language changes and reload. The existing staff-layout test checks sticky offsets below the measured demo toolbar. These tests join `scripts/demos-verify.mjs`; a successful unit check is not a claim that the full served UI has passed.


The default cafe palette uses a warm cream canvas, white surfaces, espresso text and a terracotta action color. Status, overlay, strong-border and primary-ink roles are defined in `app/globals.css`; custom brand colors use the existing contrast helpers. Demo controls support Indonesian and English, with the browser language as the initial choice.

Updated: 28 October 2026. This document records the shared design contract for the reusable cafe template and its editable Figma kit.

### Lifecycle additions in 0.3.1

The existing v2 page now includes a [lifecycle review frame](https://www.figma.com/design/eXWI36xzNr8gtLBxFW0G6r/Design-Kit?node-id=169-4063), with reusable instances and five additional component families covering 11 states. These reuse existing buttons, fields, 15 variables and the kit's text styles.

| Family | States | Figma node | Implementation |
| --- | --- | --- | --- |
| Visit seating | Guest form | `169:3891` | `components/cafe/visit-service.tsx` |
| Departure review | Blocked, ready, exception | `169:3914` | `components/cafe/visit-service.tsx` |
| Payment timing | Dine-in/takeaway policy | `169:3995` | `components/cafe/staff-app.tsx` |
| Order payment | Unpaid, partial, settled | `169:4016` | `components/cafe/customer-app.tsx`, `src/domain/order-billing.ts` |
| Private waitlist | Waiting, called, seated | `169:4044` | `components/cafe/customer-app.tsx` |

The [operational contract](lifecycle.md) keeps payment, food delivery, guest departure and table cleaning separate. Disabled departure actions must explain the unresolved obligations. Customer order payment states use current bill allocations, and private waitlist status belongs only to the ticket holder.

## Customer menu openings

Editorial uses the first available photographed dish when it is first in the full menu. Its image, name, and price form the cover of the menu list. Airy places that first dish across two desktop columns. Filtering returns both to the compact menu. The other themes keep the quick-order grid. The same catalog record supplies both the cover and the item dialog.

The Menu Ledger (WF-08) keeps prices and search visible near the top of a QR visit. The lead item treatment adapts OFFER-02 and the featured coffee on [Toby’s Estate](https://www.tobysestate.com.au/). The photo and dish title share one detail action. Saving a favorite and adding an item have separate controls.

## Figma entry points

The work lives in **12 Cafe Template v2** in the existing Design Kit. The original 11 pages remain intact.

| Area | Figma link |
| --- | --- |
| Start and source map | [Cafe Template v2](https://www.figma.com/design/eXWI36xzNr8gtLBxFW0G6r/Design-Kit?node-id=116-43) |
| Five structural themes | [Theme comparison](https://www.figma.com/design/eXWI36xzNr8gtLBxFW0G6r/Design-Kit?node-id=116-138) |
| Customer flow, 390 × 844 | [Mobile customer views](https://www.figma.com/design/eXWI36xzNr8gtLBxFW0G6r/Design-Kit?node-id=116-139) |
| Staff views, 1024 × 768 | [Cashier, kitchen, reports](https://www.figma.com/design/eXWI36xzNr8gtLBxFW0G6r/Design-Kit?node-id=116-140) |
| Service packages and rules | [CLI and service map](https://www.figma.com/design/eXWI36xzNr8gtLBxFW0G6r/Design-Kit?node-id=116-141) |
| Original payment and recovery flows | [07 Ordering Flows](https://www.figma.com/design/eXWI36xzNr8gtLBxFW0G6r/Design-Kit?node-id=93-31) |
| Original detailed cashier flows | [09 Cashier](https://www.figma.com/design/eXWI36xzNr8gtLBxFW0G6r/Design-Kit?node-id=93-33) |

Figma contains editable text, vector artwork, auto-layout containers, variables, component sets, and instances. It contains no flattened screenshot of a complete interface. The new page is a reusable design specification and flow reference. The running application, automated checks, and real adapter integrations establish runtime behavior.

## What changed and why

The existing kit already covered mobile ordering, payment recovery, cash receipt errors, refunds, and station work. Its controls used a neutral palette, Inter/DM Sans, and a single small-radius treatment. The application used Manrope, Source Sans 3, terracotta, and more rounded panels. Neither source had a shared, explicit model for choosing a client service package and an independent component theme.

The v2 area closes that gap:

- Brand settings and component structure are separate choices.
- Five themes change shape, spacing, type, borders, and menu composition.
- Customer screens begin at a phone width. Staff screens begin at tablet landscape.
- Menu-only views omit order controls. Order confirmation explains payment status and the next step.
- Cashier examples show discounts, a final price, cash received, and change.
- Kitchen examples keep quantities, modifiers, notes, station, and elapsed time visible.
- Report examples label their figures as demo data and distinguish sales from profit.
- The service map uses the same nine preset IDs as the CLI.

The archived Millehub benchmark supports the task sequence: table context, menu search and categories, item options, a cart, a visible price breakdown, and distinct payment states. Its observation log also records important limits: pending QRIS was observed, successful settlement was not; the downloaded QR file was empty; and several optional flows were not completed. Those records do not prove that a payment integration is ready. See [benchmark notes and the historical source](benchmark-notes.md). The original screenshot galleries are retained in Git history rather than shipped with the application.

## Client settings and service choices

The application reads public settings from `config/cafe.json`. Source rules and presets live in `src/config/catalog.mjs`; `src/config/cafe.ts` supplies the validated settings and CSS brand variables.

| Setting | Purpose |
| --- | --- |
| `brand.name`, `shortName`, `description`, `logo` | Client identity |
| `brand.primaryColor` | Brand color, independent of structural theme |
| `theme` | `boxy`, `rounded`, `editorial`, `playful`, or `airy` |
| `modules` | Exact enabled services |
| `venue` | Tenant/outlet route slugs, venue name, address, contact |
| `payment.mode` | `cashier`, `online`, or `both` |
| `timezone` | Outlet time used for dates and reporting |

The CLI accepts the user-friendly theme aliases `boxie`, `roundy`, `fun`, and `loose`.

| CLI preset | Result |
| --- | --- |
| `catalog` | Public menu only |
| `order-at-cashier` | Menu and customer ordering; pay at cashier |
| `order-and-pay` | Menu, customer ordering, online checkout |
| `cashier` | Staff enters orders, discounts, and payments |
| `cashier-kitchen` | Cashier and preparation queues |
| `operations` | Cashier, kitchen, and reports |
| `menu-cashier` | Public menu and cashier; customers order with staff |
| `menu-order-cashier` | Public menu, customer ordering, and full cashier |
| `full` | All available modules |

Use `--modules` for a valid custom combination. Ordering requires the catalog. Payments, kitchen, dashboard, and loyalty require a source of orders: customer ordering or cashier. Module settings should control navigation, direct route access, and server commands. A hidden tab alone does not disable a service.

## Structural theme contract

The root `data-theme` attribute selects a theme in `app/globals.css`. Customer composition rules live in `components/cafe/customer-app.module.css`.

All values below are pixels unless stated otherwise.

| Token | Boxy | Rounded | Editorial | Playful | Airy |
| --- | ---: | ---: | ---: | ---: | ---: |
| `--radius-control` | 2 | 12 | 0 | 18 | 8 |
| `--radius-panel` | 2 | 20 | 0 | 26 | 12 |
| `--radius-image` | 0 | 14 | 0 | 20 | 8 |
| `--card-padding` | 16 | 18 | 16 | 18 | 24 |
| `--section-gap` | 24 | 28 | 32 | 24 | 40 |
| `--border-width` | 1.5 | 1 | 1 | 2 | 1 |
| `--control-height` | 48 | 48 | 48 | 48 | 48 |

Staff controls use the compact staff context, currently 44 px in CSS. The Figma examples keep their main actions at least 48 px. Customer touch actions remain 48 px.

| Theme | Other decisions |
| --- | --- |
| Boxy | Compact grid, straight edges, stronger rules |
| Rounded | Soft panels and balanced grouping |
| Editorial | Serif headings, horizontal menu rows, fine dividers, no panel rounding |
| Playful | Bold headings and outlines; `3px 3px 0 var(--foreground)` panel shadow |
| Airy | Wider gaps, generous padding, open surfaces, lighter heading weight |

Figma uses **Theme variants with one-mode structure tokens**, so choosing from five themes does not require a Figma plan that supports five variable modes in one collection.

### Typography

The body uses **Source Sans 3**; the regular heading family is **Manrope**. The Figma styles include body, small text, caption, label, button, title, section, product, amount, and editorial styles.

The code uses **Georgia** for the editorial system font stack. Georgia is unavailable in the connected Figma font inventory, so the editorial design specimens use **Lora**. This is an explicit font substitution; the serif role and layout are shared, but exact glyph widths differ. Other specimen fonts match the code's declared families.

Keep prices in tabular numerals. Do not shrink a long product title merely to preserve a card height; allow wrapping and check the smallest supported width.

### Brand and color

The default demo brand is **Dapur Pagi**, with `#A94C27` (terracotta) as the primary color. The running demo uses the warm "Kopi Hangat" palette defined in `app/globals.css`:

| Token | Default value |
| --- | --- |
| `--background` | `#FBF8F3` |
| `--surface` | `#FFFFFF` |
| `--foreground` | `#2A1F1A` |
| `--muted-foreground` | `#6B5C52` |
| `--border` | `#E6DCCF` |
| `--border-strong` | `#9A877A` |
| `--primary` | `#A94C27` |
| `--primary-ink` | `#A94C27` for the default brand; derived separately for readable text, icons, and focus indicators |
| `--primary-foreground` | White for the default brand; calculated for each new color |
| `--primary-hover` | Primary mixed with 18% black |
| `--accent-surface` | Primary mixed with 92% white |
| `--surface-muted` | `#F4EEE6` |
| `--overlay` | Foreground mixed at 45% opacity |

The linked Figma primitives align with the terracotta palette; the running application derives its brand colors from the configured primary color.

The configured `--primary` fill remains the client's chosen color. `--primary-ink` preserves that hue and darkens it when needed to reach at least 4.5:1 contrast against white, `#FBF8F3`, `#F4EEE6`, and `#F7F5F1`; use it for brand-colored text, icons, and focus indicators on those light surfaces. `--primary-foreground` independently selects readable black or white text on the primary fill. The Figma brand collection includes `color/primary-ink` with WEB syntax `var(--primary-ink)`, bound to existing primary-colored text and choice indicators. When preparing another client in Figma, set the ink alias to that client's derived value as well as updating the primary fill.

Calculated contrast ratios for the default palette are 5.60:1 for white on the primary color, 6.05:1 for muted text on the background, 15.14:1 for foreground text on the background, and 3.43:1 for `--border-strong` on white. Minimum text size across all components is 12 px (`pnpm lint:design`). A custom logo, image, or manually overridden token needs its own check.
## Component/source map

This is an explicit source map. It does not claim automatic two-way synchronization or published Code Connect mappings.

| Figma family | Node | Code source or composition |
| --- | --- | --- |
| CAFE-C01 / Button, 25 variants | `117:78` | `components/ui/button.tsx` plus root theme tokens |
| CAFE-C02 / Menu item, 10 variants | `117:290` | `customer-app.tsx` and `customer-app.module.css` menu cards |
| CAFE-C03 / Field, default/error | `120:228` | `components/ui/input.tsx`, label, inline error |
| CAFE-C04 / Choice, selected/unselected | `120:237` | Customer item options and choice controls |
| CAFE-C05 / Amount row | `120:238` | `Money` and `PaymentBreakdown` in `ui-primitives.tsx` |
| CAFE-C06 / Quantity | `120:241` | `QuantityControl` in `ui-primitives.tsx` |
| CAFE-C07 / Kitchen ticket | `120:245` | Kitchen section in `staff-app.tsx` |
| CAFE-C08 / Metric | `120:252` | Report section in `staff-app.tsx` |
| CAFE-C09 / Compact menu item | `121:218` | Customer mobile menu card composition |

Button variants cover primary/secondary default, disabled, busy, and focus states across the five themes. Menu variants cover available and sold-out states. The compact card exposes an `Ordering` boolean to remove the add action for catalog-only examples.

The three reusable image components use the exact editable SVG source from:

- `public/images/menu/es-kopi-susu-aren.svg`
- `public/images/menu/croissant-mentega.svg`
- `public/images/menu/matcha-latte-uji.svg`

They are demo illustrations. Replace them with a client's own product images when preparing that client's project.

## Screen and behavior contract

### Customer

The v2 page includes catalog only, table ordering, item options, review/pay at cashier, and order received at **390 × 844**. Catalog-only mode uses a plain instruction to order at the cashier, rather than a nonfunctional checkout button. Item options keep required choices and quantity clear. The review shows all charges before submission.

Maintain the table context through browsing, cart changes, submission, and confirmation. Preserve a cart within its client/outlet scope. An uncertain response must lead to checking the existing order, not an automatic duplicate order. Payment status and preparation status are separate facts.

The original ordering page remains the reference for pending, unknown, and expired payment. An online checkout screen is not proof of settlement. A production adapter must report verified provider events.

### Staff

The new cashier, kitchen, and owner-report frames are **1024 × 768**. The screen examples show only navigation relevant to the example role. A cashier can enter items, change a discount, see the final amount, and take cash. The kitchen can read modifiers and move preparation forward. The owner report labels its period and metric meaning.

Example values are explicitly demo data. Sales, receipts, refunds, tax/service charges, and profit have different meanings. Do not label sales as profit without the relevant cost data.

The runtime also provides compact `ShiftControls` within the cashier package, including cashier-only projects. Opening a drawer, recording cash movements, and closing a shift do not depend on enabling reports. Payment simulations stay in the top exploration controls. QRIS/VA actions disclose simulation beside the method, and pending instructions point to those controls. These compositions share the same radius, border, spacing, and control tokens.

Reports filter by business date using a day, Monday–Sunday week, calendar month, or inclusive custom range. Multi-day periods include a daily table for dates with bills. Billed amounts, payments received, refunds, net receipts, and outstanding balances remain distinct: payments and refunds are current totals on the selected bills, even if transactions occurred outside the selected period. Voided bills are excluded, and CSV exports the same selected bills with localized headers. Shift records in the report are read-only and use the same date range; cash operations remain in the cashier workspace. The current financial report does not claim to calculate profit.

## Verification and limits

The Figma checks confirmed:

- 3 new token collections with 80 variables: 30 primitives, 15 brand semantics, 35 structure semantics.
- 11 shared text styles.
- 9 UI component families, with 44 UI main components/variants in total, and 3 source-art components.
- 5 phone views and 3 tablet views.
- No broken variable aliases, missing WEB code syntax, or `ALL_SCOPES` variables.
- No unfinished placeholder overlays.
- No full-interface raster inside a deliverable frame.
- 634 editable descendant nodes across the five review areas.
- Main type families are Manrope and Source Sans 3; Lora appears only in the declared editorial substitute.

Visual review found and fixed text autosizing, stretched/cropped source illustrations, long action labels, oversized option rows, and a missing product illustration. The final theme, mobile, staff, and service-map views were inspected at readable resolution. The latest code/application checks belong in the project verification report; this design record does not substitute for browser testing, concurrent order testing, or a live payment integration.

Independent browser review also checked the five customer themes at 390 px and identified two tablet cashier problems: truncated table identities and a clipped cash-payment label. Both were corrected. The final focused check at 390 × 844 and 1024 × 768 confirmed no document overflow, no page errors, readable table codes and owners, and an unclipped payment amount. The tablet uses top navigation below 1280 px, compact four-column metrics, and a bill workspace beginning within the first 768 px. The phone uses a compact introduction and keeps full brand and table context visible. The [recorded geometry review](https://github.com/soezyxstt/cafe-template/blob/7fb253d648ebe015fdd82f786de3ea4ae6a793d8/design-runs/2026-10-28/evidence/theme-review/final-review.json) and [final phone/tablet images](https://github.com/soezyxstt/cafe-template/tree/7fb253d648ebe015fdd82f786de3ea4ae6a793d8/design-runs/2026-10-28/evidence/theme-review) remain pinned to the verified revision. Generated evidence is excluded from the reusable source tree.

The connected Figma library is not published with Code Connect. The source map above and semantic WEB token names provide the current handoff. Keep the same IDs and update the source map when changing the actual component contract.



### Overhaul verification, 10 November 2026

Checks ran sequentially on the shared VM. The initial workspace installation overlapped the dev server/browser and the user reported a stall; those processes were stopped. All subsequent computational checks used systemd memory, CPU, process and time limits. Builds/typechecks stayed below 1 GB; automated browser suites stayed around 1.4 GB. The later six-tab interactive simulation peaked at 1.6 GB. No further package installation was needed.

| Check | Result and scope |
| --- | --- |
| Locked workspace installation | Completed with the frozen workspace lockfile. Sonner is also represented in the template npm lockfile used by generated clients. |
| Cafe `test` | Passed configuration/generator, catalog, domain, isolated integration and UI contracts. Includes an actual generated client with retained notification code and a complete npm runtime dependency graph. |
| `test:demo-runtime` | 30 passed: operation serialization, durable acknowledgement, leader handover/uncertain writes, fixture reset, notification deduplication and staff-POS suppression. |
| Typecheck and demo build | Passed with the installed JavaScript TypeScript compiler, followed by the Vite production build. Native compiler was stopped by the task limit; no native compiler check is claimed. Latest operational-header UI-contract recheck: 6 passed. |
| Design tokens | `Design tokens OK` (151 source files). |
| Public catalog and docs | Catalog tests passed; documentation consistency passed. Public metadata/readiness was not promoted. |
| Explorer | Passed responsive toolbar, popup bounds, keyboard/Escape/focus return, QR entry, identity, theme/mode independence, locale, history and reload. |
| Motion | Customer/reduced-motion/preset journeys passed; targeted staff journeys passed 4 checks after waiting for legitimate task-opening animations before testing refresh persistence. |
| Compact UI | 40 passed, including long toast text and a negative overflow control, staff selectors, and five customer themes at phone/tablet/desktop widths. |
| Staff layout | 158 passed at 390–2560px: sidebar/toolbar offsets, hit targets, dialogs, scrolling, resized layouts and injected overlap/overflow defects. |
| All-preset browser | 9/9 passed. Full-service flow additionally passed after final feedback changes: order, second-tab acceptance, nonpayable QR settlement, POS discount, deep bill link, reload, reset and cleared cart. |
| Lifecycle | 12/12 cases passed across capped runs, including prepay/add-ons, pay-later, takeaway, rejection, immediate/deferred refund, split/merge, exception departure, both small ordering packages, waitlist and all 14 scenarios. |
| Cross-tab/audio integration | Passed on the final functional build: concurrent writes/idempotency, native audio confirmation and real-order tone, one new-order event, payment/fulfillment, cash ledger, owner-tab closure, reload, isolated profiles and reset. |
| Language | ID, EN and fallback defaults passed; choice and transaction state persisted through customer/staff navigation and reload. |
| Visual/export | Nine loaded 1280 × 800 previews were inspected and exported to optimized 8:5 WebP files (about 456 KB total). Additional QR/phone, cashier payment, owner and kitchen views were inspected. At 360 × 844, the QR open action ends around 692px and stays above the fixed language control. |

Commands used the documented Cafe scripts or their direct Node equivalent. Bounds were 1.2–1.6 GB / 75% CPU for unit/compile work and 1.8–1.9 GB / 80% CPU for one browser suite at a time. The static preview server was separately limited to 384 MB / 20% CPU; the development server stayed off. Screenshots were resized/exported with the already-installed Sharp dependency, without installing image tools.

Some aggregate diagnostic runs failed on selectors from the old single-page workspace. Those selectors were corrected to navigate the new task views while retaining transaction, state-persistence and animation assertions; affected journeys were rechecked. The final claims above describe the passing command/case coverage rather than claiming that an interrupted diagnostic aggregate run passed.

Evidence remains in `test-results/overhaul-final`, the existing browser-suite reports and the machine's `cafe-overhaul-*.log` files. Preview files keep their stable public paths. These are local built-artifact checks; no deployment, hosted verification or catalog promotion is claimed. Commerce, School and Booking implementations and shared packages were unchanged, so their builds/browser suites were not run.

Independent read-only UI/runtime reviews completed. Their findings were corrected: the operation scope is now `rpc3` to isolate old workers; owner handover retains notification history; fixture resets suppress only their exact order IDs, so a real order in the next snapshot still alerts; separate orders queue separate tones instead of being dropped by a cooldown. The standalone Next.js demo has compact top customer/staff navigation and payment simulation controls, while public exploration remains owned by `DemoToolbarShell`. Production staff entry remains available without adding demo chrome.

The post-review focused unit checks passed 16 cases. A bounded server-render check passed actual standalone customer/staff markup, localized valid routes, payment control availability and separation from browser/production chrome (101 MB peak). The final JavaScript typecheck and Vite build passed in 19.4 seconds at 614 MB peak. The post-review browser chain passed cross-tab/native-audio integration, the responsive explorer and language persistence in 99.8 seconds at 1.4 GB peak. The full runtime recheck passed 30 tests and UI contracts passed 6; design tokens, docs consistency and the 5 public catalog tests passed. One final command used an obsolete catalog-test path; only that command was rerun with the documented `packages/registry/tests/public-catalog.test.mjs` path.


### Map-first visit service, 10 November 2026

Active visits use the published floor plan as their primary surface whenever table management is enabled. The same `FloorMap` renders room geometry, obstacles, table shape/rotation and individually drawn seats in the layout editor. Table labels include the configured seat count. Status text distinguishes clean/ready, occupied, needs cleaning, held for the waitlist, and unavailable; held and unavailable tables also use different stroke patterns. Selection has a ring and check mark, and keyboard Enter/Space selects a table.

On tablet/laptop widths the map sits next to one selected-table inspector. The inspector offers the appropriate operation: seat guests, review departure, clean a vacated table, or reactivate an unavailable table. Reactivation still requires inspection/cleaning. A held table points to the waitlist instead of allowing a walk-in seating operation. Existing server eligibility checks remain authoritative. Secondary visit details, moves and join codes are disclosed on demand. Takeaway completion remains accessible in a separate disclosure. Smaller viewports contain map scrolling locally, with 12px minimum map labels, 44px table hit zones and an enlarge control. Selecting a table below 960px opens its details in the shared dialog; seating and departure review replace the dialog content instead of stacking dialogs. Escape steps back to the table details and then returns focus to the selected SVG table. Physical dimensions in the inspector are shown in centimetres, converted from stored millimetres.

Floor operations place their heading and task navigation on one row when space permits. Table actions use compact shared buttons while retaining 44px touch height; the main departure and bill actions sit together instead of consuming two vertical rows. The layout configuration task is labelled “Atur denah” / “Edit floor plan”. Modes without floor management retain the visit list.

The final JavaScript TypeScript check and Vite demo build passed (22.1s, 656 MB peak); UI contracts passed 6 tests, design-token lint passed 154 files, documentation consistency passed, and public catalog tests passed 5 cases. Browser commands ran sequentially under 80% CPU and 1.9GB memory caps: `CAFE_DEMO_PRESETS=full,operations node --experimental-strip-types tests/demos-staff-layout.mjs` passed 49 checks, covering all nine table selections, chair counts, dimensions, 390–1440px map layouts, 44px hit zones, 12px labels, portrait detail dialogs, Escape/focus return, and two-tab state propagation. The three selected lifecycle cases `prepay-addon-close,takeaway-close,waitlist-customer-staff` passed, including held-table exclusion, occupied → departure → cleaning → ready transitions. `node tests/demos-explorer.mjs` passed the shared controls, QR entry, edit publication in a second tab, language, history and reload. The combined browser gate completed in 147.7s at 1.1GB peak with no page errors or network mutations. A targeted intermediate portrait test exposed a dialog-stacking/Escape conflict; it was fixed by keeping one dialog and the final checks passed. Opus review could not start: Antigravity SS and ST both returned `model_unavailable` for `claude-opus-5-5`; no independent Opus review is claimed. No deployment or catalog promotion is implied.

The final smaller-mode fallback check also passed `external-counter,catalog-waiter` (2/2 cases, 26.9s, 930 MB peak), verifying offline receipts and completion through the retained visit list. Screenshots and reports for this revision are in `test-results/floor-review`, `floor-layout`, `floor-service` and `floor-small-modes`.


### Operational copy, 10 November 2026

The cafe workspace reads like the client application: exploration belongs to the top toolbar. Avoid visible demo/sample badges, simulated-payment commentary, instructions that narrate obvious controls, and descriptions that repeat headings or statuses. Empty states normally use a short heading and a relevant action. The QR entry uses its table selector, QR and open-menu action without introductory paragraphs. Table details rely on status and contextual actions; exceptions and blockers retain short, actionable copy. Financial scope remains where figures would otherwise be ambiguous. Nonpayable payment codes retain only their functional unavailable status. Indonesian and English follow the same density. The toolbar options keep reset consequences and scenario effects, without a general demo explanation.

Copy verification: final JavaScript TypeScript check and Vite build passed (21.2s, 613 MB peak), design tokens passed 154 files, UI/catalog contracts passed 11 tests, and documentation/diff checks passed. The explorer passed responsive QR entry, controls, ID/EN, role/history and reload. Full-preset browser workflow passed 10 checks, followed by 2 lifecycle cases (prabayar/add-ons/closing/cleaning and customer/staff waitlist). Browser work ran sequentially with 80% CPU and 1.9GB memory caps; the final flow run peaked at 1.3GB. Earlier diagnostics expected removed simulation copy and a demo-labelled page title; those assertions now verify the settings controls and cafe identity instead. No runtime failure, deployment or hosted verification is claimed from those diagnostics.

Release CI additionally caught React render/ref and effect-state violations. The follow-up keeps the customer table used by navigation in state, synchronizes notification refs after commit, registers audio listeners only on context creation, resets role-owned UI during the guarded identity transition, loads payment tools from the open event, and keys QR results to their URL. Full ESLint passed without errors (two image-optimization warnings), followed by JavaScript typecheck and Vite build in a serialized capped run (80.9s, 974 MB peak). The initial queued Cafe release was cancelled before deployment so the corrected revision can be released.

Post-fix browser checks passed cross-tab runtime/native audio (8 checks) and the complete explorer in 83.3s at 1.2GB peak. UI contracts also passed 6 tests. An initial runtime check was pointed at the customer entry rather than the staff route; its missing-sound-control timeout was corrected by using `/p/full/staff`, with no application change for that diagnostic.
