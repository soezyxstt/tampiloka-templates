# School design system

Four compositions share behavior, not page structure:

- Academic Editorial: serif narrative hero, asymmetric photography, restrained numbered program rows and long-form sections.
- Course Discovery: subject photograph alongside the search field, comparison rows and an intake sidebar.
- Contemporary Learning: a photographed project and teaching session followed by a three-column workshop gallery.
- Institutional: information utility navigation, split admissions hero, announcements and academic schedule before program discovery.

Layout, sample palette, typography, business preset and level remain independent. New client branding replaces semantic tokens without renaming public IDs.

Palettes define canvas, surface, text, muted, action, focus, border and strong-border roles. No component owns a raw color. Text/action pairs meet 4.5:1; body pairs exceed 7:1. Meaningful control borders meet 3:1. Status includes text, not color alone. Color checks run with automated tests.

Public inputs use 16px on phones. Touch targets are at least 44px and primary actions 48px. Staff tables scroll inside their own container. Small-screen admission summaries stay visible. Dialogs/selects use Radix, focus restoration and accessible labels. Motion honors reduced-motion preferences.

The demo uses `DemoToolbarShell` and imports shared demo CSS last. It keeps preset/theme/level at the top and ID/EN bottom right. Advanced layout/type and secondary roles live in an appearance dialog. Native view links preserve query/hash state. Toolbar height comes from its real ResizeObserver measurement.

Realistic stock photos are illustrative, not portraits of the fictional named educators. Avoid decorative eyebrow labels, unnecessary cards, gradient decoration, inflated performance statistics, pills and navigation arrows. Program pages and operations prioritize readable details and clear actions.

## Photography

The education pathway from Website Design Kit WF-13 keeps the program, fee and enrollment action together. OFFER-13 guides the searchable catalog. The workshop layout uses larger process photos so visitors can see what they would make. A carousel would hide those choices on the initial view. On phones the workshop list stacks, while the admissions layout shows the classroom above the introduction.

Each business preset in `content/presets.json` provides editable lead, program, approach and facility images. The program list and detail use the same CMS image. Bundled activity photographs have 480 px and 1120 px WebP variants, a focal point, bilingual descriptions, and photographer and license details in `content/photo-sources.json`. The lead loads first. Below-the-fold images load on demand. Set a client's own photo in the CMS to replace both bundled variants. Returning demo visitors see the new images on untouched built-in records that still use the original stock files. Content edits, enrollment data and client installations keep their saved values.

## Interaction decisions

School uses ui-core buttons, inputs, textareas and dialogs and Radix Select through `Pick`; the mobile navigation uses a Radix dropdown with keyboard navigation, Escape and focus return. FAQ blocks use a reusable Radix collapsible and adapt the website-design-kit MOTION-01 quiet disclosure: a 160ms opening fade and rotating state indicator, disabled by the reduced-motion rule. The MOTION-07 menu informed the compact navigation, adapted to Radix rather than native details. Required registration selects use Radix native form validation. Page and staff view transitions use 180ms, while shared reveals provide progressive entry. The established School palettes, typography and sample imagery remain the identity source; the kit guides interaction, not brand tokens.

Interaction matrix: selects support keyboard selection and Escape; dialogs restore focus on close; disclosures toggle with Enter or Space; menus support arrow keys and Escape; required form fields use browser validation; asynchronous actions disable while busy and report errors; reduced motion removes transitions and animations. Language changes retain the current demo state.

Local interaction evidence (2026-11-01): Playwright checked the FAQ opening duration (160 ms; 0 ms with reduced motion), mobile menu Escape/focus return and link selection, locale changes while the FAQ stays open, and page overflow at 390 and 1280 px. Local 1280 × 800 loaded captures are in `public/demo-previews`; the separate deployment workflow owns the canonical hosted `/previews/` evidence. These local checks do not establish hosted release readiness.
