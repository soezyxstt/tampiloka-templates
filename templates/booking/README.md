# Tampiloka Booking

A reusable, single-business appointment application: React/TypeScript customer site and staff workspace, Cloudflare Worker API, and client-owned Turso database. This is an implemented template, not a static mockup. Live payment processing is **not verified** until the client's credentials pass the sandbox checklist.

## Start the public demo locally

From the repository root, with Node 22.18+ and pnpm 10.28.2:

```sh
pnpm install --frozen-lockfile
pnpm --filter @tampiloka/template-booking dev
```

The development script applies migrations to local SQLite and serves the API and frontend together on port 5176. Visit `http://localhost:5176`. Customer and staff views share one private, server-backed demo session. Other visitors receive different data. Demo sessions expire after 24 hours. Payments never move real money, and demo notifications never send email or WhatsApp messages.

Select the business, feature level, and palette at the top. Appearance contains independent layout choices, staff roles, reset, and sample bookings. The language switch stays at the bottom right. The default URL opens the working customer site.

## Generate a client project

```sh
pnpm tampiloka create nova-clinic --template booking --preset medical --level full --layout appointment-first --theme sage --yes
pnpm tampiloka create atelier-care --template booking --preset aesthetic --level whatsapp --yes
pnpm tampiloka doctor --dir ./nova-clinic
```

The output owns its configuration, source, shared UI copy, database configuration, and selected business content. It does not depend on the original monorepo. Public demo controls and configuration endpoints are removed or replaced with fail-closed implementations. Below Full, payment-provider and QR modules/dependencies are omitted. Catalog and WhatsApp builds cannot create customer appointment records.

| Axis                    | Supported IDs                                                              |
| ----------------------- | -------------------------------------------------------------------------- |
| Business preset         | `medical`, `aesthetic`, `detailing`, `consulting`                          |
| Feature level           | `catalog`, `whatsapp`, `booking`, `full`                                   |
| Layout                  | `appointment-first`, `editorial`, `service-market`, `minimal-professional` |
| Palette / CLI `--theme` | `sage`, `rose`, `slate`, `ochre`                                           |
| Language                | `id`, `en`                                                                 |

## Documentation

- [Architecture and data integrity](docs/architecture.md)
- [Feature boundaries and state transitions](docs/levels.md)
- [Layouts, tokens and interaction rules](docs/design.md)
- [Client setup and brand customization](docs/client-setup.md)
- [Deployment and payment verification](docs/deployment.md)
- [Adding presets, rules, providers and channels](docs/extensions.md)
- [Security boundaries and known limitations](docs/limitations.md)
- [Recorded release verification](docs/verification.md)
- [Photo sources](public/images/manifest.json)

## Verification commands

```sh
pnpm --filter @tampiloka/template-booking typecheck
pnpm --filter @tampiloka/template-booking test
pnpm --filter @tampiloka/template-booking build
pnpm --filter @tampiloka/template-booking build:demo
pnpm --filter @tampiloka/template-booking exec playwright install chromium
pnpm --filter @tampiloka/template-booking test:e2e
pnpm lint:design
pnpm test:cli
pnpm test:registry
pnpm catalog:test
node packages/cli/tests/booking-standalone.mjs
```

The browser suite uses a temporary local SQLite database by default. A hosted run with `BOOKING_TEST_URL` requires an explicit `BOOKING_CHECK_FILTER` to prevent accidentally running the full suite against the shared live database. The release and manual live workflows select the customer booking and staff check-in scenario. Browser evidence goes in `test-results/`. Public catalog readiness is a separate publication gate, not a claim inferred from a successful local build. Do not set `ready: true` until the deployed origin, API flow, and all 1280×800 preview images have been checked.
