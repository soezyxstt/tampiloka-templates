# Booking design system

## Independent choices

`preset` selects the business domain, labels, form fields, required resources and service content. `level` controls the server's capabilities. `layout` changes composition. `palette` changes semantic color tokens. Typography, imagery and brand copy come from business settings. None of these choices grants staff permissions or changes payment status.

The public toolbar uses `DemoToolbarShell` and imports `@tampiloka/ui-core/demo.css` after template styles. Client generation removes public controls, demo artwork and demo authority. Change shared chrome in the shared package, not a template-specific copy.

## Four compositions

| Layout | Desktop | Mobile |
| --- | --- | --- |
| `appointment-first` | Consultation photo and appointment selector, followed by pictured services and the practitioner directory. Compact horizontal navigation. | Introduction, compact photo and selector stack; a labeled menu replaces wide navigation. Booking remains a direct action. |
| `editorial` | Centered wordmark and navigation, split photographic opening, alternating treatment and text rows. | Shorter photography, stacked treatment rows and a full-width booking action. |
| `service-market` | Search beside a workshop photo, then a category sidebar and service comparison grid. | Categories move into a horizontal strip; service rows retain duration, price and action without page overflow. |
| `minimal-professional` | Narrow information rail, meeting photo beside the introduction, service index and team directory. | Introduction and service link lead, followed by the meeting photo, pictured service list and team. |

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

Each preset has six local service photographs. A service keeps the same picture in its catalogue, detail page and booking summary. The main photograph introduces the business and the location page shows the venue. Staff can edit both in Settings and replace each service photo in Content. The CLI keeps only files for the selected preset.

WF-14 (Care appointment) informed the clinic’s visible appointment selector. OPEN-10 (Destination and booking overlay) informed the prominence of the setting. Keep the form separate from the photo so its contrast and controls work across crops. Show contextual stock photos of visits, work and facilities. Keep fictional staff names separate from identifiable stock portraits. Each asset has a source URL, licence and checksum in `public/images/manifest.json`.

## Interaction decisions

The care-appointment reference WF-14 supports the existing service-to-booking hierarchy; the existing four compositions remain the source of layout and identity. Booking uses shared controls and a Radix Collapsible wrapper for FAQ, appointment recovery and access details. Its keyboard-operable summary uses a chevron and short entrance motion to clarify the state. Radix select provides selection, Escape and focus return, with entrance and exit feedback. Reduced-motion CSS removes these durations. Loading and validation do not wait for motion.

| Interaction | Existing primitive or behavior | Motion / state |
| --- | --- | --- |
| Actions and busy state | Shared Button via Action; busy disables and announces work | Spinner does not gate completion |
| Text fields and validation | Shared Input / Textarea, Field labels and help; native validation | Values remain controlled by their forms |
| Selection | Radix Select via Picker | Popup feedback; keyboard selection, Escape and focus return |
| Disclosure | Radix Collapsible via Disclosure | Height and opacity on open/close; trigger exposes expanded state |
| Dialog | Shared Dialog with localized close label | Shared dialog motion and focus management |
| Loading and errors | Localized status and alert | Immediate content, no animation dependency |

The WF-14 care-appointment reference informed the disclosure and service-to-booking hierarchy. Booking retains its own configured brand, typography and four layouts; a catalog-workspace pattern was less appropriate for this focused interaction change. The reference is guidance rather than a new visual identity.

Customer and staff route changes use a 180ms entrance on the main region. The route key excludes language and palette, so those choices preserve open disclosures and entered values. The global reduced-motion rule removes the movement. Bootstrap errors preserve API codes until localized rendering; unknown errors use localized recovery text.
