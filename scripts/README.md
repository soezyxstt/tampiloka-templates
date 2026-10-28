# Scripts and local verification

Run these commands from the project root using Node.js **22.6 or newer**. Install the lockfile's dependencies with `npm ci`. GitHub Actions uses Node.js 22.

## Start a transaction demo

```sh
npm run demo
```

`run-demo.mjs` prepares the PGlite schema, then starts Next.js with `CAFE_DEMO_DB=1`. Arguments after `--` reach Next.js:

```sh
npm run demo -- --port 3001
```

Open `/demo` for the theme preview, table QR downloads, customer/staff links, and client setup command. Open `/` for the public customer page when catalog is enabled. Staff routes use `/staff/<tenantSlug>/<outletSlug>` from `config/cafe.json`.

The runner works on Windows, macOS, and Linux without shell-specific environment assignment. It forwards termination signals to its child process. Installation and Google font downloads during build need network access; this is a local transaction demo, not an offline synchronization implementation.

### Database location and preparation

The fallback data directory is `.local/<outletSlug>/cafe-db`, resolved from the project root. `CAFE_DEMO_DATA_DIR` overrides it. CLI-generated clients explicitly use `.local/cafe-db` inside their own project directory. All of these local data directories are ignored by Git.

Use **one running server per database directory**. Stop that server before preparing its schema, copying its data, or choosing a new directory.

```sh
npm run demo:prepare
```

`prepare-demo-db.ts` loads `.env.local` and `.env`, creates the chosen directory, and applies the demo schema. It refuses schema changes that would remove data. It does not start a web server or create the seed itself; the first application request seeds an empty database.

To use `npm run dev` directly with a prepared demo, put this in `.env.local`:

```dotenv
CAFE_DEMO_DB=1
CAFE_DEMO_DATA_DIR=.local/cafe-db
```

For a clean new client demo, also set `CAFE_DEMO_EMPTY=1` **before the first request to a fresh database**. This retains the sample menu and tables but omits sample sales. Cashier packages receive an empty open cash shift. It does not erase existing orders. To preserve an existing demo while starting another, stop the server and select a different data directory.

`npm run demo` always opts into demo mode. For a real menu-only deployment, use the commands in the next section instead.

### Scope of demo access

PINs and quick role switches are browser demo controls, not server authentication. Payment QR data uses a nonpayable `cafe-demo://` URI; successful settlement is simulated. Every person who can reach the server must be a trusted demo participant. The [runtime guide](../docs/runtime.md) describes the server module gates and the adapters needed before live orders.

## Validate and run a public catalog

With exactly `modules: ["catalog"]`, leave `CAFE_DEMO_DB` unset or `0`:

```sh
npm run catalog:validate
npm run dev
```

This reads `content/menu.json` and `content/tables.json` without opening a database. Stop development before using the production server:

```sh
npm run build
npm start
```

`validate-catalog.mjs` checks the public content schema, item/category relationships, variants, modifier choices, integer Rupiah prices, image URLs, and unique table QR tokens. Invalid fields are reported with their JSON path. Review client facts and image rights separately; structural validation cannot verify those facts. Rebuild a production deployment after content changes.

### Export a demo menu

Keep the local demo running and use another terminal:

```sh
npm run catalog:export -- --url http://127.0.0.1:3000 --out content --dry-run
npm run catalog:export -- --url http://127.0.0.1:3000 --out content --overwrite
```

`export-catalog.mjs` sends a GET request to the public customer snapshot. Only local origins (`localhost`, `127.0.0.1`, or `[::1]`) are accepted. It writes an explicit public allowlist to `menu.json` and `tables.json`, excluding orders, staff, guests, payment accounts, and Wi-Fi credentials. Existing files require `--overwrite`; `--dry-run` writes nothing. Use a new output directory to compare files before replacing the client content.

Exports default to `sample: true`. Use `--sample false` only after checking the exported menu for the client. The command does not copy/download images, so retain referenced assets in the client's `public/` directory. See [content editing](../content/README.md).

## Client CLI

```sh
npm run cafe -- --help
npm run cafe -- presets
npm run cafe -- themes
npm run cafe -- modules
npm run cafe -- doctor
```

`cafe.mjs` supports `init` for a separate project, `configure` for existing public settings, and `doctor` for local configuration checks. The canonical menu-only preset is `catalog`. The CLI refuses an existing destination and validates before copying. It excludes credentials, dependencies, local databases, Git history, and generated output. Detailed flags and package dependencies are in [client setup](../docs/client-setup.md).

## Verification

The normal repository checks are:

```sh
npm run typecheck
npm run lint
npm test
npm run build
```

The CI workflow runs these commands after `npm ci`. It does not need live database/payment credentials, run optional browser suites, publish a deployment, or modify a client database.

| Command | Coverage and prerequisites |
| --- | --- |
| `npm run test:config` | Configuration, module combinations, preset/theme rules, CLI output, dry runs, and safe client copying. |
| `npm run test:catalog` | Public content validation, static snapshot construction, and export allowlists. Fixtures are separate from the client's editable menu. |
| `npm run test:domain` | Price/receipt calculations, stock aggregation, module gates, and preparation transitions. |
| `npm run test:integration` | Server commands against a temporary isolated PGlite database, including orders, discounts, stock, and settlement. The suite cleans up its own database. |
| `npm test` | Runs the four suites above; no running application server is needed. |
| `npm run test:presets` | Creates temporary CLI-generated clients, starts isolated servers, and checks package pages and APIs, payment flows, and a catalog without demo/database credentials. Requires available local ports. |
| `npm run test:browser` | Exercises an already running full-service demo through Playwright. Requires Chromium and creates test transactions in that demo. |

### Temporary client checks

```sh
npm run test:presets
npm run test:presets -- --static-only
npm run test:presets -- --presets order-and-pay,cashier --skip-static
```

`tests/preset-integration.mjs` shares installed dependencies through a temporary link, uses separate client configurations and database directories, stops its servers, and removes its temporary projects. It does not rewrite the current project's config or reset its demo database. `--static-only` checks public catalog/QR pages and blocked staff/transaction access with no database created.

### Browser checks

Install Chromium once:

```sh
npx playwright install chromium
```

Start a full-service demo with its supplied sample menu. Prefer a separate demo data directory for browser testing. Then, in another terminal:

```sh
npm run test:browser
```

`tests/browser-workflows.mjs` uses `http://127.0.0.1:3000` by default. `CAFE_TEST_URL` selects another running demo; `CAFE_CHROMIUM_EXECUTABLE` can select an installed Chromium executable. It refuses mutation when the snapshot is not explicitly a demo. On Linux, missing browser system libraries may require Playwright's dependency installation in the test environment.

The suite checks customer search, table QR entry, order submission, staff acceptance, simulated online payment, bill sharing, multi-item POS with discount, and theme layouts. It checks for page errors and broken images, and writes screenshots plus `browser-workflows.json` under `design-runs/2026-10-28/evidence/`. This is the script's current output location. It creates named demo orders and payments and does not reset that database.

These commands describe repeatable checks. A successful test run is evidence for the exercised paths, not proof of production authentication or real payment settlement. Archived benchmark screenshots and older verification notes are historical references; they are not the current CI result.
