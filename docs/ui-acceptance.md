# Compact interface acceptance

This checklist covers the compact UI and catalog-request update. CI results and screenshots are retained as workflow artifacts, not source files.

## Required behavior

1. `--preset catalog` creates `catalog,ordering`, a guest cart and a waiter inbox, with offline payment. It must not expose POS, online payment creation or a kitchen screen. `--modules catalog` remains the explicit read-only, database-free alternative.
2. A guest submits a named, table-bound list; a staff member accepts or rejects it. Accepted requests keep their item choices, quantities and notes. Serving and confirming an offline receipt are distinct actions. A pending bill still blocks normal visit completion.
3. Long payment notices and error messages wrap within their column. This includes unbroken references and 320 px screens. Root `overflow-x:hidden` or `clip` must not conceal a layout error.
4. Category navigation and kitchen/workspace filters share ChoiceStrip. Native selects share SelectField and fieldStyles. Dialog-opening buttons remain buttons, not fake select fields.
5. Operational totals use StatStrip, and simple lists use separators rather than a separate card for every row. Primary touch controls retain a 44 px target.
6. Customer views work on phones. Staff views prioritize tablets/desktops, while a narrow staff view still allows reading and using controls without document-wide horizontal scrolling.
7. No temporary editing workflow, source archive, dependency archive or screenshot gallery enters generated client projects.

## Run locally

```sh
npm ci
npm run typecheck
npm run lint
npm test
npm run test:demo-runtime
npm run test:presets
npm run build
npm run demos:build
npx playwright install chromium
npm run test:demo-all
```

The browser suites include post-payment feedback, filters, five structural themes, all service presets, visit lifecycle and catalog-to-waiter handoff. Negative controls must reproduce the old fixed-sidebar problem, real persistent content overflow and unwrapped notice overflow; a detector that passes these injected defects is not a passing test.

## Release

Merge only after the exact final PR head passes the Verify template and generated-client jobs. After Cloudflare publishes main, `scripts/demos-live-verify.mjs` compares the tested release assets and checks the deployed UI and catalog handoff. A successful build alone is not deployment verification.

Public demos use isolated browser-local storage. Customer and staff tabs share data only within the same browser profile and preset hostname. Live customer phones and staff devices need an authenticated shared backend. Payment simulation does not collect money.
