# Booking design system

## Independent choices

`preset` selects the business domain, labels, form fields, required resources and service content. `level` controls the server's capabilities. `layout` changes composition. `palette` changes semantic color tokens. Typography, imagery and brand copy come from business settings. None of these choices grants staff permissions or changes payment status.

The public toolbar uses `DemoToolbarShell` and imports `@tampiloka/ui-core/demo.css` after template styles. Client generation removes public controls, demo artwork and demo authority. Change shared chrome in the shared package, not a template-specific copy.

## Four compositions

| Layout | Desktop | Mobile |
| --- | --- | --- |
| `appointment-first` | Split introduction and appointment selector, supporting practitioner directory below. Compact horizontal navigation. | Introduction and selector stack; a labeled menu replaces wide navigation. Booking remains a direct action. |
| `editorial` | Centered wordmark/navigation, wide photography, large service titles and alternating image/text rows. | Shorter photography, stacked treatment rows and a full-width booking action. |
| `service-market` | Search and sorting beside the title, category sidebar and a denser comparison grid. | Categories move into a horizontal strip; service rows retain duration, price and action without page overflow. |
| `minimal-professional` | Restrained navigation, narrow business-information rail, large text and practitioner-led rows. | Information and profiles stack. Keep one clear service action rather than adding a large photographic hero. |

Business presets do not lock layouts. Medical in Editorial retains its practitioner form and allocation rules. Aesthetic in Catalog removes online booking on the server; it does not merely hide a payment button.

## Tokens and contrast

Definitions are in `src/styles/tokens.css`; brand overrides belong in `brand.css`. Components use semantic roles rather than raw colors. Shared UI receives `--brand-*` aliases. Preserve palette IDs because URLs and generated configuration use them.

| Role | Sage | Rose | Slate | Ochre |
| --- | --- | --- | --- | --- |
| Canvas | `#f4f5ef` | `#f8f1ec` | `#f0f3f5` | `#f7f2e7` |
| Ink | `#1d312b` | `#3e2929` | `#23323c` | `#3c3021` |
| Muted text | `#4e6259` | `#70534f` | `#52636e` | `#6c5c43` |
| Action | `#285a46` | `#803f48` | `#294e69` | `#785220` |
| Control border | `#7b8d80` | `#9b7a72` | `#7b8d98` | `#948264` |

The domain suite calculates sample text/control contrast. Check custom client colors separately. Decorative dividers do not replace control borders or focus rings. Status colors include text labels and remain independent of the brand. `data-view="staff"` selects consistent neutral tokens and the body font.

## Components and behavior

`src/components/ui.tsx` adapts shared Button, Input, Textarea, Dialog and Reveal components. Picker uses Radix Select with keyboard selection, Escape and focus return. Field connects labels and help text to controls. Put new variants in these wrappers or shared CSS, not one-off call-site overrides.

Use clear action labels rather than arrows on every link. Center named icon-only controls. Schedule editors label Start and End separately and give native time inputs enough room for the complete value and picker. Customer forms use readable mobile input sizes.

Motion uses the shared provider and honors reduced-motion preferences. Loading does not depend on an animation finishing. Staff pages discard stale snapshots when role, business, feature level or content revision changes. Server permissions remain authoritative.

## Review and evidence

Run the design guard, typecheck, domain tests and browser suite. Check 360, 390, 1024 and 1440 pixels, normal/reduced staff motion, keyboard focus, URL history, language, roles and real mutations. The latency regression holds an actual staff API response to verify that old owner controls disappear while Viewer permissions load.

Preview files under `public/demo-previews/` are real 1280x800 browser captures. Verify live responses and dimensions before publishing catalog entries. Geometry checks do not replace visual review of native fields, image crops, spacing and hierarchy.

Photo sources/checksums are in `public/images/manifest.json`. Images illustrate categories, not the identity or endorsement of fictional practitioners. Prefer client-owned photos at launch.
