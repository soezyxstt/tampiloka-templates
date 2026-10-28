# Cafe Template

> Catalog update: `--preset catalog` now includes a guest order list and the waiter inbox, with offline payment. Use `--modules catalog` only for a read-only, database-free menu. `order-at-cashier` remains a compatibility alias, not a separate feature tier. See [compact UI and catalog requests](docs/compact-ui.md).

A reusable cafe website and operations template with independent choices for **brand identity**, **component style**, and **service scope**. Customer screens start with phone layouts; staff workspaces prioritize tablets and desktop screens. The application currently uses Indonesian copy, integer Indonesian Rupiah prices, and a configurable outlet timezone.

There are three runtime paths:

| Runtime | What you can use now |
| --- | --- |
| Public menu catalog | Publish a client's checked menu and table QR links from local JSON files. No database, staff login, or payment account is required. |
| Ordering and staff demo | Demonstrate customer ordering, POS, kitchen, tables, payments, and reports using a persisted local database. Staff access and online settlement are demo implementations. Live transactions require the adapters described below. |
| Public preset showcase | Share all nine preset demos on Cloudflare Pages. Each visitor gets a separate database in their browser; customer and staff tabs at the same preset address share that visitor's data. |

## Show the demos to clients

The full demo includes explicit guest seating, a guarded departure checklist, separate table cleaning, and 14 reproducible mock scenarios. Open the staff workspace and expand **Data untuk mencoba alur operasional** to choose a starting point. See the [visit lifecycle and test-data guide](docs/lifecycle.md) for the complete customer/cashier/kitchen flow.

