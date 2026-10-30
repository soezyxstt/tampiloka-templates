# Monorepo verification, 29 October 2026

Source baseline: cafe `main` commit `b79159a10de879beb25fe2b7dbe0840e1313a0b1`. The original 151 file contents were verified by git blob SHA before migration. Source cafe logic remains under `templates/cafe`.

## Completed checks

| Check | Result |
| --- | --- |
| Pinned pnpm 10.28.2 workspace install | Passed, real `pnpm-lock.yaml` created |
| Registry tests | 6 passed |
| CLI generation tests | 7 passed |
| CLI packed archive installed outside repo | Passed with isolated npm global prefix |
| Packed CLI generated cafe and commerce | Passed without source checkout dependency |
| Generated standalone commerce `pnpm install` | Passed outside monorepo |
| Generated standalone commerce typecheck and build | Passed, frontend and Worker emitted |
| Cafe typecheck and public demo build | Passed |
| Cafe config/catalog/domain/database/UI tests | 97 passed |
| Cafe shared motion browser checks | 25 passed |
| Cafe compact UI browser checks | 40 passed |
| Cafe staff layout browser checks | 176 passed across all 9 presets |
| Cafe preset browser checks | 39 passed, 9 of 9 presets |
| Cafe lifecycle browser checks | 25 checks passed, 12 of 12 cases |

CLI tests cover the four commerce layouts with independently selected levels, appearance overrides, cafe catalog/full presets, invalid options, planned templates, path traversal, existing directories, symlink targets, and dry runs. Generated commerce uses local `file:` packages, empty production D1 ID, `DEMO_MODE=false`, and no copied `wrangler.demo.*`, `node_modules`, or `.dev.vars`.

Browser checks used Playwright 1.56.1 Chromium. Local reports and screenshots are in `templates/cafe/test-results`; those generated outputs are intentionally excluded from source commits. The scripts reproduce them.

Commerce transaction/security checks and live deployment verification have their own reports. This document does not assert that real payment credentials or live merchant settlement were tested.
