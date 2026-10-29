# Responsive staff and customer regression coverage

The original desktop sidebar used viewport-fixed positioning and covered the demo toolbar, disclaimer and scenario picker. The shared staff shell now uses an in-flow grid with a sticky sidebar and header. Expanding a demo panel needs no hard-coded offset. The current desktop sidebar is 216 px; tablet navigation stays above the workspace. Staff selection shows a name, with the role separately below the brand, and occupies a full-width mobile row or a 280 px tablet/desktop column.

## Interaction-state overflow

Payment feedback previously used a non-shrinking status badge. Long text widened the entire page. InlineNotice now wraps locally, including unbroken references; the root document never hides overflow. A new 320 px test also identified a narrow demo-toolbar overflow, and kitchen navigation exposed a flex wrapper whose minimum content width exceeded the phone viewport. Both constraints are fixed on their owning components.

## Browser gates

- demos-compact-ui.mjs triggers a real demo payment instruction, checks feedback at 320, 360, 390, 412, 768, 1280 and 1920 px, checks long unbroken text and tests all five customer themes. It exercises keyboard navigation, category filtering and account selection. A temporary no-wrap override must reproduce the feedback defect.
- demos-staff-layout.mjs checks all nine staff-enabled presets at 390, 768, 1024, 1279, 1280, 1440, 1920 and 2560 px, at the top and after scrolling. It tests hit targets, panels, account labels, sidebar geometry and dialog stacking. Negative controls must detect the old fixed sidebar and an injected 500 px content width on a 390 px viewport.
- demos-browser.mjs checks every preset and its allowed customer/staff controls.
- demos-lifecycle.mjs checks customer/staff journeys, including catalog-waiter with fulfillment and an offline receipt, and all 14 mock states.

Viewport changes wait for actual dimensions, media queries, sidebar visibility and account-control width to agree. Injected negative controls must first reach browser layout, then fail the unchanged geometry assertions. Tests never wait for overflow to disappear, loosen tolerances or retry failures until green. All suites run even when one fails, so a single run retains evidence for every suite and still exits unsuccessfully if any failed.

Run locally after installing Chromium:

```sh
npm run demos:build
npm run test:demo-all
```

Main-release verification compares the exact tested entry CSS and JavaScript on the hub and all nine hosts before running live layout, compact interaction and catalog handoff checks. CI also runs HTTP integration against freshly generated client projects. Evidence stays in CI artifacts, not the source tree. Public browser checks use fresh browser-local demo data and block network writes; they do not reset existing users' sessions.