Start at **[cafe.tampiloka.site](https://cafe.tampiloka.site)** to compare packages and component themes. Every preset has a dedicated address, and each applicable demo offers customer and staff views. The customer layout starts on phones; the staff workspace starts on tablets and desktops.

| Preset | Client demo |
| --- | --- |
| Menu catalog | [cafe-catalog.tampiloka.site](https://cafe-catalog.tampiloka.site) |
| Order, pay at the counter | [cafe-order.tampiloka.site](https://cafe-order.tampiloka.site) |
| Order and pay | [cafe-pay.tampiloka.site](https://cafe-pay.tampiloka.site) |
| Cashier | [cafe-pos.tampiloka.site](https://cafe-pos.tampiloka.site) |
| Cashier and kitchen | [cafe-kitchen.tampiloka.site](https://cafe-kitchen.tampiloka.site) |
| Cafe operations | [cafe-operations.tampiloka.site](https://cafe-operations.tampiloka.site) |
| Menu and cashier | [cafe-menu-pos.tampiloka.site](https://cafe-menu-pos.tampiloka.site) |
| Menu, orders and cashier | [cafe-menu-order-pos.tampiloka.site](https://cafe-menu-order-pos.tampiloka.site) |
| Full service | [cafe-full.tampiloka.site](https://cafe-full.tampiloka.site) |

The demos use fictional sample data and cannot collect money. Open customer and staff views in the **same browser at the same demo address** to demonstrate their connected workflow. Separate devices or browsers have separate sessions. Changes survive a page reload; **Ulangi** resets that preset for your browser. The first transactional visit downloads and initializes its local database.

See the [showcase guide](docs/demos.md) for a presentation walkthrough, local development, browser requirements, and Cloudflare Pages deployment. New client projects created by the CLI exclude the portfolio and its Vite/Wrangler dependencies.

## Start the supplied demo

Use Node.js **22.12 or newer** and npm. From this repository:

```sh
npm ci
npm run demo
```

The runner prepares a local PGlite database and starts Next.js. A hosted database or payment-provider account is unnecessary for this demo. Dependencies and Google fonts need network access during installation/build.

| Page | Default URL |
| --- | --- |
| Customer menu | <http://localhost:3000> |
| Demo studio | <http://localhost:3000/demo> |
| Staff workspace | <http://localhost:3000/staff/dapur-pagi/dapur-pagi> |

The demo studio previews all five themes, opens customer and staff views, generates a client setup command, and downloads table QR codes. A theme preview does not change the saved client configuration. For phone testing, open the studio through a domain or LAN address reachable from the phone before generating its QR code; the phone cannot use your computer's `localhost`.

Open customer and staff views side by side. Submit a customer order, receive it in the staff inbox, advance preparation, and review the bill. The cashier supports multi-item orders, options, notes, a manual discount, partial payments, cash received, and change. Online checkout produces a **nonpayable demo QR**; the staff simulation controls complete, expire, or cancel the attempt.

### Demo staff access

The staff screen offers quick role buttons and these sample PINs. They are browser demo controls, **not server authentication**. Anyone who can reach the demo server must be a trusted demo participant.

| Sample person | Role | PIN |
| --- | --- | --- |
| Raka Pratama | Owner | `1111` |
| Nadia Kusuma | Manager | `1111` |
| Sinta Maharani | Cashier | `2222` |
| Dimas Saputra | Waiter | `4444` |
| Fajar Nugraha | Bar | `3333` |
| Budi Santoso | Kitchen | `3333` |

Available roles and sections depend on the selected modules. For another port, run `npm run demo -- --port 3001`.

Data persists between restarts. The default directory is `.local/<outletSlug>/cafe-db`; `CAFE_DEMO_DATA_DIR` can override it. Run only one server against a database directory. See [script and database instructions](scripts/README.md) before preparing or resetting an existing demo.

## Create a client project

Run this from the template directory. The destination must not already exist.

```sh
npm run cafe -- init ../kopi-senja --name "Kopi Senja" --short-name KS --slug kopi-senja --preset menu-order-cashier --theme editorial --color "#173E35" --yes
cd ../kopi-senja
npm ci
npm run cafe -- doctor
npm run demo
```

Omit `--yes` in a terminal for interactive choices. Add `--dry-run` to preview a configuration without creating files. The CLI copies application code, public assets, content, scripts, tests, and docs, and sets the client's identity and route slugs. Dependencies, Git history, secrets, local databases, and generated output are excluded.

Each client has its own project and database. Generated transaction demos start with sample menu items and tables, no sample sales, and an empty cash shift when cashier is enabled. Their `.env.local` sets `CAFE_DEMO_EMPTY=1` and a project-local database directory. This flag affects new databases; it does not delete existing orders. Generated `catalog` projects use the database-free path instead.

### Nine service presets

```sh
npm run cafe -- presets
npm run cafe -- modules
```

| Preset | Included experience |
| --- | --- |
| `catalog` | Public menu and table QR entry |
| `order-at-cashier` | Menu, customer ordering, and a staff inbox; payment is handled outside online checkout |
| `order-and-pay` | Menu, customer ordering, and online checkout simulation |
| `cashier` | Staff POS, discounts, bills, payments, and cash shifts |
| `cashier-kitchen` | Cashier plus preparation queues |
| `operations` | Cashier, kitchen, and sales reports |
| `menu-cashier` | Public browsing plus staff POS; customers place orders with staff |
| `menu-order-cashier` | Public menu, customer ordering, and full cashier |
| `full` | All nine modules, including tables, loyalty, and promotions |

`order-at-cashier` includes the inbox needed to receive and finish orders without the full POS. Online-payment presets expose simulation controls even when cashier is absent. Reports distinguish billed sales, receipts, refunds, and outstanding amounts; they do not calculate profit or operating costs.

For another combination, use an exact module list:

```sh
npm run cafe -- init ../custom-cafe --name "Custom Cafe" --modules catalog,ordering,cashier,kitchen,tables --theme rounded --yes
```

The CLI validates dependencies, and server commands enforce the enabled modules. For example, ordering requires catalog; payments, kitchen, dashboard, and loyalty require ordering or cashier. Cashier can run without a public menu. See the [complete package rules](docs/client-setup.md#choose-a-custom-scope).

### Five component themes

| Theme | Component treatment |
| --- | --- |
| `boxy` | Square edges, compact spacing, clear borders |
| `rounded` | Soft corners and balanced spacing |
| `editorial` | Serif headings, open menu rows, fine rules |
| `playful` | Strong borders, expressive type, offset shadows |
| `airy` | Loose spacing, lighter surfaces, minimal borders |

The aliases `boxie`, `roundy`, `fun`, and `loose` are accepted. Theme selection changes shape, spacing, typography, and composition independently from the brand color.

Change an existing client's public settings with the CLI:

```sh
npm run cafe -- configure --theme airy --color "#173E35" --logo-file ../assets/kopi-senja.svg --yes
```

This example expects your logo file to exist. You can also place a logo in `public/brand/` and set `--logo /brand/logo.svg`. Restart development or rebuild after changing configuration. `configure` changes public settings; it does not migrate stored data or rewrite environment files.

| File | Client-specific content |
| --- | --- |
| `config/cafe.json` | Brand, theme, modules, route slugs, contact details, timezone, payment mode |
| `content/menu.json` | Public catalog items, categories, variants, options, prices, hours, and facilities |
| `content/tables.json` | Public table labels and QR tokens |
| `public/brand/`, `public/images/` | Logo and menu images |
| `.env.local` | Server runtime settings; never commit credentials |

The configuration and content JSON files are public. Keep private credentials out of them.

## Publish a real menu catalog

Create an exact `catalog` project:

```sh
npm run cafe -- init ../menu-client --name "Kopi Senja" --modules catalog --theme editorial --yes
cd ../menu-client
npm ci
npm run dev
```

Edit `content/menu.json` and `content/tables.json`, and put client images in `public/`. Replace the fictional menu, prices, allergens, hours, facilities, and photos. After checking the content with the client, change the menu's `sample` flag to `false`. Static availability is maintained manually.

Stop the development server, then validate and build:

```sh
npm run catalog:validate
npm run cafe -- doctor
npm run build
npm start
```

Leave `CAFE_DEMO_DB` unset or `0`, with exactly `modules: ["catalog"]`. This runs a Next.js server using the public JSON catalog, without database credentials or transaction access. Rebuild after changing content for a production deployment. A table link uses the client's deployed domain followed by `/t/<tenantSlug>/<outletSlug>/m/<qrToken>`.

If you configured a menu in the local demo first, export it from another terminal:

```sh
npm run catalog:export -- --dry-run
npm run catalog:export -- --overwrite
```

The exporter reads only a local server and copies public menu/table content. It excludes staff, guests, transactions, and credentials. Images are not copied, and the output remains marked as sample content until you explicitly review it. See [content editing](content/README.md) for schema and export details.

## Before live ordering or payments

All transactional packages currently require explicit demo mode. Enabling a module does not provision a merchant account or production infrastructure. Outside demo mode, unsupported transaction paths are blocked with `LIVE_ADAPTER_REQUIRED`, and the unsigned payment webhook never settles a bill.

Live transactions require server-authenticated staff and customer sessions, enforced role/outlet permissions, a private production database with migrations and backups, and a real payment-provider adapter with verified webhooks. Loyalty also needs a real member login/OTP provider. The current database fixture assumes one client per database.

The [runtime guide](docs/runtime.md) explains this boundary, data visibility, stock handling, quote validation, payment behavior, and receipt calculations. Keep demos separate from live customer operations.

## Development and verification

```sh
npm run typecheck
npm run lint
npm test
npm run build
```

`npm test` runs configuration/CLI, catalog, domain, and isolated database integration tests. It does not require an existing demo server or reset a client database. GitHub Actions runs these checks on Node.js 22.

Optional suites are `npm run test:presets` for temporary client projects across service packages, and `npm run test:browser` for the running full-service demo. Browser checks need Playwright Chromium and create demo orders and payments; use a dedicated test demo. See [verification commands](scripts/README.md#verification) for setup and output locations.

Built with Next.js, React, TypeScript, Tailwind CSS, Drizzle, and PGlite/PostgreSQL. PostgreSQL plumbing is present; supplying its credentials alone does not enable live transactions.

## Design and documentation

The editable [Cafe Template v2 Figma kit](https://www.figma.com/design/eXWI36xzNr8gtLBxFW0G6r/Design-Kit?node-id=116-43) contains the theme comparison, customer and staff references, components, and service map. [Design-system documentation](docs/design-system.md) maps the kit to implementation files and records differences. This is an explicit shared design contract; it does not provide automatic two-way Figma synchronization.

- [Client setup, branding, presets, and CLI reference](docs/client-setup.md)
- [Public demos, presentation walkthrough, and Cloudflare Pages](docs/demos.md)
- [Public catalog content](content/README.md)
- [Runtime and live integration requirements](docs/runtime.md)
- [Scripts, local database, and verification](scripts/README.md)
- [Design system and Figma source map](docs/design-system.md)
- [Verification results and screenshots](docs/verification.md)
- [Benchmark notes and historical source](docs/benchmark-notes.md)
