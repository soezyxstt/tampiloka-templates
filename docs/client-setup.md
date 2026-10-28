# Create a client demo

The template has one public configuration file, `config/cafe.json`. Service modules decide what a client gets. The theme decides how components look. Brand identity stays separate from both. A menu-only client can serve static content without a database. Ordering and staff transactions currently use the demo runtime.

Use Node.js 22.6 or newer. Use a separate project directory, database, and deployment for each client.

## Start the supplied demo

```bash
npm ci
npm run cafe -- doctor
npm run demo
```

Open `http://localhost:3000`. For another port:

```bash
npm run demo -- --port 3001
```

`demo` prepares a local PGlite database, then runs Next.js. It works without a hosted PostgreSQL account. The runner passes demo mode through Node rather than a shell command, so the same command works on Windows, macOS, and Linux.

Without an explicit data path, demo data persists in `.local/<outletSlug>/cafe-db`. CLI-generated transactional clients set `CAFE_DEMO_DATA_DIR=.local/cafe-db` in their own `.env.local`. Stop the app before copying or deleting either directory. For a fresh demo, select a new `CAFE_DEMO_DATA_DIR` in `.env.local`. Do not use a live client's database for demo resets.

## Create the next client

Run the CLI from the template repository. Put the new client beside the template, not inside it.

```bash
npm run cafe -- init ../kopi-senja \
  --name "Kopi Senja" \
  --preset order-at-cashier \
  --theme editorial \
  --color '#364D3C' \
  --address "Jl. Contoh No. 12, Bandung" \
  --yes

cd ../kopi-senja
npm ci
npm run cafe -- doctor
npm run demo
```

The multiline example uses POSIX line continuation. On Windows, put the command on one line. `--yes` makes the command noninteractive. Omit it in a terminal to choose a package, theme, and brand color through prompts.

`init` copies the app, reusable components, static content, database code, scripts, tests, docs, and public product assets. It changes the package name, brand, and route slugs.

A `catalog` client starts in static mode with `CAFE_DEMO_DB=0`; use `npm run dev`. Other packages start with demo mode and `CAFE_DEMO_EMPTY=1` enabled; use `npm run demo`. A fresh ordering demo gets sample menu items and tables, with no sample sales. A cashier package also gets an empty open shift.

To use the supplied sales examples for a demonstration, remove `CAFE_DEMO_EMPTY=1` before the first startup. This setting affects a fresh database; it does not erase or replace existing orders.

It excludes dependencies, Git history, environment files with credentials, local databases, build output, test output, stored benchmark screenshots, and symlinks. It keeps `.env.example` and the verification workflow `.github/workflows/ci.yml`; other GitHub settings and workflows are not copied. It does not install packages, create a hosted database, publish a site, or use any of the source project's payment accounts.

The CLI refuses to overwrite an existing directory. A failed validation creates no client files. A failed copy removes only the new directory that this run created.

### Preview the result before creating files

```bash
npm run cafe -- init ../kopi-senja \
  --name "Kopi Senja" --preset catalog --theme airy --dry-run --json
```

`--dry-run` validates the whole selection without writing anything. `--json` returns data for scripts and disables prompts.

## Publish a menu-only catalog

```bash
npm run cafe -- init ../menu-client --name "Kopi Senja" --preset catalog --theme editorial --yes
cd ../menu-client
npm ci
npm run dev
```

Edit `content/menu.json` for categories, items, prices, photos, and outlet information. Edit `content/tables.json` for table labels and unique QR tokens. Public image paths point into `public`, so `/images/latte.webp` means `public/images/latte.webp`.

The included menu has `sample: true`. Keep that flag until the client has checked every menu item, price, photo, and availability statement. Set it to `false` only when the content belongs to that client; changing the brand name alone does not make sample menu data real.

For a production build:

```bash
npm run cafe -- doctor
npm run build
npm start
```

Leave `CAFE_DEMO_DB` unset or `0`. With exactly the `catalog` module enabled, the app serves the static JSON menu and table QR routes. It does not need a database or expose order/payment/staff actions. Build and deploy each client separately. QR links use `/t/<tenantSlug>/<outletSlug>/m/<qrToken>` at the client's deployed domain.

If you switch an existing demo to `catalog` with `configure`, also disable `CAFE_DEMO_DB` in that project's environment. `configure` changes public settings only; it does not rewrite environment files or erase stored data.

