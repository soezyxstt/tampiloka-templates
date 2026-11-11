# Deployment and payment checklist

## Client-owned Cloudflare deployment

The generated Worker uses `DEMO_MODE=false`. The commands below use the default Turso provider; for D1 or PostgreSQL see [client setup](client-setup.md). Create a dedicated Turso database for the client. Set `TURSO_DATABASE_URL` and a database-scoped `TURSO_AUTH_TOKEN` in the migration environment. Supply the same URL and a read/write token for that database as Worker secrets. An organization token is unnecessary for SQL access. Use a separate migration token if the runtime token restricts schema changes.

```sh
pnpm exec wrangler login
pnpm db:migrate:remote
pnpm exec wrangler secret put TURSO_DATABASE_URL
pnpm exec wrangler secret put TURSO_AUTH_TOKEN
pnpm exec wrangler secret put STAFF_OWNER_PASSWORD
pnpm exec wrangler secret put STAFF_OPERATIONS_PASSWORD
pnpm exec wrangler secret put STAFF_VIEWER_PASSWORD
# Full only: a cryptographically random value, at least 32 characters.
pnpm exec wrangler secret put TICKET_SECRET
pnpm deploy
```

Only configure roles the client needs. Use different long random passwords. Serve production over HTTPS. Configure a custom domain using the client's account. Verify `/api/health`, content, sign-in, all applicable level boundaries and a real customer-to-staff test after deployment. Exercise backup/export and recovery before storing real customer data. Enable appropriate Cloudflare access controls and operational monitoring.

Scheduled cleanup runs every five minutes. It expires holds and sessions, reconciles bounded pending payment batches and processes the notification outbox. Availability/booking reads also expire stale holds, so correctness does not rely on the cron firing at an exact moment. Investigate provider failures and pending refund liabilities in the staff workspace.

## Public demonstration

Use a dedicated Turso database for `wrangler.demo.jsonc`, which enables demo mode. The config pins the database URL. Store the database-scoped token in the GitHub Actions secret `TURSO_BOOKING_AUTH_TOKEN`. Run `pnpm db:migrate:remote` with the demo database credentials before deployment. The release workflow verifies the Turso schema before deploying the demo build with its runtime token. Keep live payment and notification credentials separate. Preview screenshots are real browser captures, not design mockups.

Before publishing the catalog entry, verify the deployed origin, isolated visitor sessions, every level, customer/staff switching, a simulated deposit, ticket validation, and the preview image URLs. Each preview must be a 1280×800 WebP. Keep catalog `ready` false until that gate passes. A successful local test is not a live-URL check.

## Midtrans: sandbox first

The adapter implementation is real, but mocked automated tests do not prove that a merchant account is configured correctly. This template does not claim verified sandbox or live processing without the following evidence.

1. In a **client staging deployment**, set `MIDTRANS_SERVER_KEY` as a secret and `MIDTRANS_ENVIRONMENT=sandbox`. Set the deployed feature level to Full and configure `TICKET_SECRET`.
2. Configure the Midtrans notification endpoint as `https://YOUR_STAGING_HOST/api/webhooks/midtrans`. No browser-return route changes payment status.
3. Create a booking with an online deposit. Confirm the server amount equals the agreed deposit and that the checkout origin is Midtrans sandbox.
4. Complete a sandbox success, retry a declined attempt, retry an uncertain initiation, and replay a signed notification. Confirm exactly one paid ledger entry and one valid ticket. Change a browser return query to claim success and verify it has no effect.
5. Send invalid signatures and verify rejection. Confirm the server refetches canonical status and rejects wrong references/amounts. Check a late payment after hold expiry becomes a refund liability without recreating the reservation.
6. Cancel a paid booking, request a supported refund, and confirm its amount/status using the provider dashboard and canonical API. An accepted request alone must not be reported as returned funds.
7. Save non-secret evidence: staging URL, time, test booking references, expected amounts, callback/reconciliation results and provider sandbox result. Never commit server keys, customer data or access tokens.

Only after successful merchant-specific sandbox verification should the client switch to production credentials and `MIDTRANS_ENVIRONMENT=production`, with an agreed controlled live verification. Payment methods and refund support depend on the merchant account/provider; the template does not promise every method supports automatic refund.

Primary provider references:

- https://docs.midtrans.com/docs/https-notification-webhooks
- https://docs.midtrans.com/reference/get-transaction-status
- https://docs.midtrans.com/docs/snap-advanced-feature

## Notifications

The optional Resend adapter needs `NOTIFICATION_API_KEY` and `NOTIFICATION_FROM`. Use a verified sender/domain. Jobs are persisted transactionally, use an idempotency key, and retry with a lease. Provider acceptance is not proof of recipient delivery. Without credentials, no email sends; the customer must retain the appointment reference/access key. Public demos never send notifications.
