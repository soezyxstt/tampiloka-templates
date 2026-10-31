# Extension guide

## New business use case

Add the preset ID to `src/domain/model.ts`, then implement a typed `DomainAdapter` in `adapters.ts`: form fields, step labels, option validation, price/duration adjustments, professional label and required resource kinds. Keep ordinary customer/contact and booking persistence in the shared services. Do not copy the application for a new business type.

Add a `PresetContent` seed with services, resources, locations and categories. Add preset-specific composition/copy only where the domain differs. Update both canonical registry files and the template manifest, then add seed validation, booking, resource contention and browser-flow tests. The CLI obtains its choices from the registry and emits only the selected business content.

## Fields and pricing rules

Fields define a stable key, localized label, required/max-length rules and select options where applicable. The same adapter validates server input and drives the customer form. Treat client values as choices, never prices. Compute price and duration on the server. Preserve the booking item/options snapshot so later changes do not alter history. Add tests for invalid choices, price changes, duration/buffer occupancy and serialization.

New availability constraints belong in `services/availability.ts` or a typed rule it invokes. A resource rule must also participate in database-safe allocation; checking only a frontend calendar cannot protect it from concurrent requests. Any new schedule-setting mutation must share the scope revision guard.

## Payment providers

Implement `PaymentProvider` in `worker/providers/payments.ts`: create a hosted checkout, authenticate callbacks, retrieve authoritative status, and request idempotent refunds. Register it in `paymentProviders`. Keep keys and provider requests server-side. Map provider responses into `ProviderStatus`; verify reference/currency/amount as appropriate. Never turn a redirect or client SDK callback into a paid ledger mutation.

Use a stable payment reference for retries, preserve uncertain initiation for recovery, and distinguish terminal failure from a retriable attempt. Pass verified states through `applyStatus`; do not create a parallel ledger. Extend booking configuration and staff/frontend method choices when exposing more than the supplied Midtrans provider. Tests must cover wrong amount/reference/signature, repeated/out-of-order events, failed initiation, expiry, late success and refund confirmation.

## Notifications

Implement the `NotificationChannel` contract and register/select it in the dispatcher. Consume the transactionally written notification outbox; use the event ID as the provider idempotency key. Distinguish queued, accepted and delivered. Add a delivery callback contract when actual delivery tracking is needed. Do not send a real message from demo mode.

## Staff identity

Replace `StaffIdentityProvider` while preserving a verified principal/role and cookie rotation. The supplied environment-secret adapter supports small deployments but not individual staff audit identities or MFA. Integration with a real identity provider should test session fixation, role mapping, logout, expired access and operations/viewer restrictions.

## Themes and components

Composition, palette, typography, business data and capability level are separate inputs. New layouts should change structure rather than merely swapping photographs. Reuse the shared button/input/dialog/motion layer; use Radix for selectable controls. Keep the staff information hierarchy stable across customer themes. Include keyboard, focus, mobile and reduced-motion checks.