### Export a menu you edited in the demo

Keep the local demo running, then preview its public menu export from another terminal:

```bash
node --experimental-strip-types scripts/export-catalog.mjs --url http://127.0.0.1:3000 --out content --dry-run
node --experimental-strip-types scripts/export-catalog.mjs --url http://127.0.0.1:3000 --out content --overwrite
```

The export writes `menu.json` and `tables.json` from the public customer snapshot. It reads only a local server, excludes staff and transaction data, and refuses to replace existing files without `--overwrite`. You can export to a new directory instead to compare the files first. The result keeps `sample: true` by default; use `--sample false` only after checking the exported content for the client. Image files are not copied by this command, so keep any referenced local images in the client's `public` directory.

## Service packages

```bash
npm run cafe -- presets
npm run cafe -- modules
```

| Preset | Modules | Customer payment |
| --- | --- | --- |
| `catalog` | Menu catalog | No order or checkout flow |
| `order-at-cashier` | Catalog, customer ordering | Pay at the cashier |
| `order-and-pay` | Catalog, customer ordering, online payments | Online checkout |
| `cashier` | Cashier / POS | Staff handles payment |
| `cashier-kitchen` | Cashier, kitchen | Staff handles payment |
| `operations` | Cashier, kitchen, reports | Staff handles payment |
| `menu-cashier` | Catalog, cashier | Customer browses; staff enters orders |
| `menu-order-cashier` | Catalog, customer ordering, cashier | Pay at the cashier |
| `full` | All nine modules | Cashier or online checkout |

`order-at-cashier` includes a staff order inbox so a team can receive customer orders even when the full POS is not part of the package.

Cashier packages include cash drawer controls in the cashier screen. Opening or closing a shift does not require the reports module. Online-payment demos include staff controls for successful, cancelled, and expired payment attempts, including the `order-and-pay` package without POS.

### Choose a custom scope

Use `--modules` for an exact list. The CLI does not add hidden features.

```bash
npm run cafe -- init ../custom-cafe \
  --name "Custom Cafe" \
  --modules catalog,ordering,cashier,kitchen,tables \
  --theme rounded --yes
```

The available IDs are `catalog`, `ordering`, `payments`, `cashier`, `kitchen`, `dashboard`, `tables`, `loyalty`, and `marketing`.

Dependencies:

- `ordering` needs `catalog`.
- `payments`, `kitchen`, `dashboard`, and `loyalty` each need `ordering` or `cashier`.
- `marketing` needs `catalog` or `cashier`.
- `cashier` works without a public menu.
- `tables` can be enabled for a staff table workspace.
- At least one module must be enabled.

For a POS that takes online payments without a public ordering page:

```bash
npm run cafe -- configure --modules cashier,payments --payment online --yes
```

`--preset` and `--modules` cannot appear in the same command. Unknown modules and invalid dependencies cause a clear error. Hiding a menu item alone does not enforce scope: the application also checks capabilities on server commands.

## Choose the component style

```bash
npm run cafe -- themes
```

| Theme | Component treatment | Typical use |
| --- | --- | --- |
| `boxy` | Square corners, compact spacing, clear borders | Fast service and compact POS screens |
| `rounded` | Soft corners, balanced spacing | A broad default for cafés |
| `editorial` | Serif headings, open rows, fine rules | A quieter menu with strong type |
| `playful` | Bold borders, offset shadows, expressive headings | Casual or youthful brands |
| `airy` | More space, lighter surfaces, minimal borders | A calm, spacious menu |

The CLI also accepts `boxie`, `roundy`, `fun`, and `loose` as aliases. It saves the canonical theme names above.

Themes use shared CSS variables for control, panel, and image radius; border width; panel shadows; spacing; type; and control height. Changing a theme preserves module choices and order behavior. Customer layouts prioritize phones. Staff workspaces prioritize tablets and desktop screens.

## Set the brand

```bash
npm run cafe -- configure \
  --name "Kopi Senja" \
  --short-name "KS" \
  --description "Kopi pilihan dan sajian dari dapur kami." \
  --color '#364D3C' \
  --logo-file ../assets/kopi-senja.svg \
  --outlet-name "Kopi Senja Braga" \
  --address "Jl. Contoh No. 12, Bandung" \
  --phone "+6281234567890" \
  --yes
```

