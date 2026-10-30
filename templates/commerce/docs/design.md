# Commerce design decisions

## Shared demo exploration, 30 October 2026

Cafe and commerce now use `DemoToolbarShell` from `@tampiloka/ui-core/demo` and load `@tampiloka/ui-core/demo.css` after their own styles. One component owns logo placement, theme/mode selectors, customer/staff navigation, mobile wrapping, selected states and the measured `--demo-height`. The original outlined Tampiloka SVG links back to the gallery, including `/en/templates` for English visitors.

The demo theme and mode selectors use the same quiet outlined trigger, 8px corners, aligned 6px popup offset, right-side check and short popup motion as Tampiloka's existing form controls. Radix retains keyboard and focus behavior. Controls remain at least 44px tall, and select text is 16px on phones. Demo chrome uses stable `--demo-chrome-*` and `--demo-panel-*` tokens independently of the chosen storefront palette. The storefront layouts, product controls and staff workflows keep their own brand roles.

The mode select uses feature level; the theme select uses the existing composition preset. Both update the URL through the current store configuration flow. Changing a mode or theme while viewing staff keeps staff selected. ID/EN remains fixed at the lower right with the shared control style. `?lang=id` and `?lang=en` preserve the gallery locale across origins, and toggling the language updates that parameter without clearing preset, level, product or hash state.

The shared exports accept app-owned controls and view actions; they do not implement product or order behavior. New template demos should reuse these exports and provide their available views, localized accessible names and a gallery return URL. The new names `Tema demo`/`Demo theme` and `Mode demo`/`Demo mode` also appear in the browser test selectors.


The Sand palette uses a warm canvas (`#f7f5f1`), charcoal action (`#2a2420`) and clay price/promotion accent (`#a4492a`); Ink and Forest retain their palette IDs with warm-neutral and forest-green harmonies. Shared status and overlay tokens (`--tl-*`) are defined by `@tampiloka/theme-engine` and aliased in `src/styles/base.css` (the only place raw color values appear in commerce CSS). Minimum text size is 12 px everywhere (`pnpm lint:design`), with 16 px inputs on phones and ≥3:1 input borders (`--line-strong`). Demo controls support Indonesian and English, with the browser language as the initial choice.

Date: 29 October 2026 (palette and typography updated 30 October 2026; see `AGENTS.md`). Fictional concept brand: Rupa. The brand name, sample catalogue, prices, addresses, bank account and business copy are demonstration content, not claims about a real merchant. Public demo UI states this explicitly. Replace the content and licensed assets when generating a client project.
## Source references used

The website-design-kit skill guided composition, identity ownership, responsive order, primitives, motion and review. The following native desktop and mobile exports were inspected alongside each entry's notes and responsive component contract:

