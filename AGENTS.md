# AGENTS.md

Instructions for AI agents and contributors working in this monorepo. Read this before changing any UI in `templates/*` or `packages/ui-core` / `packages/theme-engine`. These rules exist so every template looks and behaves consistently; follow them for new work and for fixes.

## Repository map

| Path | What it is |
| --- | --- |
| `templates/cafe` | Next.js cafe ordering + staff/POS template. Tailwind v4, Radix, `motion`. |
| `templates/commerce` | Vite + Cloudflare Worker storefront and staff workspace. Plain CSS + shadcn (Radix) wrappers. |
| `templates/school` | React/Vite + Worker/Turso education, admissions and learning workspace. |
| `templates/dashboard` | Planned; not offered by the CLI. |
| `templates/booking` | Vite + Worker/Turso appointment site and staff workspace. Shared UI, Radix Select, domain adapters and independent feature/layout/palette choices. |
| `packages/theme-engine` | Commerce palettes (`sand`, `ink`, `forest`), layouts, `brandVariables()`. |
| `packages/ui-core` | Shared `Button`, `Input`, `NativeSelect`, `Textarea`, `Dialog`, `MotionProvider` (`.tl-*` classes). |
| `packages/cli`, `packages/registry` | Project generator and template registry. Palette/theme IDs here are a public contract. |
| `scripts/check-design-tokens.mjs` | Design guard: raw colors and tiny text. Run with `pnpm lint:design`. |

## Family development and onboarding

