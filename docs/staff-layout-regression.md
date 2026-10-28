# Staff layout regression

The desktop sidebar used `position: fixed; top: 0` while the demo toolbar, disclaimer and scenario picker lived above the staff application in normal document flow. At the 1280 px sidebar breakpoint this covered the left-hand demo controls. Earlier acceptance tests focused on 1024 px staff views, where that sidebar is hidden.

The shared staff stylesheet now uses a two-column desktop grid. The sidebar stays in normal flow and becomes sticky only after the staff shell reaches the viewport top. Header and main content occupy the second column without the old 232 px margins. Expanding either demo disclosure changes the shell position naturally; there are no hard-coded demo-header heights or resize listeners. Tablets retain top navigation. The staff account selector gets enough width for its longest seeded name and role at tablet/desktop widths.

## Regression coverage

`tests/demos-staff-layout.mjs` checks all eight staff-enabled presets at 390, 768, 1024, 1279, 1280, 1440, 1920 and 2560 px. It checks top-of-page and scrolled geometry, hit-testing of demo and staff controls, the sidebar breakpoint, duplicate gutters, horizontal overflow, name/role clipping, expanded disclosures and new-order dialog stacking. A temporary fixed-sidebar negative control must reproduce covered demo controls before the real layout is tested.

Run all local browser gates after building:

```sh
npm run demos:build
npm run test:demo-all
```

Run only the deployed layout checks:

```sh
CAFE_DEMO_BASE_DOMAIN=tampiloka.site node --experimental-strip-types tests/demos-staff-layout.mjs
```

The Verify template workflow also offers a manual `live_layout` input for the deployed checks. Reports and screenshots are uploaded as CI artifacts, not committed. Tests use fresh browser storage, verify the explicit local-only demo runtime, and block real network mutations. They do not reset any user's demo session or send real orders/payments.