| Kit ID | Source | Adaptation |
| --- | --- | --- |
| WF-22 | [Shoppable collection](https://www.figma.com/design/eXWI36xzNr8gtLBxFW0G6r/Design-Kit?node-id=132-2699) | Category controls, honest counts, sorting, stock filter, product grid, empty results. A persistent category rail belongs to Market; other layouts keep the collection controls above products. |
| WF-23 | [Product detail and purchase](https://www.figma.com/design/eXWI36xzNr8gtLBxFW0G6r/Design-Kit?node-id=132-2984) | Product imagery precedes a decision column with price, required variants, stock, quantity and clear action. On mobile, media comes first and decisions follow. The template uses an accessible dialog so collection filters remain intact. |
| SB-11 | [Archive gallery](https://www.figma.com/design/eXWI36xzNr8gtLBxFW0G6r/Design-Kit?node-id=18-628) | Atelier uses unequal image areas, metadata outside images and an offset collection. Price and product actions remain predictable. |
| SB-14 | [Counter ledger](https://www.figma.com/design/eXWI36xzNr8gtLBxFW0G6r/Design-Kit?node-id=58-181) | Compact uses product rows with prices, stock and clear selection. Phone layout retains name, variant route and price without a wide table. |
| MOTION-06 | Filtered work grid | Motion layout transitions help follow products after filtering. Reduced motion removes transforms and transitions. |

These are independently authored DOM/CSS adaptations. No kit screenshot is used as a functioning page, and no pixel-equivalence or live Figma export claim is made.

## Four compositions, one brand

| Layout | Opening and navigation | Collection | Phone order |
| --- | --- | --- | --- |
| Editorial | Short typographic opening next to a large product photograph | Open four-column shelf, category controls above products | Title, action, image, filters, two-column products |
| Market | Direct collection task, compact introduction | Persistent category rail and dense three-column grid | Introduction, horizontal categories, search and sorting, two-column grid |
| Atelier | Large serif title, two differently sized photographs | Unequal image rhythm with offset product groups | Title, paired images, filters, staggered two-column collection |
| Compact | Quick ordering introduction with current cart quantity | Product rows with price and stock | Introduction, cart shortcut, search, compact product rows |

All four use the same initial catalogue and brand identity. They differ in actual DOM structure, density, reading order and media relationship. Editorial and Market are the first two credible alternatives; Atelier serves visually led collections, while Compact serves frequent assisted purchases. A single recolored hero would not meet these different tasks.

Palette, product-card treatment and button style remain independent of feature level and layout. The project-owned Rupa concept uses warm sand as the initial palette, Manrope for controls and text, and a restrained serif for selected public display text. This is a concept identity decision, not a palette inherited from the kit. Client config owns the final identity. The backend returns configured appearance, and production uses it instead of saved demo choices.

The staff workspace keeps the same navigation and action order across themes. Its sidebar, tables and order actions favor repeated operational use.

## Shared components and motion

`@tampiloka/ui-core` supplies Button, Input, NativeSelect, Textarea, Radix Dialog and MotionProvider. Commerce wrappers add loading states, quantity controls and task-specific composition. `@tampiloka/theme-engine` supplies validated appearance options and canonical brand color roles. Product cards share a single implementation with open, framed and soft variants.

Dialog portals trap focus and support Escape through Radix. Category changes and view changes use short transitions, dialogs use entrance/exit styling, and buttons show hover/focus feedback. `prefers-reduced-motion` removes transforms and timing. No text waits for an animation to become readable. Staff targets stay fixed.

## Transaction states

Product selection requires a valid in-stock variant. Cart totals are estimates until the server calculates a quote. Checkout displays a server quote and submits its expected total, so changed prices require another review. The server owns stock, discounts, order amounts, payment status and permissions.

The demo's WhatsApp path displays a local message preview with copy and download. It never links to a placeholder phone number. A configured production phone enables the explicit WhatsApp handoff. Gateway success is shown only after server confirmation; demo payment simulation is clearly labeled. Manual transfer asks for a text reference and does not pretend to upload evidence.

Order access codes enable read-only tracking from another device. Codes are masked by default and never appear in URLs. Buyers can save or rotate the code. The tracking view has no order mutation controls.

## Responsive contract

The main checks target 320, 390, 768 and 1440 CSS pixels. Product grids use two phone columns; detail dialogs stack media before decisions. Checkout uses a single phone column, with a complete total and submit action after all fields. Tables scroll only within a labeled table area; the page does not suppress body overflow. Staff navigation becomes a dismissible sidebar on narrow screens. Controls keep visible labels and focus styles.

## Assets and verification

Photo provenance and current local image files are recorded in `asset-sources.md`. Product images are sample product illustrations; they must not be presented as photographs of a client's actual stock without replacement and review.

Prior portfolio similarity comparison is not checked because the task is a new template family and no complete comparison set was provided.

## Served-build review, 29 October 2026

The implementation was built with Vite and tested against the actual local Worker and D1 preview at `http://127.0.0.1:4174`. These checks did not replace the API with mocks. Each scenario used its own isolated demo session. The browser was Chromium 141.0.7390.37 through Playwright 1.56.1; the kit capture and axe scripts used the kit's installed Playwright 1.62.1 with the same explicit Chromium binary.

### Visual and responsive results

`tests/visual.mjs` recorded **24 successful views**: all four layouts at 320, 390, 768 and 1440 CSS pixels, plus reduced-motion views at 390 and 1440 for every layout. Every captured view had no document overflow, no failed product image, no em dash in visible copy, and no uncaught browser error. The resulting report is `test-results/visual/report.json`; the screenshots are in that directory. Desktop and mobile screenshots of Editorial, Market, Atelier and Compact were inspected manually for composition, readable product decisions, image crop, hierarchy and density.

The review retained the four distinct architectures: Editorial's large photo and open shelf, Market's category rail and dense framed grid, Atelier's unequal photographs and staggered collection, and Compact's product rows. At narrow widths the category rail becomes a horizontal navigation area; rows remain rows; Atelier keeps its unequal image rhythm. The staff workspace uses a separate predictable layout. Its product and settings screens were reviewed at 1440 pixels, and its overview and open navigation at 390 pixels. Staff captures wait for the short entrance transition to complete. A final stable screenshot exposed a hardcoded toolbar offset; the sidebar and backdrop now use the toolbar's measured height through ResizeObserver, and the offset is zero when the demo toolbar is absent.

Mobile product names and prices were increased to 12 pixels, supporting metadata to 10 pixels, and category-count contrast was strengthened after visual review. Hero metadata now sits on an opaque dark strip, so readability does not depend on the photograph behind it. Core text and transaction controls remain larger than these compact product annotations.

The skill's `capture.mjs` produced `test-results/visual/kit-capture/manifest.json` at 320, 390, 768 and 1440 pixels. Its `check-ui-rules.mjs` returned **checked, zero findings, zero evidence gaps** in `test-results/visual/ui-rules.json`. This includes the kit's contextual eyebrow and pill checks. The UI uses functional squared statuses and controls; it has no decorative eyebrow headings, pill containers or em dashes. This tool result is evidence for the recorded views, not a claim that every future client configuration will satisfy the design rules.

### Keyboard and accessibility results

All eight recorded keyboard assertions passed: the product dialog receives focus, traps Tab, closes with Escape and returns focus to its opener; the staff mobile navigation receives focus, traps Tab, closes with Escape and returns focus to the menu button. The closed mobile sidebar is inert and absent from the accessibility tree. The main staff content becomes inert while the menu is open. Shared Radix dialogs now explicitly restore focus when a controlled dialog is opened without a Radix Trigger. Focus treatment uses the brand focus color; reduced-motion views retain complete content without entrance transforms.

The website-design-kit axe scan (axe-core 4.14.0) found **zero violations at 390 and 1440 pixels**. An earlier accessible-name mismatch on the large hero product link was fixed by letting the visible product name and price supply its name. One item remains in axe's `incomplete` category at each width: the active category's numerical count, because the active underline uses a pseudo-element. Manual review confirms that the underline sits below the text rather than behind it. The count uses `#62665c` on `#f7f5f0`, giving a calculated contrast ratio of **5.39:1**. Its role is a visible product count; it is not decorative text. The original axe output, including this incomplete item, is retained in `test-results/visual/accessibility.json` rather than overwritten as an automatic pass.

This is not a full WCAG conformance audit. Screen-reader reading order beyond the inspected semantic structure, every assistive-technology combination, every palette/content combination and live provider payment screens were not independently certified.

### Operational UI and recovery results

`tests/staff-browser.mjs` passed seven scenario groups using actual UI submissions and subsequent API reads: product creation with a relative image path; name/price editing while preserving audited stock; inventory adjustment and ledger appearance; coupon creation and deactivation; store identity and shipping-fee settings; viewer read-only controls; and operations stock access without catalog editing. Evidence is in `test-results/staff/report.json` and the corresponding stable screenshots. Product changes, stock, promotions and settings were persisted by the real Worker and D1 implementation.

The staff order list now loads all available history through `GET /api/staff/orders`, in pages of 50, with server-side search and status filters. It no longer uses the snapshot's latest 250 records as its data source. Search or filter changes reset to the first page; the visible range and filtered total are explicit. Previous requests are aborted and guarded by a sequence number, and results are tied to their request parameters, so older searches cannot replace a newer result. Selected order details are independent of the current page and are updated directly from successful action responses. When an action removes the last matching order on a page, the list moves back to the last available page while the detail stays open.

`tests/staff-pagination.mjs` passed four controlled browser regression checks with 301 fixture orders and a 250-order snapshot: opening the oldest order beyond the snapshot; changing that order while preserving its updated detail and correcting an empty last page; resetting pagination for server status filters; and rejecting a delayed stale search response. Its mobile check also passed at 390 pixels with scrolling confined to the table. A positioned table-scroll container prevents the visually hidden action-column label from extending the document width. This browser fixture tests the UI state machine; the backend's separate SQL regression verifies persisted queries, counts, filters, ordering and isolation. Evidence is recorded in `test-results/staff-pagination/report.json` and its desktop/mobile screenshots.

`tests/checkout-recovery.mjs` passed two additional scenarios. If a request was saved before the browser lost the response, order history locates the original idempotency key, opens the saved order and clears the pending attempt. If the request was never saved, the recovery action submits its original payload and key. Both produced exactly one order and cleared the matching cart and pending attempt. A changed cart is retained. This prevents a connection failure from silently creating a second order or permanently blocking the next checkout.

Commerce TypeScript checking and the production build passed after these fixes. Full customer/staff order lifecycle, cross-device tracking, simulated gateway and feature-level checks are maintained separately in the project's `tests/browser.mjs` business-flow suite. Real payment-provider credentials, settlements and courier integrations require their own configured production acceptance checks.

### Reproducing the checks

With the actual demo preview running, run the following from `templates/commerce` (set `PLAYWRIGHT_BROWSERS_PATH` if the browser installation is outside Playwright's default cache):

```sh
node tests/visual.mjs
node tests/staff-browser.mjs
node tests/staff-pagination.mjs
node tests/checkout-recovery.mjs
```

The additional tests accept `COMMERCE_TEST_URL`; they are intended for the isolated demo. Generated clients should test against a staging deployment with appropriate fixtures. The root lifecycle suite uses its own documented `COMMERCE_BASE_URL` setting. Transient screenshots, reports and browser logs remain in ignored test-output directories; the reproducible test sources and this review record are part of the repository.

