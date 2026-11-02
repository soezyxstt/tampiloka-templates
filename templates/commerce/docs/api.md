# Commerce backend

The commerce template uses one Cloudflare Worker and one Turso database. The Worker serves `/api/*`; static frontend assets use the `ASSETS` binding. `worker/index.ts` exports the fetch handler, scheduled cleanup handler, and `Env` type. The typed frontend contract lives in `src/shared/contracts.ts`.

Rupa is a fictional store. The checked-in products, prices, bank details, delivery fees, and contacts are examples. The deployed demo does not accept real payments. Root configuration and client generation live outside this backend directory.

## Feature levels

| Capability | catalog | whatsapp | store | advanced |
| --- | --- | --- | --- | --- |
| Product catalog and staff product editing | Yes | Yes | Yes | Yes |
| Cart and wishlist | No | Yes | Yes | Yes |
| WhatsApp cart handoff | No | Yes | No | No |
| Checkout, orders, inventory, reports | No | No | Yes | Yes |
| Manual transfer and COD | No | No | Yes | Yes |
| Coupons, gateway, returns, verified reviews | No | No | No | Yes |

Optional modules can be selected separately through the CLI: promotions, taxes, service-fees, customer-accounts, loyalty-points, membership-tiers. See [optional-modules.md](optional-modules.md) for dependencies, calculation order, OTP setup, and production limitations.

These are server gates, not only hidden buttons. Production reads its level from `COMMERCE_LEVEL` or the generated `config/commerce.json`. A browser cannot elevate a production store through the demo controls. Appearance and feature level are separate.

## Configuration and bindings

| Setting | Purpose |
| --- | --- |
| `TURSO_DATABASE_URL` | URL of the store database |
| `TURSO_AUTH_TOKEN` | Server-only read/write token for that database |
| `ASSETS` | Optional static-asset fetch binding; use the built Vite assets |
| `DEMO_MODE` | Only the exact string `true` enables isolated public demo scopes |
| `COMMERCE_LEVEL` | Optional deployment override: `catalog`, `whatsapp`, `store`, `advanced` |
| `STAFF_OWNER_PASSWORD` | Owner secret, at least 12 characters; configure with Wrangler secrets |
| `STAFF_OPERATIONS_PASSWORD` | Operations secret, at least 12 characters |
| `STAFF_VIEWER_PASSWORD` | Read-only staff secret, at least 12 characters |
| `MIDTRANS_SERVER_KEY` | Server-only Midtrans key; never place it in Vite variables or client code |
| `RESEND_API_KEY` / `MEMBER_EMAIL_FROM` | Required only when member email login is enabled in production; never sent to clients |
| `MIDTRANS_ENVIRONMENT` | `production` explicitly selects live endpoints; every other value uses sandbox |
| `ALLOWED_ORIGIN` | Optional exact Origin validation override for a trusted reverse proxy; this is not a CORS implementation |

The generated JSON supplies brand fields, bank details, level, preset, appearance, return period, and optional `shippingMethods`. Each shipping method has `id`, `name`, `description`, integer `fee`, `estimatedDays`, and boolean `requiresAddress`. Delivery uses merchant-set flat fees and staff-entered courier/waybill details. It does not claim live courier quotes, label purchase, or courier tracking integration.

The supplied frontend and API are designed for the same origin. A separate frontend origin would also require explicit CORS, cookie, and frontend-credential changes; setting `ALLOWED_ORIGIN` alone does not enable that architecture.

Manual transfers remain unavailable in production while the bank account is empty, invalid, or all zeros. The online gateway remains unavailable without a server key. Staff access fails closed if its role secret is absent or shorter than 12 characters. There is no embedded production password. Demo WhatsApp returns an empty number; its interface previews the message instead of sending it to a sample contact.

## Sessions and authorization

`GET /api/bootstrap` creates an opaque random session cookie when needed. The cookie is `HttpOnly`, `SameSite=Lax`, and `Secure` on HTTPS. Only its SHA-256 hash is stored in Turso. Customer session lifetime is 30 days; isolated demo sessions last seven days. Staff login rotates the token and shortens its lifetime to eight hours.

