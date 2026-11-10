// One process, deliberately small fixtures; no browser, build, or deployment runtime.
await import('./domain-stock.mjs');
await import('./domain-money.mjs');
await import('./domain-access.mjs');
await import('./storage-contract.test.mjs');
await import('./replay-scope.test.mjs');
await import('./hardening.test.mjs');
await import('./report-contract.test.mjs');
await import('./recovery-errors.test.mjs');
await import('./saved-carts.test.mjs');
await import('./backup-schedule.test.mjs');
await import('./audit-range.test.mjs');
await import('./attempt-storage.test.mjs');
