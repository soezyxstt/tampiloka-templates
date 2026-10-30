# AGENTS.md

Instructions for AI agents and contributors working in this monorepo. Read this before changing any UI in `templates/*` or `packages/ui-core` / `packages/theme-engine`. These rules exist so every template looks and behaves consistently; follow them for new work and for fixes.

## Repository map

| Path | What it is |
| --- | --- |
| `templates/cafe` | Next.js cafe ordering + staff/POS template. Tailwind v4, Radix, `motion`. |
| `templates/commerce` | Vite + Cloudflare Worker storefront and staff workspace. Plain CSS + shadcn (Radix) wrappers. |
| `packages/theme-engine` | Commerce palettes (`sand`, `ink`, `forest`), layouts, `brandVariables()`. |
| `packages/ui-core` | Shared `Button`, `Input`, `NativeSelect`, `Textarea`, `Dialog`, `MotionProvider` (`.tl-*` classes). |
| `packages/cli`, `packages/registry` | Project generator and template registry. Palette/theme IDs here are a public contract. |
| `scripts/check-design-tokens.mjs` | Design guard: raw colors and tiny text. Run with `pnpm lint:design`. |

## Frontend rules

### 1. Color: tokens only

- **Never write a raw color in a component or rule.** No `#hex`, `rgb()`, `hsl()` or Tailwind palette classes (`bg-blue-600`) in `.tsx` or in CSS rules. Use semantic tokens: `var(--primary)`, `bg-[var(--surface)]`, etc.
- Raw values are allowed **only** where a token is *defined*:
  - cafe: the `:root` block in `templates/cafe/app/globals.css`, demo chrome tokens at the top of `demos/components/demo-portal.css` / `demos/showcase.css`, and `src/config/catalog.mjs` (default brand color).
  - commerce: the `:root` token block at the top of `templates/commerce/src/styles/base.css`.
  - packages: `packages/theme-engine/src/index.mjs` **and** `styles.css` (keep the two in sync).
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

### 7. Verification checklist (run before handing off UI work)

1. `pnpm lint:design` → must report `Design tokens OK` for files you touched (the repo-wide count must not grow).
2. Typecheck the template you changed (`pnpm --filter @tampiloka/template-cafe typecheck`, `... template-commerce typecheck`).
3. Cafe config tests if you touched brand/color helpers: `node --test templates/cafe/scripts/cafe-config.test.mjs`.
4. Visual check at 390px and 1280-1440px for customer pages; 1024px for staff pages.
5. Update the template's design doc (`templates/cafe/docs/design-system.md`, `templates/commerce/docs/design.md`) and the tables above if tokens changed.
6. Add a line to the change log below.

Heavy work (full builds, browser suites) follows the sandbox routing rules in the user's global instructions; small checks may run locally.

## Change log

Record UI-system changes here, newest first, one short entry per change.

- **2026-10-30**: Added Indonesian and English demo controls and localized customer and staff flows; cafe sample menus now use realistic photographs.

- **2026-10-30**: Replaced cool blue (cafe) and olive-grey (commerce) defaults with warm, low-glare palettes. Cafe default brand `#1746A2` → `#A94C27` (terracotta) on `#FBF8F3` cream; commerce Sand palette now charcoal CTA + clay `accent`; Ink/Forest refined. Added `accent` palette role, shared `--tl-*` status/overlay tokens, `--overlay`/`--status-danger-border`/`--status-danger-hover` in cafe. Removed hardcoded colors from components, raised minimum text size to 12px, strengthened input borders to ≥3:1. Added `scripts/check-design-tokens.mjs` (`pnpm lint:design`) and this rulebook.