Every demo visitor receives a separate store scope and can use its buyer and staff views. Demo staff access is intentionally open within that scope. Query parameters and caller-supplied scope headers never select another visitor's database scope. Production uses one store scope, with a separate customer session per visitor.

Production staff roles:

- **Owner:** catalog, stock, orders, refunds, coupons, settings, reports.
- **Operations:** stock changes, order handling, payment receipts, shipment, return handling, reports.
- **Viewer:** read-only staff views and export.

Customer reads and actions check both the scope and customer session. Being logged in as staff does not silently broaden a customer endpoint. The separate staff endpoints provide authorized store-wide access. Mutation requests reject cross-origin browser requests. Login, session creation, checkout creation, and tracking have server rate limits.

The template uses role secrets for a small staff team. It does not include customer passwords, OTP, a staff directory, password recovery, or multi-merchant marketplace accounts.

## API routes

Requests and responses use JSON unless noted. Successful bootstrap, quote, order, and staff snapshot routes return those contract objects directly. Errors return `{ "error": { "code": "...", "message": "..." }, "requestId": "..." }` with an appropriate HTTP status.

| Method and route | Input / result |
| --- | --- |
| `GET /api/health` | Database reachability and demo mode |
| `GET /api/bootstrap` | `Bootstrap`: configuration, gated capabilities, catalog, shipping/payment options, session, wishlist, reviews |
| `GET /api/products` | `{ products, categories }` |
| `POST /api/member/start` | `{email,name?}` → `{sent,expiresInSeconds}`; returns `demoCode` only when DEMO_MODE=true |
| `POST /api/member/verify` | `{code}` → verified member summary; binds membership to the current HttpOnly session |
| `POST /api/member/logout` | Unbinds member from current session (staff session unchanged) |
| `POST /api/quote` | `QuoteInput` → server-priced `Quote` |
| `POST /api/orders` | `CreateOrderInput` → `Order`; new orders also return a one-time `trackingCode` |
| `GET /api/orders/my` | `{ orders }`, latest 100 belonging to the current customer session |
| `GET /api/orders/attempt/:key` | `{ order }` or `{ order: null }`, lookup of that session's idempotent checkout attempt for recovery after a network error |
| `GET /api/orders/:id` | One owned order |
| `POST /api/orders/:id/actions` | `{ action, reference?, reason?, note? }` → updated `Order` |
| `POST /api/orders/:id/payment` | Retry creation of a missing Midtrans payment page |
| `POST /api/orders/:id/reconcile` | Fetch authoritative Midtrans status |
| `POST /api/orders/:id/tracking-code` | Rotate an owned order's access code → `{ number, code }` |
| `POST /api/orders/track` | `{ number, code }` → read-only access to exactly that order |
| `GET /api/wishlist` | `{ wishlist: productId[] }` |
| `POST /api/wishlist` | `{ productId }` toggles one saved product |
| `GET /api/reviews` | `{ reviews }` |
| `POST /api/reviews` | `{ productId, orderId, rating, comment }`; requires that customer's completed paid purchase |
| `POST /api/staff/login` | `{ password, role? }` → `Bootstrap` and rotated cookie |
| `POST /api/logout` | Revoke current session, create a fresh customer/demo session |
| `GET /api/staff/snapshot` | `StaffSnapshot` with latest 250 orders, full-store metrics/customer totals, and pagination metadata |
| `GET /api/staff/orders?limit=50&offset=0&q=&status=all` | `{ orders, total, hasMore, limit, offset }`; maximum page size 250; `total` counts all matching rows before pagination |
| `POST /api/staff/orders/:id/actions` | Staff transition → updated `Order` |
| `POST /api/staff/products` | New product → `{ product }` |
| `PUT /api/staff/products/:id` | Partial product update → `{ product }` |
| `POST /api/staff/inventory` | `{ variantId, delta, reason }` → `{ variant }` |
| `POST /api/staff/coupons` | Coupon fields → `{ coupon }` |
| `PUT /api/staff/settings` | Partial brand/bank/shippingMethods/shippingNote/returnDays → `{ config }` |
| `GET /api/staff/export/orders.csv` | CSV attachment, up to 10,000 orders; escapes spreadsheet formulas |
| `POST /api/webhooks/midtrans` | Signed Midtrans notification; re-queries provider status before applying it |