From a fresh checkout install Node.js 22.18+ and pnpm 10.28.2, then run `pnpm install --frozen-lockfile`. Commands below run from the repository root. For components, tokens, browser and deployment details follow each family guide and the [shared demo contract](#shared-tampiloka-demo-system).

| Family | Design and components | Local demo | Tests | Release owner / workflow |
| --- | --- | --- | --- | --- |
| Cafe | [Design system](templates/cafe/docs/design-system.md), `components/ui` | `pnpm dev:cafe` | `pnpm --filter @tampiloka/template-cafe test` | Cloudflare Pages `tampiloka-cafe-demos`; [guide](templates/cafe/README.md) |
| Commerce | [Design](templates/commerce/docs/design.md), `components/shadcn` | `pnpm dev:commerce` | `pnpm --filter @tampiloka/template-commerce test` | `.github/workflows/release-demos.yml`; [guide](templates/commerce/README.md) |
| Booking | [Design](templates/booking/docs/design.md), shared UI and Radix | `pnpm dev:booking` | `pnpm test:booking`, `pnpm test:booking:standalone` | Template deploy owner; `booking-validation.yml` and manual `booking-live.yml` verify; [guide](templates/booking/README.md) |
| School | [Design](templates/school/docs/design.md), shared UI and Radix | `pnpm dev:school` | `pnpm test:school`, `pnpm --filter @tampiloka/template-school test:standalone` | Template deploy owner; `school.yml` verifies; [guide](templates/school/README.md) |

School and Booking default to port 5176; run them separately. Dashboard remains planned. These commands supplement the family-specific build, typecheck, browser, and live checks; they do not replace them.

All four public demos deploy through `release-demos.yml`, which records exact-build hosted evidence for [catalog promotion](docs/catalog-release-evidence.md). Local family workflows and manual live checks alone do not authorize promotion.

When onboarding a family:

1. Create `templates/<id>/template.json`, implementation, design docs, tests and a standalone client setup. Keep IDs stable.
2. Add matching entries to `packages/registry/templates.json` and its runtime `src/index.mjs`; verify registry and manifest checks. Mark `available` only when the CLI can generate a working standalone project with its core flows, builds and tests verified. Otherwise keep `planned`.
3. Support and verify CLI `list`, `presets`, `create`, `doctor` and the packed CLI output on a machine without the checkout. Update the root and family README and verify documented commands.
4. Follow the [public catalog guide](docs/public-demo-catalog.md) and shared demo contract for public metadata, routing, localization, previews, and publication. CLI availability alone does not make a demo ready: verify the deployed origin and actual customer/staff flows, isolated sample data and payment disclosure, and loaded 1280 x 800 previews before setting public readiness.
5. Run `node scripts/check-docs-consistency.mjs`, `pnpm test:registry`, `pnpm test:cli`, `pnpm catalog:test`, relevant family tests, typecheck, builds and browser checks. Record the exact commands, results, release evidence and any blocked checks; verify the published feed and gallery separately after publication.

## Frontend rules

### 1. Color: tokens only

- **Never write a raw color in a component or rule.** No `#hex`, `rgb()`, `hsl()` or Tailwind palette classes (`bg-blue-600`) in `.tsx` or in CSS rules. Use semantic tokens: `var(--primary)`, `bg-[var(--surface)]`, etc.
- Raw values are allowed **only** where a token is *defined*:
  - cafe: the `:root` block in `templates/cafe/app/globals.css`, demo chrome tokens at the top of `demos/components/demo-portal.css` / `demos/showcase.css`, and `src/config/catalog.mjs` (default brand color).
  - commerce: the `:root` token block at the top of `templates/commerce/src/styles/base.css`.
  - school: semantic definitions in `templates/school/src/styles/school.css`; see `templates/school/docs/design.md`.
  - booking: semantic definitions in `templates/booking/src/styles/tokens.css`; see `templates/booking/docs/design.md` for palettes, compositions and staff overrides.
  - packages: `packages/theme-engine/src/index.mjs` **and** `styles.css` (keep the two in sync); shared demo chrome tokens in `packages/ui-core/src/demo.css`.
- `var(--token, #fallback)` fallbacks are fine; pure `#fff`/`#000` are allowed only as ink on a solid fill.
- Need a tint, hover or overlay? Derive it: `color-mix(in srgb, var(--primary) 8%, var(--surface))`, `color-mix(in srgb, var(--foreground) 45%, transparent)`. Do not invent a new hex.
- Need a genuinely new role? Add a token to the definition block, document it in the tables below, and check contrast.

### 2. Palette direction (F&B and retail)

The old defaults (cool corporate blue on blue-grey, olive-grey on sand) read as "admin dashboard" and felt tiring. Defaults are now **warm and low-glare**:

- Warm off-white canvas, never pure white page backgrounds; white is for cards/surfaces.
- Text is a warm near-black (espresso/charcoal), never `#000`.
- **Cafe**: appetizing warm action color (terracotta). Avoid blue/purple as a food brand default.
- **Commerce**: neutral, product-photo-first; charcoal CTA, clay `accent` for prices/promotions only.
- Status colors are fixed and shared across palettes; brand color never doubles as a status color.

#### Cafe tokens (`templates/cafe/app/globals.css`)

| Token | Value | Use |
| --- | --- | --- |
| `--background` | `#FBF8F3` | Page canvas (warm cream) |
| `--surface` | `#FFFFFF` | Cards, sheets, inputs |
| `--surface-muted` | `#F4EEE6` | Quiet panels, table headers, skeletons |
| `--foreground` | `#2A1F1A` | Body text (espresso) |
| `--muted-foreground` | `#6B5C52` | Secondary text, placeholders |
| `--border` | `#E6DCCF` | Dividers, card outlines (decorative) |
| `--border-strong` | `#9A877A` | Input/checkbox outlines, focusable boundaries (≥3:1) |
| `--primary` | from `config/cafe.json` → default `#A94C27` | Primary fills |
| `--primary-ink` | derived (`readableAccent`) | Brand-colored text, icons, focus rings |
| `--primary-foreground` | derived (`foregroundForColor`) | Text on primary fill |
| `--primary-hover` | primary + 18% black | Hover on primary fill |
| `--accent-surface` | primary 8% on white | Selected/hover tints |
| `--overlay` | foreground 45% transparent | Dialog/sheet scrim |
| `--status-{success,warning,danger,info}-{fg,bg}` | see file | Status badges, notices |
| `--status-danger-border`, `--status-danger-hover` | see file | Destructive button outline/hover |

#### Commerce palettes (`packages/theme-engine`)

| Role (`--brand-*`) | Sand (default) | Ink | Forest |
| --- | --- | --- | --- |
| canvas | `#f7f5f1` | `#f6f6f6` | `#f3f6f2` |
| surface | `#ffffff` | `#ffffff` | `#ffffff` |
| text | `#2a2420` | `#1c1c1e` | `#1a2e23` |
| muted | `#6b635b` | `#5e5e66` | `#55675b` |
| action / on-action | `#2a2420` / `#fff` | `#1c1c1e` / `#fff` | `#245a40` / `#fff` |
| border | `#e3ddd5` | `#e0e0e3` | `#d5dfd5` |
| focus | `#9a5a3a` | `#4a5578` | `#2f7a55` |
| accent (price/promo) | `#a4492a` | `#a4492a` | `#8a5a1f` |

Shared semantic roles in `theme-engine/src/styles.css`: `--tl-danger`, `--tl-success`, `--tl-warning`, `--tl-info` (+ `-surface`), `--tl-overlay`. Commerce CSS aliases them in `base.css` (`--line`, `--line-strong`, `--muted`, `--ink`, `--action`, `--accent`, `--surface-sunken`, ...). Use the aliases inside commerce.

Palette IDs (`sand`, `ink`, `forest`) and cafe theme IDs are stored in client configs and used by the CLI. **Change values, never rename or remove IDs.**

### 3. Contrast (verify every new pair)

| Pair | Minimum |
| --- | --- |
| Body text on canvas/surface | 7:1 preferred, 4.5:1 required |
| Muted/secondary text, placeholders, prices | 4.5:1 |
| Text on primary/action fill | 4.5:1 |
| Input/checkbox borders, focus rings, icons that carry meaning | 3:1 |
| Decorative dividers (`--border`, `--line`) | no minimum, but never the only affordance of a control |

Check with the WCAG formula (e.g. `node -e` with relative luminance). A custom client color must pass through `readableAccent()` / `foregroundForColor()` (cafe) rather than being used for text directly.

### 4. Typography

- **Minimum text size 12px**, everywhere (labels, captions, table metadata, badges). Body copy 14-16px. Customer-facing inputs 16px on phones (prevents iOS zoom).
- Staff/operational screens: data rows ≥13px, table headers ≥12px.
- Prices, quantities, totals: `font-variant-numeric: tabular-nums` (`.tabular-nums`).
- Do not shrink long product names to fit; let them wrap.
- Do not add letter-spaced ALL-CAPS "eyebrow" labels as decoration.

### 5. Shape, spacing, touch targets

- Radius, padding and gaps come from tokens (cafe: `--radius-control`, `--radius-panel`, `--radius-image`, `--card-padding`, `--section-gap`; commerce: `--brand-radius`, composition tokens). Structural themes may override tokens, components must not hardcode them.
- Touch targets: customer actions ≥44px (48px for the primary purchase action); staff controls ≥40px; icon-only buttons ≥44×44 with an `aria-label`.
- Shadows are soft and warm: tint with `color-mix(in srgb, var(--foreground) N%, transparent)`, never pure black at high opacity.

### 6. Reusable components (use them, extend them, do not fork them)

| Need | Cafe | Commerce |
| --- | --- | --- |
| Button | `components/ui/button.tsx` (cva variants) | `components/shadcn/button.tsx` or `ui-core` `Button` via `components/ui.tsx` |
| Text field / textarea / select | `components/ui/input.tsx`, `textarea.tsx`, `select.tsx` (all share `field-styles.ts`) | `components/shadcn/input*.tsx`, `select.tsx`, `textarea.tsx` |
| Dialog / sheet | `components/ui/dialog.tsx` | `components/shadcn/dialog.tsx`, `sheet.tsx`, `ui-core` `Dialog` |
| Tabs / segmented / filter chips | `components/ui/choice-strip.tsx` (`animated-tabs.tsx` is a compatibility wrapper) | `components/ui.tsx` |
| Status badge, money, quantity, notices | `components/cafe/ui-primitives.tsx` | `components/shadcn/badge.tsx`, `components/ui.tsx` |
| Workspace layout | `components/ui/workspace-primitives.tsx` + `workspace.css` | `styles/workspace.css` |

Rules:
- New visual variant → add it to the component's `cva` variants (or the shared CSS class), using tokens. No one-off `className` color overrides at call sites.
- Every interactive element has a visible `:focus-visible` ring using `--primary-ink` (cafe) / `--brand-focus` (commerce).
- Disabled = `opacity .5` + `cursor:not-allowed`; also explain *why* when an action is blocked.
- State is never conveyed by color alone: pair status color with text or an icon.
- Respect `prefers-reduced-motion` (both templates already zero out durations globally; don't bypass it with JS timers that gate content).

#### Component and motion parity across families

School and Booking follow the same accessible component contract as Cafe and Commerce. Before adding a control, inspect the accepted sibling implementation and reuse the family’s shared wrappers or extend `packages/ui-core`. Use shadcn-style composition over Radix for selects, dialogs, dropdown menus and collapsibles; native inputs and buttons belong inside consistent shared wrappers. Preserve native semantics and keyboard behavior. Do not build click-only lookalikes or scatter styling and animation at call sites.

Document each family’s control inventory and motion contract in its design guide. Match feedback for hover/focus/press, selection, disclosure, dialog and view changes to the accepted demos. Motion must communicate state without delaying essential content; test interrupted open/close, focus return and live reduced-motion changes. A static screenshot or installed dependency alone does not prove parity.

Verify Indonesian and English in customer and staff views, including validation, loading, empty/error states and hidden popup/dialog content. Changing language must preserve business data and current demo state. Use natural Indonesian action labels with equivalent English meaning.

#### Navigation cues and icon alignment

- Do not append decorative arrows to every CTA or link. Use a clear label and the shared button/link treatment, including hover and focus states, to make actions clear.
- Keep icons when they convey a function: dropdowns, disclosures, carousel direction, or a standalone external-launch control. Keep navigation as native anchors with `href`; preserve keyboard behavior, accessible names, and appropriate `target`/`rel` values. Give icon-only controls an accessible name and hide redundant SVGs from assistive technology.
- Center icon-only controls on both axes with flex/grid and symmetric padding. Remove text-baseline offsets, using `line-height: 0` where needed. Keep targets at least 44 × 44px and SVGs `display: block` and nonshrinking (`flex-shrink: 0`). Fix the shared component rather than adding one-off position nudges at call sites.
- Check visual centering on desktop and mobile, including menu controls in closed/open states and hover/focus states. Keep functional icons and their state cues intact when removing decorative arrows.

### 7. Verification checklist (run before handing off UI work)

1. `pnpm lint:design` → must report `Design tokens OK` for files you touched (the repo-wide count must not grow).
2. Typecheck the template you changed (`pnpm --filter @tampiloka/template-cafe typecheck`, `... template-commerce typecheck`).
3. Cafe config tests if you touched brand/color helpers: `node --test templates/cafe/scripts/cafe-config.test.mjs`.
4. Visual check at 390px and 1280-1440px for customer pages; 1024px for staff pages.
5. Update the template's design doc (`templates/cafe/docs/design-system.md`, `templates/commerce/docs/design.md`) and the tables above if tokens changed.
6. Add a line to the change log below.

Run these checks from the repository root after installing the locked workspace. Record each command and result; if a check cannot run, record the reason and remaining verification instead of calling it passed.

## Shared Tampiloka demo system

These rules apply to **every current and future public template demo**, including cafe, commerce, dashboards, booking, school, and later families. The accepted interaction reference is the commerce demo; the select appearance follows `soezyxstt/tampiloka` at `apps/tampiloka/components/ui/select.tsx`. A new family must join this system instead of inventing another demo launcher.

### Navigation and controls

1. Use `DemoToolbarShell` from `@tampiloka/ui-core/demo` and the shared `@tampiloka/ui-core/demo.css`. Keep its brand link, control group, view navigation, selected states, focus treatment, and responsive order shared. Extend this primitive for a missing capability rather than copy its markup into another template.
   Import `demo.css` after the app styles. Use the shared `--demo-control-height`, `--demo-control-radius`, `--demo-option-radius`, and `--demo-gap` tokens; chrome colors use `--demo-chrome-*` / `--demo-panel-*`. Select accessible names are `Tema demo` / `Demo theme` and `Mode demo` / `Demo mode`. Reserve `--demo-height` for the measured toolbar offset.
2. Put **theme and mode selectors at the top of the running demo**. A visitor must be able to change either immediately. A grid of mode cards farther down a portal is not the primary mode switch. The default demo entry opens a working preview.
3. Keep theme/style and feature mode independent. A theme changes presentation; a mode changes enabled features. Do not silently change the chosen mode when changing the theme, or the theme when changing the mode.
4. Keep customer/staff or equivalent role navigation in the same toolbar. Show the current view with text and a selected state. Only offer views supported by the active mode; switching to a staff-only mode must select a valid view. In-app links that switch views must also update the toolbar state.
5. Link the Tampiloka brand back to the shared `/templates` gallery, using `/en/templates` for English. Use the verified brand artwork and preserve its proportions and surface-appropriate variant. Template brand colors and layout may vary; the exploration controls must remain recognizable as Tampiloka.
6. Preserve working demo subdomains and deep links. Keep supported theme, mode, view, and `lang=id|en` state in the URL. Build URLs with `URL`/`URLSearchParams`, preserve unrelated valid parameters and hashes, and test refresh, copied links, and browser back/forward. Never rename public preset/theme IDs merely to change their labels.
7. Keep reset and sample-scenario actions secondary. Do not confuse demo reset with a purchase, staff operation, or navigation action. Reset affects demo data only. Payment simulation and sample-brand disclosures must remain clear.

### Select fields, language, and small screens

- Reuse the app's accessible select primitive (Radix/Base UI) with the shared demo select classes. Follow Tampiloka's compact trigger, aligned popup, selected check, restrained border, and open/close motion. Do not replace it with a click-only custom menu or a differently styled native select for one family.
- Give theme/mode fields clear accessible names. Support keyboard selection, Escape, focus return, disabled states, long labels, popup scrolling, and reduced motion. Keep popups above sticky content and within the viewport. Use at least 16px input text on phones and 44px public touch targets.
- Place **ID/EN at the bottom right of every demo** using the shared language control styling. Keep the position consistent across customer and staff views. Respect safe-area insets and move it above fixed customer navigation, cart/payment bars, or other fixed actions so it never covers them.
- Resolve explicit `lang` first, retain the visitor's choice, and pass the locale through gallery/demo navigation. Translate controls, option labels, loading/error states, and both customer and staff views. Language changes must not reset orders, theme, mode, or active view.
- Let toolbar rows wrap at narrow widths. Measure the toolbar's actual height for sticky content offsets; do not assume one fixed desktop height. Do not hide horizontal overflow to conceal a layout failure. Scope shared chrome styles so they do not recolor the actual customer's storefront or staff workspace.

### Public catalog and the marketing repository

- This repository owns the public demo catalog. `soezyxstt/tampiloka` consumes its versioned JSON **at runtime** for `/templates` and the landing-page template preview. Adding a public demo must not require editing a list, importing this repository, or rebuilding the marketing app.
- Keep template IDs, availability, preset IDs, and base demo URLs canonical in `packages/registry/templates.json` and its existing runtime registry. Put bilingual public presentation, explicit visibility/readiness, featured flags, and routing metadata in `packages/registry/public-demos.json`. Generate the versioned feed with `pnpm catalog:build`; do not edit `packages/registry/dist/` by hand.
- The public endpoint is `https://catalog.tampiloka.site/catalog.v1.json`, served by Worker `tampiloka-catalog`. `.github/workflows/publish-catalog.yml` tests and publishes metadata changes independently. Run `pnpm catalog:test` before publication and verify that the deployed feed equals the exact generated artifact. The Worker supports ETag and a 60-second cache with a 120-second stale-while-revalidate window.
- Use one generated catalog for all public demo families. Keep schema version, update time, localized family/mode names, localized entry names/descriptions, stable IDs, public URLs, image URLs, visibility, and mode URLs explicit. Consumers must derive available families and modes from that data rather than a closed `cafe | commerce` list.
- Publish only entries explicitly marked public and ready. Prospect/client-specific, private, unlisted, unfinished, and internal demos must not leak into the public feed. Keep private contacts, credentials, internal API addresses, and client records out of public metadata.
- Use absolute HTTPS demo and thumbnail URLs. Record complete per-mode URLs so consumers do not need to know a template's routing scheme. Preserve stable entry IDs when editing copy or artwork. Validate unique IDs, family/mode references, required Indonesian/English text, and safe URLs before publishing.
- Keep public thumbnails current with the deployed demo. After changing its appearance or shared controls, render the working public preview at a **1280 × 800 viewport (8:5)** and export an optimized 8:5 image, with its real theme, mode, content, and toolbar visible; verify that assets have loaded. Use the same 8:5 ratio in gallery and landing previews so the interface does not get cropped. Host new or refreshed images with the template or catalog, then update the absolute `imageUrl` in public metadata. Do not require a marketing asset copy or rebuild to add or refresh a demo image.
- Keep publishing automatic from the catalog's source files. Changes to public metadata must update the public JSON independently of a marketing-site deployment. Retain the last working catalog when validation or publication fails; never overwrite it with a failed or partial response.
- The marketing consumer must validate the schema at runtime, use bounded caching, show useful loading/empty/error/retry states, and label stale fallback data. Do not introduce a second manually maintained demo list as a fallback.
- When adding a new template, update its manifest and catalog metadata, ensure its demo URLs and images work, publish the catalog, and check that it appears in the existing marketing gallery without a marketing source change.

### Required verification and documentation

Check customer views at 360px, 390px, and a desktop width (1280 to 1440px), plus staff at 1024px. Exercise selectors, role changes, language changes, deep links, reload/back navigation, and overlap with fixed actions. Check normal and reduced-motion states, open dropdowns, long labels, and no horizontal page overflow. Preserve existing order/payment/stock/permission behavior when changing the shell.

Run design-token lint, affected template typechecks, catalog validation/tests, and the existing affected browser suites. Update obsolete selectors when controls change, while retaining their behavioral assertions. Record the actual checks and any blocked checks; a build alone does not prove visual or interaction quality. Update this file and the relevant template design docs whenever the shared contract changes.

## School template

`templates/school` uses React/Vite + Worker/Turso, with a typed CMS and a purpose-built staff workspace. Its token definitions live in `src/styles/school.css`. The four stable palette IDs are cobalt, forest, neutral, burgundy; layout, typography, preset and level are independent. Keep financial/admissions commands separate from content editing. Run school domain/API/palette tests, typecheck, build, standalone verification and browser coverage when changing this family. Public catalog readiness remains separate from CLI availability.

## CI and deployment maintenance

- Before creating or marking a PR ready for review, assess which template families are affected by the complete change, including shared UI, generator, configuration, dependencies and toolchain. For each affected family, run its documented tests and browser checks against the exact PR head, or cite passing CI on that head when it covers those checks. If impact is uncertain, run the checks. Record commands, results, tested commit, and the reason for each skipped family in the PR; if a required check fails or cannot run, keep the PR in draft.
- For Cafe changes and changes that can affect Cafe (including shared UI, generated clients, dependencies and toolchain), run `pnpm install --frozen-lockfile`, `pnpm build:cafe`, and `pnpm --filter @tampiloka/template-cafe test:demo-all` before review. Install Chromium with `pnpm --filter @tampiloka/template-cafe exec playwright install --with-deps chromium` where needed. The full Cafe suite is not in routine CI; it can also be run manually in `Verify Tampiloka templates` with `full_cafe` enabled and `live_layout` disabled.
- Keep `.github/workflows/ci.yml` as the common verification workflow: run it for pull requests and pushes to `main`, including design-token lint, template builds, and the fast transaction, runtime and Commerce browser checks. The full Cafe demo suite is a pre-review and manual gate. Avoid running the same full suite on both a feature-branch push and its pull request.
- Keep commerce Worker deployment and public catalog publication in their existing workflows. The catalog has its own validation and live verification because it publishes independently. The deployment trigger owns commerce path filtering; keep it aligned with the workspace dependencies and avoid a second change-detection job. Do not add a duplicate PR build to the deployment workflow; CI already builds commerce.
- Before adding a workflow, job, or script, identify the distinct risk it checks, its trigger and owner, and why an existing check cannot cover it. Prefer extending an existing check, reuse shared setup, and avoid duplicate installs, builds and tests. Preserve meaningful coverage and deployment validation when removing duplication.
- Production workflows run independently of CI; configure repository branch protection or rulesets to require the `verify` CI check before merging to `main` and prevent bypasses as appropriate. Workflow YAML alone does not enforce that protection. Review required check names before renaming or removing jobs; do not require path-filtered workflows, which can leave checks pending on unrelated changes.

## Change log

- **2026-11-03**: School gallery labels published images with their localized titles and limits fictional-demo disclosure to demos.

- **2026-11-03**: School now uses localized page routes, configurable institution identity/assets and CMS-driven home copy; generated-client tests verify built Worker deep links, branding and protected admin access.

- **2026-11-03**: Enriched School institution pages with a complete faculty directory, admissions guides, clubs, dated articles and CMS information layouts; refined visible-first motion and loaded-image browser checks.

- **2026-11-03**: Expanded the institution homepage with activity, achievement and gallery sections, responsive footer navigation and reduced-motion-aware transitions.

- **2026-11-03**: Expanded the School institution demo with bilingual school-life, admissions, news, faculty and information pages and an image-led institutional home.

Record UI-system changes here, newest first, one short entry per change.

- **2026-11-01**: Made cross-family component, motion and bilingual hidden-state parity explicit; shared dialog close targets now use centered 44px controls and disabled fields share the disabled treatment.

- **2026-11-01**: Shared effective School registration schemas now preserve extension-owned fields and label staff answers; Booking reschedule choices use authorized appointment availability. Catalog promotions require deployment-owned hosted evidence.

- **2026-11-01**: Documented the four available families, their verification paths, and onboarding and demo readiness gates.

- **2026-10-31**: Added school template with independent business/layout/palette/level choices, shared demo shell, typed CMS, protected enrollment and learning-center operations. Shared dialogs accept an optional localized close label.
- **2026-10-31**: Added booking to the shared demo contract with independent business, level, layout, palette, view, and language state. Its staff workspace uses neutral tokens, labeled schedule fields, server-backed session isolation, and verified 1280 × 800 preview captures.

- **2026-10-30**: Added shared rules for restrained navigation icons, clear link/button cues, and centered, accessible icon-only controls across current and future templates.

- **2026-10-30**: Standardized public demo exploration around shared theme/mode selectors, customer/staff navigation, bottom-right ID/EN, Tampiloka select styling, and a runtime public catalog contract for current and future template families.

- **2026-10-30**: Added Indonesian and English demo controls and localized customer and staff flows; cafe sample menus now use realistic photographs.

- **2026-10-30**: Replaced cool blue (cafe) and olive-grey (commerce) defaults with warm, low-glare palettes. Cafe default brand `#1746A2` → `#A94C27` (terracotta) on `#FBF8F3` cream; commerce Sand palette now charcoal CTA + clay `accent`; Ink/Forest refined. Added `accent` palette role, shared `--tl-*` status/overlay tokens, `--overlay`/`--status-danger-border`/`--status-danger-hover` in cafe. Removed hardcoded colors from components, raised minimum text size to 12px, strengthened input borders to ≥3:1. Added `scripts/check-design-tokens.mjs` (`pnpm lint:design`) and this rulebook.

