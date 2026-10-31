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
