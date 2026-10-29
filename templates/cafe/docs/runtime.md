# Runtime and operational scope

> Catalog update: `--preset catalog` now includes a guest order list and the waiter inbox, with offline payment. Use `--modules catalog` only for a read-only, database-free menu. `order-at-cashier` remains a compatibility alias, not a separate feature tier. See [compact UI and catalog requests](compact-ui.md).

## Public catalog without a database

An explicitly read-only project (`--modules catalog`, or `modules: ["catalog"]`) can serve a real, read-only menu without a database, demo flag, staff login or payment provider. Configure the client, edit `content/menu.json` and `content/tables.json`, and run `npm run dev` or `npm run build` followed by `npm start`. Leave `CAFE_DEMO_DB` unset or `0`. Root and table QR routes use the same public JSON content. Search, category filtering, item details, images, variant prices and local favorites work; ordering, staff access and payment actions remain unavailable.

The default content has `sample: true`. Replace the fictional menu, prices, allergens, hours and facilities with the client's checked content, then explicitly change `sample` to `false`. A brand change alone does not make sample menu data real. Static availability is manually maintained; this mode does not know live stock or table occupancy. Table QR tokens identify public menu links and grant no staff access.

`src/catalog/schema.ts` validates unique IDs and QR tokens, prices in whole Rupiah, category links, variants, modifier limits and safe image URLs. The static snapshot uses an explicit allowlist with no database imports or private records. Invalid content reports its exact JSON field. Use image files under `public/images/` or `public/brand/`, referenced as `/images/...` or `/brand/...`, or a public HTTPS image URL that you have permission to use.

To copy a menu you edited in a running local demo:

```sh
node --experimental-strip-types scripts/export-catalog.mjs --dry-run
node --experimental-strip-types scripts/export-catalog.mjs --overwrite
```

The exporter makes only a GET request to a local server, strips all staff, payment, guest and Wi-Fi data, validates the public result, and writes the two content JSON files. It marks the result as sample content unless you explicitly pass `--sample false`. Existing files require `--overwrite`; inspect the dry run and review the resulting menu before publishing. It does not download images; keep referenced local image files in the client's `public/` folder.

## Transactional demo runtime

The bundled ordering and staff runtime is a local demo with a persisted PGlite database. `npm run demo` prepares its schema, then starts Next.js with `CAFE_DEMO_DB=1`. The default data directory is `.local/<outletSlug>/cafe-db`; `CAFE_DEMO_DATA_DIR` can override it. Generated client projects explicitly use `.local/cafe-db` inside their own folder. Branding comes from `config/cafe.json`.

The menu, server-priced cart, order inbox, cashier, kitchen queue, table tools, stock editing, receipt math and reporting use the same database. Refreshing the page keeps data. Customer and staff tabs on the same server see each other's changes after refresh or polling. Payment QR codes and virtual accounts are **simulators** and cannot receive money.

Set `CAFE_DEMO_EMPTY=1` before the first run for a clean demo. This keeps the fictional sample menu and tables, removes seeded sample orders, and opens a zero-balance demo cash shift when the cashier module is enabled. It does not erase a database that already exists. For an existing demo use the explicit reset action, or set a new `CAFE_DEMO_DATA_DIR`.

## Package enforcement

`src/domain/capabilities.ts` applies module checks before API commands. Disabling a module removes its navigation and rejects its API commands. Cashier-only still receives catalog data internally. Customer quoting needs `ordering`; staff POS quoting needs `cashier`. An ordering-only package has a staff inbox and can finish orders without a cashier screen or dedicated kitchen screen. Cash and manual-transfer recording need `cashier`; online instruction creation needs `payments`. The module checks do not replace authentication.

Customer snapshots use an allowlist and include the selected table's active visit plus the current demo guest's own order history. A new guest does not inherit a departed party's orders when a table is reused. Private waitlist status is retrieved through the guest's own ticket token. Customer snapshots omit staff accounts, session assurances, audit events, cash shifts, stock movements and other guests' member records. The demo surface selector is not an access token. Treat every person who can access the demo server as a trusted demo participant.

The ordering-only `catalog` preset and its `order-at-cashier` compatibility alias accepts an explicit external-counter payment confirmation with a receipt reference. It does not expose POS or change an application cash drawer. Packages with cashier or online-payment modules use their respective payment controls instead.

## Visit lifecycle

The [lifecycle guide](lifecycle.md) documents seating, payment policy, fulfillment, departure, table cleaning and reproducible test data. Backend transactions serialize changes per outlet so seating, acceptance, payment and departure cannot read an outdated lifecycle state during concurrent requests. Normal departure requires zero outstanding balances/refunds, no active payment instructions, no pending order requests, and all food/service requests completed. An explicit manager/owner exception records physical departure while retaining obligations for follow-up.

Order payment labels resolve current unit allocations, including split and merged bills. They never infer payment from another order at the same table. Closed visits invalidate participant admission and join codes. Quotes are bound to the seating generation, preventing an old cart review from silently entering a new party's visit.

## Monetary and order behavior

Prices are whole Indonesian Rupiah. Quotes take current menu/variant/modifier prices from the server. The server checks required choices, item availability, quantity limits and combined stock use for variants that share a stock pool. Cashier discounts must be a whole Rupiah value between zero and subtotal; the cashier chooses a manual discount or a promo code, not both. Service and tax additions use the outlet settings; an inclusive-price setting adds no further charges. This template does not calculate a statutory tax return or a cost-of-goods profit report.

Quote submission checks the guest, table, order type and catalog/policy versions. A unique order-request key and quote key prevent double submissions. Accepting the same request twice returns the existing order. Staff admission locks stock rows; an external payment attempt blocks a second tender until the first attempt ends. Cash payments reject insufficient tender, non-integer amounts, zero amounts and amounts above the balance. Partial payment leaves the rest due. Payment settlement and its receipt commit together.

## Live launch boundary

The existing repository used browser-only demo PINs, fictional accounts and an unsigned webhook. Those cannot protect a real cafe. The explicit read-only catalog described above can run live. The new `catalog` preset includes requests and therefore has the transactional launch requirements below. Transactional and staff flows fail with `LIVE_ADAPTER_REQUIRED` outside explicit demo mode instead of seeding or exposing a real PostgreSQL database. The webhook returns `PAYMENT_PROVIDER_NOT_CONFIGURED` and never marks a bill paid.

Before taking real customer orders, add and verify:

- Server-side staff sessions, role checks and customer sessions bound to an outlet/table.
- Tenant/outlet isolation for all database reads and mutations; the current fixture is one client per database.
- A real payment provider account, signed webhook verification, amount/account matching and replay handling only when online payments are enabled. Offline waiter-request packages still need authenticated staff, private shared storage and durable receipts.
- Production migrations, backups, monitoring and recovery for failed writes.
- A real member login/OTP provider if loyalty is part of the package.

These are integration boundaries, not hidden options enabled by a CLI flag. Do not advertise a payment demo as a live payment system. Existing fixture names, menu prices, transactions and staff identities are sample content.

## Verification

Run `npm run typecheck` and the project test commands. Catalog validation tests run with `node --experimental-strip-types --test src/catalog/static-catalog.test.ts`. Domain tests cover package gates, receipt math, forward kitchen transitions, pricing/stock rules and safe exports. The integration suite uses a temporary, isolated database; it does not reset a client demo. The browser verification record describes the customer and staff flows actually exercised for this revision.
