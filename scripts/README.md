# Local demo database

Use Node.js 22.6 or later. Run `npm run demo` to prepare a persisted PGlite database and start Next.js on port 3000. This uses the same schema and application commands as PostgreSQL; `ensureSeeded` creates the sample outlet on the first request.

The database defaults to `.local/cafe-db`, outside `public` and ignored by Git. Set `CAFE_DEMO_DATA_DIR` for another directory. Run only one Next.js process against each directory, and stop that server before running `npm run demo:prepare` again. Schema setup refuses migrations that would remove data.

`CAFE_DEMO_DB=1` explicitly selects PGlite. Without that flag, the existing PostgreSQL connection uses `SQL_HOST`, `SQL_USER`, `SQL_PASSWORD`, and `SQL_DB_NAME`. The local `.env.local` created for this preview is ignored by Git. For an ordinary `npm run dev` using PGlite, put `CAFE_DEMO_DB=1` in `.env.local` after preparing the database.

This demo database does not provide production authentication or a payment-provider connection.

## Verification

- `npm run build`: production build and TypeScript pass.
- `node --experimental-strip-types src/domain/rules.test.ts`: 12 checks pass.
- `python scripts/check-order-workflow.py`: 17 integration checks pass against localhost, guarded to the demo payment account. It creates named test records and does not reset data.
- Browser flow: table QR entry, product configuration, cart/name, submit without GPS, cashier acceptance, pending demo QR, status refresh, image download, shared bill navigation, staff mobile layout, and dialog keyboard dismissal pass with no page errors. Screenshots and result metadata are in `public/screenshots/modernized/`.

Payment QR data uses a nonpayable `cafe-demo://` URI. Staff PIN/quick roles and the snapshot command API remain demo access; production authentication, authorization, membership login, and payment provider integration are not complete. Table sharing opens the selected table menu; it does not synchronize carts between customers.