Demo-only routes: `POST /api/demo/config { level?, preset? }`, `POST /api/demo/role { role }`, `POST /api/demo/payment { orderId, status: "paid" | "failed" }`, and `POST /api/session/demo { reset?: true }`.

### Creating an order

```json
{
  "items": [{ "variantId": "linen-shirt-m", "quantity": 1 }],
  "shippingMethodId": "regular",
  "couponCode": "RUPA10",
  "customer": {
    "name": "Pembeli Demo",
    "phone": "081200000000",
    "address": "Alamat contoh",
    "city": "Bandung",
    "postalCode": "40111"
  },
  "paymentMethod": "manual",
  "expectedTotal": 314100,
  "idempotencyKey": "a-new-random-key-for-this-attempt"
}
```

The quote also includes `taxAmount`, `taxIncluded`, `serviceFee`, `pointsRedeemed`, and `pointsDiscount`. New orders snapshot the same values. Tax/fees default to zero and are off unless the module is enabled. See [optional-modules.md](optional-modules.md) for tax bases, point redemption, and the SQL migrations.

Money uses integer IDR. The server ignores submitted prices and totals other than `expectedTotal`, which acts as a buyer acceptance check. If the computed total differs, checkout returns `409 PRICE_CHANGED`. The server combines repeated variant lines, checks stock, validates quantities, checks the coupon and shipping method, and validates required recipient data.

Reusing the same idempotency key with the same payload returns the original order. Reusing it with a changed payload returns a conflict. Save the key for retries after uncertain network failures. A gateway timeout can occur after the order is safely stored; inspect `orders/my` or retry that same order's payment endpoint rather than creating a new order.

## Inventory and state transitions

Order creation, item snapshots, stock reservation, coupon usage, and audit records share one Turso transaction. SQLite triggers verify active products and current variant prices before reserving stock. Nonnegative stock and coupon-use constraints make concurrent overselling or over-redemption roll the whole batch back. Failed multi-line orders leave no partial reservation.

Product edits never overwrite existing variant stock. Use the signed `delta` inventory endpoint with a reason. Variant IDs used by historical orders remain stable. Cancel or returned-stock transitions restore stock once through a database guard, even after repeated requests. Order transitions use version checks so stale concurrent updates fail instead of overwriting each other.

| Actor | Action | Conditions / result |
| --- | --- | --- |
| Customer | `payment-evidence` | Manual unpaid order; saves a text reference and marks pending verification |
| Staff | `confirm-payment` | Manual/COD actual receipt; never marks a gateway paid |
| Staff | `process` | Confirmed order, with payment received or COD |
| Staff | `ship` | Processing order; address delivery requires courier and waybill, pickup does not |
| Customer | `confirm-received` | Shipped order whose payment has been recorded |
| Staff | `complete` | Same shipment/payment requirements |
| Customer | `cancel` | Awaiting-payment or confirmed order |
| Staff | `cancel` | Awaiting-payment, confirmed, or processing order |
| Customer | `request-return` | Completed paid order, within the configured return period |
| Staff | `approve-return` / `reject-return` | Review requested return; rejection needs a reason |
| Staff | `receive-return` | Approved return received; restores stock and records refund due |
| Owner | `refund` | Manual/COD refund needs an actual payment reference; demo simulates; gateway uses its adapter |

Order status, payment status, and return status are separate. A paid cancellation creates a refund liability; it does not pretend the buyer already received money. A late verified payment on a cancelled order also creates refund due without reopening the shipment or consuming stock again.

The transfer proof is a **text reference**, not a fake upload. The template does not claim to store uploaded bank receipt files. It also does not automatically move money for a manual refund.

## Cross-device tracking

A newly created order returns a random 128-bit access code once. Turso stores only its SHA-256 hash. A buyer who still owns the cookie session can rotate the code; the old code stops working. Another device submits the number and code to the tracking endpoint, which returns that order only. It does not sign that device into the buyer account, reveal other orders, or grant cancellation/payment/return actions. The interface labels this read-only view.

Tracking is limited to 10 requests per IP per 15 minutes. A phone number alone never authenticates order access. Treat the full code as private because order details contain recipient data.