`--logo-file` accepts a local SVG, PNG, JPG, WebP, or AVIF up to 5 MB. The CLI copies it into `public/brand` with a filename based on its contents, then writes the public URL into the config. It never copies a symlink. A new image gets a new filename, so an old browser cache will not keep showing the previous logo.

You can instead set `--logo /brand/logo.svg` for an asset you already placed in `public/brand`, or pass an HTTPS image URL. Local assets make demos less dependent on another host. With no logo, the app uses `brand.shortName` as a fallback.

Use a six-digit hex brand color. The app selects black or white text for the primary button based on contrast, and derives a darker accent for readable links and icons when the chosen color is too light. It preserves your configured color for primary backgrounds. Structural theme rules remain independent of color.

`--slug` sets both the tenant and outlet slug. Use `--tenant` and `--outlet` to set them separately. New clients derive slugs from `--name`. Renaming an existing brand does not change its slugs or silently migrate its stored data.

Restart the dev server or rebuild after changing configuration. Updating a live client's slug, module selection, or payment mode needs a normal data and rollout review.

## Public configuration

`config/cafe.json` contains these fields:

| Setting | Purpose |
| --- | --- |
| `schemaVersion` | Configuration format; currently `1` |
| `brand` | Name, initials, short description, logo URL, brand color |
| `theme` | Structural component style |
| `modules` | Exact service scope |
| `venue` | Route slugs, branch name, public address and phone |
| `locale` | Currently `id-ID`; UI copy is Indonesian |
| `currency` | Currently `IDR`; amounts use integer rupiah |
| `timezone` | IANA zone, such as `Asia/Jakarta` |
| `payment.mode` | `cashier`, `online`, or `both` |

Do not put passwords, API keys, provider secrets, private keys, or database URLs here. The client bundle can read this file. Keep those values in server environment variables.

`payment.mode` must be `cashier` when the `payments` module is off. When `payments` is on, choose `online` or `both`. Presets choose the matching mode for you.

Validation runs in the CLI and when the application imports its config. It rejects unknown keys, unsupported modules, invalid colors or slugs, unsafe logo URLs, unsupported currency/locale values, and conflicting payment choices.

## Check a demo

```bash
npm run cafe -- doctor
npm run test:config
npm run build
```

For repeatable checks of all nine demo service packages and the database-free catalog:

```bash
node tests/preset-integration.mjs
```

The suite creates temporary client projects with separate local databases, checks enabled and disabled API/page routes, and exercises online ordering and standalone cashier payment flows. It also starts a catalog with no demo or database configuration and checks public menu and table routes, blocked transactions, and the absence of a generated database. It shares installed dependencies through a temporary link, then stops its servers and removes its projects. It does not alter this project's config or demo database. To check the two payment flows only, pass `--presets order-and-pay,cashier --skip-static`. To check only the database-free catalog, pass `--static-only`.

`doctor` checks the config, Node version, lockfile, local logo, and sample-content flag. It reports external images as needing a browser check. It does not contact a payment provider or prove that production authentication works.

The CLI tests cover every combination of the nine modules, all named presets, invalid dependencies, theme aliases, output from `--json`, no overwrite behavior, copy exclusions, dry runs, local logos, and failed validation without partial files.

For a client review, exercise the exact selected package with real menu content. Check a narrow phone, a tablet, and a desktop. Place an order, refresh, receive it in the staff inbox, finish preparation if kitchen is enabled, and confirm payment by the intended route. Check sold-out items, empty search, wrong table links, and a failed request too.

Reports select a bill date in the cafe's timezone, exclude void bills, and show receipts less refunds. The CSV uses the same date and calculations. Receipt totals follow the selected bills, including payments received later; this is not a cash receipt-date ledger or a profit report. Ingredients, wages, and other operating costs are not yet modeled.

## Catalog use and live transactions

The static menu-only package can serve a real client's checked menu without a database. The shipped database, ordering, and payment flows are for demos. A payment confirmation in demo mode is a simulation. Enabling `payments` does not connect a merchant account or settle money.

Before taking live orders, supply server-side staff authentication and authorization, a real database provisioning and migration process, and the chosen payment provider's server adapter with verified webhooks. Disable demo seed/reset behavior in the production environment. The app deliberately rejects unsupported production transaction paths instead of presenting demo settlement as real payment.

After those adapters exist, each client still needs its own menu, prices, tax/service policies, staff roles, table QR links, merchant account, and deployment settings. Keep sample menu facts and contact details separate from the client's verified information.
