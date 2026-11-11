# Cafe D1 snapshot compatibility

Version-1 snapshots with the exact pre-attendance business table set, or the exact initial four-table attendance set, are accepted alongside the current set. Missing current attendance tables are initialized empty in memory; existing rows are retained. Reads do not persist the migration. The next successful write persists the complete snapshot using the existing revision compare-and-swap and retry mechanism.

Unknown, incomplete, or malformed table sets remain invalid. Automatic additions are limited to tables present in the attendance schema; other schema changes and changes to existing columns require an explicit migration. The two historical table sets are frozen in `d1-state.ts`; future persisted intermediate sets need an explicit entry before they can be upgraded. Unsupported snapshot versions remain rejected.

Verification on 2026-11-11 in the working tree:

- `node --experimental-strip-types --test templates/cafe/src/db/sqlite.test.mjs` — passed (7 tests), including legacy records, write roundtrip, conflict retry, current data, invalid sets, rollback, capacity, and version rejection.
- `pnpm --filter @tampiloka/template-cafe typecheck` — passed.

These checks use the local SQLite-backed D1 test adapter; they do not verify a hosted D1 deployment.
