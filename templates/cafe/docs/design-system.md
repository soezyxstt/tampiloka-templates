# Cafe template design system

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

The default demo brand is **Dapur Pagi**, with `#1746A2` as the primary color. The running demo uses a cool, high-contrast palette:

| Token | Default value |
| --- | --- |
| `--background` | `#F5F7FC` |
| `--surface` | `#FFFFFF` |
| `--foreground` | `#182334` |
| `--muted-foreground` | `#455468` |
| `--border` | `#C5CEDB` |
| `--border-strong` | `#7A899D` |
| `--primary` | `#1746A2` |
| `--primary-ink` | `#1746A2` for the default brand; derived separately for readable text, icons, and focus indicators |
| `--primary-foreground` | White for the default brand; calculated for each new color |
| `--primary-hover` | Primary mixed with 18% black |
| `--accent-surface` | Primary mixed with 92% white |
| `--surface-muted` | `#E9EEF6` |

The linked Figma primitives reflect the earlier terracotta palette; the running application derives its brand colors from the configured primary color.

The configured `--primary` fill remains the client's chosen color. `--primary-ink` preserves that hue and darkens it when needed to reach at least 4.5:1 contrast against both white and `#F5F7FC`; use it for brand-colored text, icons, and focus indicators on those light surfaces. `--primary-foreground` independently selects readable black or white text on the primary fill. The Figma brand collection includes `color/primary-ink` with WEB syntax `var(--primary-ink)`, bound to existing primary-colored text and choice indicators. The existing Figma default aliases the earlier terracotta primitive; when preparing another client in Figma, set the ink alias to that client's derived value as well as updating the primary fill.

Calculated contrast ratios for the default palette are 8.63:1 for white on the primary color, 7.20:1 for muted text on the background, and 14.74:1 for foreground text on the background. A custom logo, image, or manually overridden token needs its own check.

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

The runtime also provides compact `ShiftControls` within the cashier package, including cashier-only projects. Opening a drawer, recording cash movements, and closing a shift do not depend on enabling reports. The staff order inbox exposes explicitly labeled demo QRIS/VA settlement controls when those demo methods are enabled. These compositions share the same radius, border, spacing, and control tokens.

Reports filter by the selected business date and distinguish billed amounts, payments received, refunds, net receipts, and outstanding balances. They exclude voided bills and export the same date-filtered records to CSV. Shift records in the report are read-only; cash operations remain in the cashier workspace. The current financial report does not claim to calculate profit.

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

