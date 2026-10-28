# Public preset demos

The [demo hub](https://cafe.tampiloka.site) is a client presentation portfolio for the reusable template. It compares nine service packages, shows five independent component themes, and links to working customer and staff experiences.

## Addresses and scope

| CLI preset | Address | What to demonstrate |
| --- | --- | --- |
| `catalog` | [cafe-catalog.tampiloka.site](https://cafe-catalog.tampiloka.site) | Searchable menu, item details and QR entry; no customer ordering or staff workspace |
| `order-at-cashier` | [cafe-order.tampiloka.site](https://cafe-order.tampiloka.site) | Customer order submission and a staff inbox; payment is handled outside online checkout |
| `order-and-pay` | [cafe-pay.tampiloka.site](https://cafe-pay.tampiloka.site) | Customer order, staff acceptance and simulated online settlement |
| `cashier` | [cafe-pos.tampiloka.site](https://cafe-pos.tampiloka.site) | Staff-entered order, discount, cash payment, change and cash shift |
| `cashier-kitchen` | [cafe-kitchen.tampiloka.site](https://cafe-kitchen.tampiloka.site) | Counter orders and kitchen/bar preparation queues |
| `operations` | [cafe-operations.tampiloka.site](https://cafe-operations.tampiloka.site) | Cashier, kitchen and date-filtered sales/receipt reports |
| `menu-cashier` | [cafe-menu-pos.tampiloka.site](https://cafe-menu-pos.tampiloka.site) | Customer browsing and staff POS; customer ordering remains disabled |
| `menu-order-cashier` | [cafe-menu-order-pos.tampiloka.site](https://cafe-menu-order-pos.tampiloka.site) | Table ordering and a full cashier workspace |
| `full` | [cafe-full.tampiloka.site](https://cafe-full.tampiloka.site) | The complete customer and staff workflow, including tables, loyalty and promotions |

Add `/staff` to any package that includes staff functions. The public root opens the customer view when catalog is enabled, or the staff view for staff-only packages. Every package has an independent hostname and database scope. The catalog package reads validated public menu JSON without initializing a database.

Themes are intentionally varied across packages: editorial for the catalog, rounded for table ordering, airy for online checkout, boxy for POS/operations, and playful for cashier/kitchen. The hub previews all five treatments. A theme does not change which service modules are enabled.

## Present a connected workflow

1. Open the [full-service demo](https://cafe-full.tampiloka.site) on your presentation computer. Use a narrow browser window or device preview for the customer screen.
2. Open its **Staf** link in another tab in the same browser. Choose an available demo role. The sample role buttons and PINs are presentation controls; they do not represent production authentication.
3. In the staff toolbar, expand **Data untuk mencoba alur operasional**, choose **Mulai dari kafe kosong**, and load the scenario. Open **Meja & Antrean → Tempatkan tamu** to start a visit before ordering.
4. Open the customer's table QR link in the other tab. Choose an item, select its options, add it to the cart, enter a customer name and submit the reviewed order. A valid table QR does not require location permission again.
5. In the staff tab, accept the incoming order. Show the resulting order and bill. Under the default PREPAY policy, preparation remains held until payment settles.
6. Return to the customer bill and start the simulated online payment. The QR is explicitly nonpayable. Use the staff demo payment controls to settle that attempt and show the updated bill. Under PAY_LATER, preparation may begin before settlement.
7. Advance the kitchen/bar items through preparing, ready and delivered. Add another customer order to demonstrate its own unpaid bill within the same visit. The cashier can also enter multiple items, apply a discount, take a partial cash payment and calculate change.
8. Use **Tinjau kepulangan** to show the remaining obligations. Confirm departure once all food, payments and service requests are resolved. Mark the table clean before seating the next party.
9. Use **Ulangi** to restore the sample state, or load one of the 14 scenarios to jump to a particular operational condition.

For a smaller package, demonstrate only the included steps. `order-at-cashier` has an inbox without full POS; `menu-cashier` lets guests browse without placing their own orders. Reports show sales, receipts, refunds and outstanding amounts. They do not estimate operating costs or profit.

The ordering-only inbox can confirm payment handled by an external cashier using a receipt reference, finish food delivery and close its visit. Table cleaning controls appear only when the table-service module is enabled. See the [complete lifecycle, mock-data matrix and regression commands](lifecycle.md).

## How public sessions work

Transactional demos run the existing database schema, seed data and domain service inside a browser worker. PGlite persists the data to IndexedDB. The browser fetch adapter handles the application's snapshot, quote and command calls locally; Cloudflare Pages serves the static application assets. No hosted transaction database or payment-provider account is connected to the public showcase.

Customer and staff tabs at the same preset address share one session within the same browser profile. Reloading preserves the data. Separate visitors, browser profiles, devices and preset subdomains have separate databases. Sharing a bill URL with a different device does not transfer its local bill. For a demonstration across two physical devices, use the original Next.js demo server with both devices connected to that server; see [local demo setup](../README.md#start-the-supplied-demo).

The worker serializes complete domain operations and shares database ownership across tabs. The generated SQL in `src/demo-runtime/schema.generated.ts` is checked against the Drizzle schema. The source application continues to use its server database adapter; the Pages build replaces only the environment adapters.

Version 0.3.1 starts a new local demo storage generation so a tab left open on the earlier version cannot execute old lifecycle rules for the updated interface. Previous demonstration records are not migrated into this generation. New customer/staff tabs share the updated dataset, and committed commands notify peer tabs immediately with polling as a fallback.

Use a current browser with Web Workers, Web Locks, BroadcastChannel and IndexedDB, over HTTPS or localhost. Browser storage must be available. Private browsing, storage limits or clearing site data can remove demo changes. The first transactional visit downloads the database engine and sample state; subsequent operations use the local copy. The hub and catalog do not wait for that engine.

All data is fictional demonstration content. Payment simulation never collects money. A real client transaction deployment still needs the authentication, database and provider integrations described in the [runtime guide](runtime.md).

## Develop the showcase

These commands belong to the source template repository. CLI-generated client projects exclude the showcase source, its tests, deployment commands and six showcase-only development dependencies.

```sh
npm ci
npm run demos:dev
```

Open `http://localhost:4173`. Local links use `/p/<preset>/` and `/p/<preset>/staff`, so every package can be tested without custom DNS. The same paths work on a Pages preview hostname. Canonical preset hostnames select their own preset regardless of the path.

Build and inspect the static output:

```sh
npm run demos:build
npm run demos:preview
```

To exercise the actual Pages asset server and headers locally:

```sh
npx wrangler pages dev dist-demos --port 4174
```

The main files are:

| File | Responsibility |
| --- | --- |
| `demos/manifest.ts` | Preset names, subdomains, component themes and local route mapping |
| `demos/components/demo-portal.tsx` | Package cards, comparison table and theme previews |
| `demos/config.ts` | Browser-only preset configuration |
| `demos/workspace.tsx` | Demo toolbar, customer/staff entry and reset |
| `demos/vite.config.mts` | Static build and environment adapter substitutions |
| `src/demo-runtime/` | Browser persistence, worker, request adapter and generated schema |
| `demos/public/_headers` | Content policy, no-index directive and asset caching |
| `wrangler.jsonc` | Pages project name and build output directory |

Build output, browser evidence and local Wrangler state are ignored. Do not commit `dist-demos/`, `test-results/` or local databases.

## Cloudflare Pages deployment

The Pages project is **`tampiloka-cafe-demos`**, connected to `soezyxstt/cafe-template`. Its default hostname is `tampiloka-cafe-demos.pages.dev`. The demo hub and nine package domains point to that project using proxied CNAME records. Hostname selection happens in the application, so one build updates all ten addresses together.

| Setting | Value |
| --- | --- |
| Production branch | `main` |
| Build command | `npm run demos:build` |
| Build output | `dist-demos` |
| Root directory | `/` |
| Node version | `22` (minimum supported locally: 22.12) |
| Automatic production deployments | Enabled |
| Automatic preview deployments | Disabled |

Merging a verified change into `main` triggers the Pages build. Review the deployment status and the public domains after a release. The application uses Pages' native single-page application fallback for `/staff`, QR and local preview paths; there is no top-level `404.html` or wildcard rewrite rule.

For a manual deployment from an already authenticated Cloudflare CLI environment:

```sh
npm run demos:deploy
```

This rebuilds the showcase and deploys to the same project. Keep production publication on a reviewed `main` checkout. No merchant keys, database credentials or client data belong in the static build.

## Verify changes

```sh
npm run typecheck
npm run lint
npm test
npm run test:demo-runtime
npm run build
npm run demos:build
```

Run both browser suites against an automatically started local preview of the built artifact:

```sh
npx playwright install chromium
npm run test:demo-all
```

Run the same package checks against the deployed domains:

```sh
CAFE_DEMO_BASE_DOMAIN=tampiloka.site npm run test:demo-browser
CAFE_DEMO_BASE_DOMAIN=tampiloka.site npm run test:demo-lifecycle
```

The suites use isolated browser contexts and first check that transactional snapshots are marked `localOnly` before creating fictional orders. They write evidence to ignored `test-results/demos/` and `test-results/lifecycle/`. Individual suites also support an already running preview through `CAFE_DEMO_BASE_URL`; the default is `http://127.0.0.1:4174`. CI runs both browser gates and retains their JSON and screenshots as an artifact. Read the [verification record](verification.md) for recorded results; a build passing alone is not evidence that the interactive flows work.
