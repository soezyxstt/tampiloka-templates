# School and Booking UI verification, 2026-11-01

Baseline: `947653a`. This change brings School and Booking controls and state transitions toward the existing Cafe/Commerce interaction contract while preserving independent demo settings and Indonesian/English behavior.

The user clarified that updating means refreshing from `soezyxstt/agent-skills` through `npx skills`, rather than editing the installed skill. Both requested skills were refreshed with `npx --yes skills add soezyxstt/agent-skills --skill website-design-kit --skill copywriting-bahasa-indonesia --global --yes`. Installation succeeded for the shared Codex skill paths; the CLI also reported that PromptScript does not support global installation. The website kit lock hash is `66db47819995499b584d63ebc4791571d29afff5`; the copywriting hash is unchanged at `85b77acf658abe159186782aa0ec83700e645549`. A subsequent `npx --yes skills update website-design-kit copywriting-bahasa-indonesia --global --yes` confirmed both global skills are up to date. The upstream skill replaces the earlier local edit. Project-specific parity requirements remain in AGENTS.md.

## Localization repairs from independent audit

Booking bootstrap retains structured API errors until rendering, network failures carry a translatable code, and the fatal retry view uses the active locale and shared Button. School validation resolves configured/extension field names through the effective registration schema and uses a localized generic fallback for unknown identifiers. `node --experimental-strip-types --test templates/school/tests/messages.test.mjs` passes.

## Parent verification

- `corepack pnpm lint:design`: Design tokens OK (136 files at initial check; rerun after integration).
- `node scripts/check-docs-consistency.mjs`: passed.
- Refreshed kit `npm ci --ignore-scripts` and `node scripts/validate-kit.mjs --root .`: passed, 175 entries, no errors or warnings.
- `corepack pnpm catalog:test`: 5 tests passed.
- `corepack pnpm test:school`: 46 tests passed after localization repairs.
- `corepack pnpm test:booking`: 33 tests passed after localization repairs.
- `corepack pnpm test:cli`: passed.
- `corepack pnpm test:registry`: 27 tests passed, including release identity, failed promotion, preserved previous catalog and strict consumer exports.
- `corepack pnpm --filter @tampiloka/template-commerce typecheck`: passed.
- `corepack pnpm --filter @tampiloka/template-cafe typecheck`: passed.
- `git diff --check`: passed at initial shared-component edit; rerun after integration.

## Existing GitHub issue evidence

The existing repaired baseline already has hosted evidence for the two remaining open issues:

- #20: [School release job](https://github.com/soezyxstt/tampiloka-templates/actions/runs/41251027681/job/124684381022), source `947653ae816fac07f1469f1e0888e63d651de9aa`, passed 46 deployed API checks, hosted Chromium and exact hosted preview-byte verification. The overall matrix was cancelled because Cafe did not finish; School, Commerce and Booking jobs succeeded. A fresh isolated smoke from this machine reached submission, same-key retry and staff review, then stopped during payment on an unsettled network await. A fresh hosted browser failed at TLS with `ERR_CERT_AUTHORITY_INVALID`. These fresh partial results are not claimed as a full pass. The prior D1 quota diagnosis identified a current failure at rateLimit; no historical exception log proves the original incident had the same cause.
- #29: [Catalog publication](https://github.com/soezyxstt/tampiloka-templates/actions/runs/41256873617) succeeded for the same source, verified the 21-entry feed and retained Cafe’s prior verified release when new hosted evidence was missing. Local positive/negative promotion tests passed. Legacy Cafe deployment ownership and marketing compatibility with the additive release field remain operational follow-ups, not established by this checkout.

## Generated projects

- `corepack pnpm test:booking:standalone`: all four production clients passed independent installation, typecheck/build, doctor, local D1, production identity/CMS persistence/demo denial, and transactional customer/staff checks where enabled.
- School's pnpm-based standalone script timed out after dependencies/native postinstall completed (both its normal 180-second limit and a temporary 600-second trial). The script is unchanged. A fresh `/data/workspace/tampiloka-ui-verification/school-ui-verification` generated project instead passed `npm install --ignore-scripts --no-audit --no-fund`, `npm run typecheck`, `npm run build`, all 46 tests and CLI doctor. The install option skips lifecycle scripts; the subsequent build exercised the required build tooling.

## UI verification in progress

Focused family checks cover new disclosures at phone/desktop widths, keyboard operation, normal/reduced motion and EN-to-ID state preservation. School also exercises menu Escape/focus return. Four 1280 × 800 preview captures per family were refreshed. Root visual review caught and repaired Booking’s squeezed mobile category columns. A final static Terra review reported no concrete diff findings, with browser behavior outside its review scope.

Earlier full browser runs failed under machine contention and an orphaned Booking test Worker. The Booking harness now allocates an isolated free port, bounds health requests and fails if its child exits; it cannot silently use the orphaned server. School menu-close assertions now wait for exit-animation unmount rather than immediately counting DOM nodes.

The isolated Booking full run passed 43 of 47 checks, with no browser runtime errors; four checks timed out on page/readiness waits. The complete result is in `booking-full-browser.json`. Booking uses DOM-content-loaded plus explicit application readiness rather than network-idle waits in the retry. School’s dropdown checks pass after waiting for exit unmount; its full run then hit a page-readiness timeout. All four Booking timed-out scenarios passed targeted retries with no runtime errors (`booking-retry-browser.json` and `booking-last-retry-browser.json`). Thus all 47 scenarios have passing evidence across the full run and targeted retries; the initial full run itself remains recorded as failed. School’s final retry remains pending.

Both integrated family typechecks and production builds pass after all implementation changes. The baseline hosted results do not establish hosted readiness for this PR’s changed assets; the normal release workflow must verify the merged build before catalog promotion.