## Payment adapter boundary

The default demo uses local simulated payment outcomes. Real Midtrans access requires merchant keys and a merchant account. No real gateway transaction was performed during implementation verification.

The adapter creates a Snap checkout transaction on the server and returns only the provider's validated checkout URL. It never exposes the server key. The webhook verifies the documented SHA-512 signature, then obtains canonical status through Midtrans's GET Status API because the legacy signature does not cover the `transaction_status` field. It compares order ID and gross amount and accepts settlement/capture only with successful status and accepted fraud state when present.

Payment events are idempotent. A delayed pending event cannot regress a paid/refunded order. Refund requests use a stable refund key. An accepted refund request stays `refund_due` until the provider confirms the full refund with bank confirmation. Unsupported payment-method refunds return an error rather than a false success. An owner may explicitly record a real external manual refund with `manual: true` and a reference if the merchant performs it outside the provider.

Official references used for implementation:

- [Turso SQL over HTTP](https://docs.turso.tech/sdk/http/reference)
- [Midtrans backend integration](https://docs.midtrans.com/reference/backend-integration)
- [Midtrans webhook signature and settlement rules](https://docs.midtrans.com/docs/https-notification-webhooks)
- [Midtrans GET transaction status](https://docs.midtrans.com/reference/get-transaction-status)
- [Midtrans refund request and bank confirmation](https://docs.midtrans.com/reference/refund-transaction)

## Cleanup and reports

The scheduled handler expires up to 500 unpaid manual/demo reservations in a batched transaction, with stock restoration, coupon release, and an audit trail. It reconciles due real gateway reservations with the provider before releasing their stock. It deletes expired sessions/rate limits and demo scopes without a live session. Configure a daily cron, or a more frequent schedule when transaction volume requires it. Manual transfers already awaiting staff verification remain reserved for review rather than being assumed unpaid.

Dashboard totals and customer aggregates cover the entire store even when the recent-order list reaches its 250-row page size. Revenue means orders currently marked paid; refunded/refund-due orders are excluded. CSV export includes up to 10,000 rows. Larger exports require an explicit paged export job rather than treating the recent list as the complete history.

The staff order list searches the entire store before applying pagination. `q` accepts up to 100 characters and matches a literal part of the order number, recipient name, or phone. `status` accepts `all`, any order status from the shared contract, `verification` for pending transfer verification, or `returns` for an active return. Invalid filters are rejected. Results sort by `created_at DESC, id DESC`. Count and page selection share one database batch so both use the same filters and store scope.

## Verification

Run the actual SQL/domain tests on Node 22.18+ or Node 24:

```sh
node --experimental-strip-types --test --test-isolation=none tests/backend.test.mjs
```

The harness runs the Worker against Node’s SQLite engine. It executes the migration, triggers, transactions, and Worker routes. It does not replace order calculations or authorization with mock responses. The 27 tests cover scope privacy, auth and role gates, cross-origin rejection, feature gates, idempotency and attempt recovery, concurrent overselling, multi-line rollback, coupon limits, expected totals, manual/COD lifecycle, returns/refunds, gateway signatures/status/amount/replay/failure, expired-session cleanup, CSV injection, tracking-code rotation/throttling, full-store totals beyond 250 orders, changed shipping fees, and filtered archive pagination across more than 250 orders.

Run a newly deployed **demo** through the live API:

```sh
node tests/backend-live.mjs https://ecommerce.tampiloka.site
```

The live script refuses `demo: false`, creates its own isolated scope, exercises nine buyer/staff/API scenarios, and resets that scope afterward. It never submits a real payment or sends a WhatsApp message. Browser visual/accessibility checks and tests of actual merchant credentials remain separate from these backend checks.

On 29 October 2026, all 27 SQL/Worker tests and strict backend TypeScript checks passed. The live API script passed all nine scenarios against the actual local Worker preview at `http://127.0.0.1:4174` and the deployed Cloudflare Worker at `https://ecommerce.tampiloka.site`, including attempt recovery in the latest report. The deployed test report is `test-results/live-api.json`. The later staff archive search/filter change has its own SQL/Worker tests and needs the matching frontend and Worker deployed together.
