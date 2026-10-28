# Staff layout regression

The desktop sidebar used `position: fixed; top: 0` while the demo toolbar, disclaimer and scenario picker lived above the staff application in normal document flow. At the 1280 px sidebar breakpoint this covered the left-hand demo controls. Earlier acceptance tests focused on 1024 px staff views, where that sidebar is hidden.

The shared staff stylesheet now uses a two-column desktop grid. The sidebar stays in normal flow and becomes sticky only after the staff shell reaches the viewport top. Header and main content occupy the second column without the old 232 px margins. Expanding either demo disclosure changes the shell position naturally; there are no hard-coded demo-header heights or resize listeners. Tablets retain top navigation. The staff account selector gets enough width for its longest seeded name and role at tablet/desktop widths.

## Regression coverage

`tests/demos-staff-layout.mjs` checks all eight staff-enabled presets at 390, 768, 1024, 1279, 1280, 1440, 1920 and 2560 px. It checks top-of-page and scrolled geometry, hit-testing of demo and staff controls, the sidebar breakpoint, duplicate gutters, horizontal overflow, name/role clipping, expanded disclosures and new-order dialog stacking. Temporary negative controls must detect the original fixed-sidebar overlap and an injected, persistent 500 px content width on a 390 px viewport. Three repeated desktop-to-phone resize cycles exercise the operations preset. The complete layout suite has 158 checks.

## Viewport synchronization

The first post-deployment run of PR #3 failed at operations / 390 px with a reported document width of 484 px. A diagnostic run on the unchanged deployed application measured 192 samples across operations, cashier and full presets. In 47 of 48 immediate resize samples, Chromium reported the new 390 px `innerWidth` while the account selector still had its old 360 px desktop width. All 144 subsequent samples at 32 ms or later had the correct 390 px document width. Fonts had already finished loading. The navigation bar's intentionally scrollable children were not the source of document overflow.

The test now waits, for at most five seconds, for the requested viewport dimensions, media-query matches, sidebar display and account-selector width to agree. It does not wait for the no-overflow assertion to pass, add an arbitrary sleep, loosen geometry tolerances, hide document overflow or retry a failed test. Incorrect responsive styles time out, and independent geometry assertions still reject real overflow. The injected-overflow negative control verifies that distinction. Application code and business data do not change in this synchronization patch.

Diagnostic evidence: [run 40746149902](https://github.com/soezyxstt/cafe-template/actions/runs/40746149902), artifact `cafe-resize-diagnostic`. The temporary diagnostic workflow/script were removed after investigation; reports stay in CI artifacts rather than the source tree.

## Run the checks

Run all local browser gates after building:

```sh
npm run demos:build
npm run test:demo-all
```

Run only the deployed layout checks:

```sh
CAFE_DEMO_BASE_DOMAIN=tampiloka.site node --experimental-strip-types tests/demos-staff-layout.mjs
```

The Verify template workflow also offers a manual `live_layout` input for the deployed checks. Main releases compare the tested CSS bytes with the hub and all nine deployed presets before running the live layout suite. Reports and screenshots are uploaded as CI artifacts, not committed. Tests use fresh browser storage, verify the explicit local-only demo runtime, and block real network mutations. They do not reset any user's demo session or send real orders/payments.
