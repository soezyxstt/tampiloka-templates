# Move an existing D1 database to Turso

Move one family at a time. Commerce, Booking, and School each use their own Turso libSQL database and a read/write token for that database. The Cafe public demo keeps its data in the browser.

## Public demo credentials

The URLs for the three public databases live in each template's `wrangler.demo.jsonc`. Set one GitHub Actions secret per demo. This Bash command requires an authenticated Turso CLI and GitHub CLI. It pipes each database token straight to the repository.

```bash
set -o pipefail
for family in booking commerce school; do
  turso db tokens create "tampiloka-$family-demo" |
    gh secret set "TURSO_${family^^}_AUTH_TOKEN" --repo soezyxstt/tampiloka-templates || break
done
```

The release workflow checks the live schema and checksum ledger with that token, then uploads it alongside the matching Worker version. Prepare and verify the final D1 copy before merging or releasing. For new client databases start with `tampiloka-db migrate`.

## Prepare and freeze writes

1. Identify the D1 database by UUID and the matching Worker from the deployed version. Save that version ID and its original bindings and triggers. A generated client has its own database.
2. Enable the Turso database's foreign keys. Keep new Workers disconnected from the empty target until the restore passes. For an existing store, schedule a maintenance window and stop every source writer, including scheduled cleanup, payment webhooks, notifications and jobs. Serve maintenance responses until validation finishes. Record the start time and arrange retries for queued payments. Even a demo bootstrap may create a session.
3. Run from the checkout with Node 22.18+, Python 3, the locked pnpm dependencies, and Wrangler authenticated for the source. Keep snapshots in a private directory outside this repo. Leave it in place for recovery. Work in a fresh directory for each export.

```sh
umask 077
FAMILY=commerce
D1_NAME='tampiloka-commerce-demo'
SNAPSHOT="$(mktemp -d)"
pnpm --filter "@tampiloka/template-$FAMILY" exec wrangler d1 export "$D1_NAME" --remote --output "$SNAPSHOT/source.sql"
python3 scripts/stage-d1.py "$SNAPSHOT/source.sql" "$SNAPSHOT/staged"
```

Choose the source database name for this family. Match the UUID printed by Wrangler to the UUID you recorded. The staging tool loads the table definitions, inserts the saved rows, then installs indexes, views and triggers. This avoids charging stock or loyalty points a second time when restoring orders. Staging checks SQLite integrity and foreign keys and preserves the D1 migration ledger. It omits SQLite optimizer statistics, which depend on the database engine. Keep the original export with the staged files.

## Import and compare

Set `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN` in the local process environment from a secret manager. The token must apply to the one target database. Copy its hostname separately from the Turso dashboard or the Worker config and pass it as the last argument.

```sh
TARGET_HOST='verified-target-hostname'
node scripts/cutover-turso.mjs import "$FAMILY" "$SNAPSHOT/staged" "$TARGET_HOST"
node scripts/cutover-turso.mjs verify "$FAMILY" "$SNAPSHOT/staged" "$TARGET_HOST"
```

The importer checks for an empty target and writes the schema and rows in a single, short transaction. It commits before scanning the rows. Keep the target disconnected and pause every writer until verification finishes. The check compares schema definitions, row counts and SHA-256 digests of typed row values, including BLOBs. It also runs SQLite integrity and foreign-key checks. Output contains table names, counts and digests. If the connection drops during commit or verification fails after commit, leave the target offline and run `verify` first. Retry import only against an empty target. Keep the old Worker on maintenance if any check fails.

For a snapshot that exceeds the import command's request size limit, create a **new** libSQL database from the staged SQLite file. Pick an unused name and the correct group, then set the new URL, token and hostname before running the same `verify` command.

```sh
turso db create unused-database-name --group your-libsql-group --from-file "$SNAPSHOT/staged/source.sqlite" --wait
```

See the [Turso file import limits](https://docs.turso.tech/cli/db/create).

## Switch traffic

1. After comparing the data, run the shared migration tool from the matching template. `adopt` records the checked-in migration checksums only when the restored schema matches. For an older schema, adopt on the release that matches the source first, then run `migrate` and `verify` on the target release. Set client credentials separately for each database.
2. Deploy the target Worker with the matching database URL and database-scoped secret. Cloudflare continues to host the app. Keep both snapshots until the rollback window ends. Test the public domain, a known record from before maintenance, and one isolated customer/staff flow. Re-enable scheduled work exactly once and resume traffic.
3. Before reopening writes, rollback can restore the saved Worker version with its D1 binding, secret configuration and triggers. After the first Turso write, freeze writers again and reconcile new changes before restoring D1, including payment or booking records.

```sh
cd "templates/$FAMILY"
pnpm exec tampiloka-db adopt
pnpm exec tampiloka-db verify
```
