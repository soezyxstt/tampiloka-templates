# Architecture

## Application boundaries

`src/domain/` holds shared types, validated content schemas, capability rules, state transitions, use-case adapters and timezone math. `worker/services/` owns scheduling, reservations, content, tickets and financial mutations. `worker/providers/` owns outbound payment and notification adapters. React pages call the API; they do not write bookings, payments or ticket state directly.

One generated project serves one business and one deployed business preset. The public demonstration is a separate deployment and database. Its server creates a random scope per visitor and keeps the four example presets inside that scope. Scope IDs never come from browser-supplied headers or query parameters.

A small typed content layer supplies collection-like validation, references, owner permissions and a staff editor. A large CMS would add runtime and deployment cost without changing these needs. Payload is not a dependency. A future CMS adapter should preserve these service contracts rather than bypassing booking mutations.

## Persistence

SQLite migration `0001_booking.sql` creates business scopes, settings, typed content entities, customers, bookings, booking events, resource units, allocations, blackouts, access grants, payments, payment events, refunds, tickets, notification jobs, rate limits and mutation guards. `BookingItem` is an immutable snapshot in the booking row; packages are one service with a combined duration and price, not multiple independent bookings. Categories, locations, services and practitioners/resources use validated typed records in `entities`.

All queries bind values. Scopes form part of data lookups and constraints. Prices, service names, durations, customer details and cancellation rules are snapshotted at creation so a later CMS edit does not silently alter an existing commitment. UTC milliseconds persist instants; each appointment also stores its IANA timezone. Operating hours use local weekday/minutes.

Client settings/content seed only an empty database. Afterwards, the staff CMS owns stored content. The deployment configuration always owns the feature level and preset. Changing a preset in a populated client database needs an explicit content migration; do not treat it as a tenant switch.

## Double-booking and concurrent edits

Availability is advisory until the booking transaction commits. It intersects service duration/buffers, location hours, practitioner/resource hours, time off, service capacity, location capacity and required physical resources. Medical uses a practitioner; beauty uses a therapist and room; detailing uses a bay and vehicle-adjusted duration; on-site consulting adds a room, while remote consulting does not.

Every occupied five-minute interval creates allocation rows. Their primary key is `(scope, resource, unit, tick)`. A request allocates all required resources plus virtual service/location capacity in one Turso transaction. Any collision aborts the batch, including the booking and customer writes. There is no process-local lock and no dependence on a particular Worker instance.

A scope revision serializes new bookings/reschedules against schedule and capacity edits. Conditional updates use a SQL `CHECK` guard based on `changes()` so a lost compare-and-swap aborts the **whole** batch, including events. Booking writes have bounded retries; a slot that remains occupied returns a conflict. Rescheduling deletes old allocations and creates new ones in the same transaction: a failure leaves the old reservation intact.

Terminal state triggers release allocations and revoke tickets. Expiration runs during relevant requests and the scheduled cleanup. A late verified payment does not revive an expired/cancelled appointment; it records a refund liability.

The Worker sends each batch to Turso over HTTP. All statements share one transaction, so conditional writes and the following `changes()` guard see the same connection.

## Access and permissions

The server stores a hash of a random, HttpOnly, host-only session cookie. HTTPS adds Secure. Staff login rotates the cookie and retains the visitor principal. Owner, operations and viewer permissions are enforced in services, independently of visible buttons. The initial identity adapter uses separate server-held passwords for these roles. It is deliberately replaceable with an organization identity provider.

Customer history contains the current principal's bookings and explicit one-booking access grants. A reference plus a 256-bit access key restores access on another device. It does not reveal the original customer's entire history. Access keys are never part of QR payloads or page URLs. Internal staff notes never appear in customer responses.

Creation keys are scoped to the principal. A replay with the same normalized request returns the same booking and access key; changed content with the same key fails. `GET /api/bookings/attempt/:key` supports recovery after a lost HTTP response without guessing that creation failed.

## Payment and ticket integrity

Booking status and payment status are separate. The server owns required deposit amounts and the ledger. The Midtrans adapter verifies the notification signature and then fetches the authoritative provider record; redirect parameters cannot settle a payment. Amount/reference checks, unique payment events, optimistic versions and one-active-payment constraints protect retries. Provider timeout recovery reuses the original payment reference. A declined Snap attempt can later succeed, so a decline alone does not release the hold prematurely.

Refund request acceptance differs from bank-confirmed refund receipt. Reconciliation records refunds only after the provider confirms the expected amount. Offline payments/refunds require an authorized staff action and an external receipt reference.

Tickets contain only an opaque ticket ID, version and scope-bound HMAC. Validation rechecks the signature, persisted ticket, booking state and arrival window on the server. Repeated check-in reports an already-used ticket rather than recording a second arrival. Rescheduling revokes the old ticket.

## Demo and URL state

`preset`, `level`, `layout`, `palette`, `view`, `role`, `lang`, page and detail IDs have independent URL values. `theme` is accepted as a palette alias. History changes update React state; serialized demo configuration writes prevent rapid selector changes from racing. URL values cannot change a production capability or staff role. Client builds compile public demo chrome out and use an owned copy of shared UI.

## Main API groups

`/api/bootstrap`, `/api/quote`, `/api/whatsapp`, `/api/availability`; `/api/bookings`, `/api/bookings/attempt/:key`, `/api/access`, `/api/bookings/:id/actions` and authorized `/api/bookings/:id/availability` (also under `/api/staff/bookings/:id/availability`); payment, receipt and reconciliation subroutes; `/api/staff/login`, `/api/logout`, staff calendar/list/detail/content/settings/blackouts/report/tickets; `/api/webhooks/midtrans`; isolated `/api/demo/*` only in demo deployments.
