# School design system

Four compositions share behavior, not page structure:

- Academic Editorial: serif narrative hero, asymmetric photography, restrained numbered program rows and long-form sections.
- Course Discovery: search-first opening, comparison/list patterns, an intake sidebar and fee-focused actions.
- Contemporary Learning: large expressive type, staggered images, approach before programs, compact program rows.
- Institutional: information utility navigation, split admissions hero, announcements and academic schedule before program discovery.

Layout, sample palette, typography, business preset and level remain independent. New client branding replaces semantic tokens without renaming public IDs.

Palettes define canvas, surface, text, muted, action, focus, border and strong-border roles. No component owns a raw color. Text/action pairs meet 4.5:1; body pairs exceed 7:1. Meaningful control borders meet 3:1. Status includes text, not color alone. Color checks run with automated tests.

Public inputs use 16px on phones. Touch targets are at least 44px and primary actions 48px. Staff tables scroll inside their own container. Small-screen admission summaries stay visible. Dialogs/selects use Radix, focus restoration and accessible labels. Motion honors reduced-motion preferences.

The demo uses `DemoToolbarShell` and imports shared demo CSS last. It keeps preset/theme/level at the top and ID/EN bottom right. Advanced layout/type and secondary roles live in an appearance dialog. Native view links preserve query/hash state. Toolbar height comes from its real ResizeObserver measurement.

Realistic stock photos are illustrative, not portraits of the fictional named educators. Avoid decorative eyebrow labels, unnecessary cards, gradient decoration, inflated performance statistics, pills and navigation arrows. Program pages and operations prioritize readable details and clear actions.

## Interaction decisions

School uses ui-core buttons, inputs, textareas and dialogs and Radix Select through `Pick`; the mobile navigation uses a Radix dropdown with keyboard navigation, Escape and focus return. FAQ blocks use a reusable Radix collapsible and adapt the website-design-kit MOTION-01 quiet disclosure: a 160ms opening fade and rotating state indicator, disabled by the reduced-motion rule. The MOTION-07 menu informed the compact navigation, adapted to Radix rather than native details. Required registration selects use Radix native form validation. Navigation updates immediately. Institution sections use the motion contract below; other presets retain shared reveals. The kit guides interaction, not brand tokens.

Interaction matrix: selects support keyboard selection and Escape; dialogs restore focus on close; disclosures toggle with Enter or Space; menus support arrow keys and Escape; required form fields use browser validation; asynchronous actions disable while busy and report errors; reduced motion removes transitions and animations. Language changes retain the current demo state.

Local interaction evidence (2026-11-01): Playwright checked the FAQ opening duration (160 ms; 0 ms with reduced motion), mobile menu Escape/focus return and link selection, locale changes while the FAQ stays open, and page overflow at 390 and 1280 px. Local 1280 × 800 loaded captures are in `public/demo-previews`; the separate deployment workflow owns the canonical hosted `/previews/` evidence. These local checks do not establish hosted release readiness.

## Institution demo, 2026-11-03

The institution preset keeps the shared toolbar, URL state, palette and feature levels. Its institutional layout uses a full-bleed photographic hero, an open asymmetric photo composition and a featured information area. Separate bilingual pages cover profile, vision, contact, admissions and its two sample pathways, news and story details, activities, extracurriculars, immersion, achievements, gallery, school services and educators. Content and imagery are fictional or illustrative, with sources in `content/photo-sources.json`.

The visual direction adapts WORK-07's varied image hierarchy and MOTION-04's short headline entrance. Image motion and hover feedback are decorative, never required for reading or navigation; `prefers-reduced-motion` disables the new movement. UI controls continue using shared components. Added semantic illustration tokens in `school.css` for the hero overlay, light surface, blue-green field and yellow action. School information and content categories remain independently editable through the existing CMS.

The institution home adds image-led achievement and immersion highlights, a four-item activities directory, and a gallery preview driven by published CMS records. The footer presents published destination links, configured fictional contact details and the demo disclosure. No real school identity or social account is implied.

Homepage stories and archives avoid repeated photos within the same view; remaining articles use open text rows. Gallery preview omits images already used on the homepage. The complete eight-image CMS gallery remains available on its own page. The homepage hero uses a generated Indonesian junior-high campus scene; its prompt and provenance are in `content/photo-sources.json`, and the optimized asset is `public/images/institution/campus-project.webp`.

Page navigation replaces the page immediately, without a full-page exit fade or movement; section-level motion remains independent and respects reduced-motion settings.

## Institution content and motion review, 2026-11-03

Page navigation uses explicit localized paths through `src/routing.ts`, with `/en` for English, native anchors, history/back/forward, and legacy query-bookmark normalization. Queries retain independent demo controls and campaign/hash state. Brand assets are centralized in `config/institution.json`, validated by `content/institution-brand.ts`; demo fallbacks live in `src/institution-brand.ts`. The same institutional home composition reads eight editable CMS blocks in demo and client mode. Generated clients start without fictional teachers, admissions fees, cohorts or news.

The inner pages use background-image openings, a leadership hierarchy and searchable 18-person directory, admissions timelines/checklists/FAQ, eight clubs with schedules and mentors, daily schedules, facilities, school-office services, academic calendar and dated articles. These are editable published CMS blocks, not screenshot mockups. `timeline-`, `checklist-`, `club-`, `schedule-`, `facility-`, `service-`, `calendar-` and `faq-` block ID prefixes select the information layout; other blocks use the regular renderer. Preserve these IDs when editing an existing block. All school names, staff, dates, fees and outcomes are fictional demo content.

Selected content groups settle over 750ms using cubic-bezier(.19,1,.22,1), with at most 220ms stagger. The observer starts 40px before a section enters the viewport. Initial content remains visible, no observer failure can hide it, and changing reduced-motion preferences cancels active movement. Image hover uses the same easing at 650ms; controls retain brief feedback. This adapts the local Tampiloka site rhythm without an exit animation or loading curtain.

Review evidence is local: typecheck, design-token lint, server/domain tests, client/Worker builds, standalone generation and the institution Playwright suite. The suite checks 16 routes, 360/390/1440px overflow, directory search/empty/filter/language state, keyboard FAQ, live reduced motion, loaded images, history/reload and CMS draft isolation. Full-page loaded screenshots are in ignored `test-results/institution`. Initial kit captures in `test-results/review` can miss lazy images during async bootstrap; use the loaded suite captures for visual judgment. No deployment or exhaustive accessibility conformance assessment is claimed.

The kit UI-rule checks found no issues in the captured admissions and faculty views. Axe checked admissions at 390px and 1440px; the first run found visible-label/accessibility-name mismatches in the demo language control and gallery link. Their names now include the visible labels. The repeat run reports zero violations and manual color-contrast review items for text over photography and decorative checklist marks. The navy-on-yellow marks and image-overlay readability were reviewed separately; this is not a full-site WCAG conformance claim. The browser suite also exercises draft save, authorized preview, publication and public article-date propagation.
