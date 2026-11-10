# Operations integration audit

Status: implementation in progress; no acceptance claim. Source: supplied
`Paket_Agent_Operasional_Multilokasi_v1.0.zip`, specification version 1.0.

The user prohibits builds, typechecks, dependency installation, and heavy CPU/RAM
checks in this workspace. Do not run these indirectly through development or test
scripts. Browser, load, restoration timing, availability, and packed standalone
verification remain unperformed. Source review is not runtime evidence.

## Integration boundaries to inspect after implementation

| Boundary | Required evidence | Current status |
| --- | --- | --- |
| Configuration → seed/runtime | A second business configuration changes identity, locations, SKU units, policies and feature availability without changing ledger code; production starts without demo transactions | Pending implementation review |
| Authentication → commands/reads | Active membership and paired role/location grants checked on every request, including retries, export and document lookup; last owner protected | Pending implementation review |
| Worker → durable storage | One persisted atomic result contains document, ledger entries, payment, voucher use and idempotency outcome; unexpected failures cannot leave partial effects | Pending implementation review |
| API → UI | Shared command/state contract, CSRF/session handling, scoped results, no fake successful actions; stable command ID retained across uncertain outcomes and reload | Pending implementation review |
| Demo toolbar → session | Theme, mode, locale and role independently addressable; switching persona preserves the same isolated demo business; language does not reset transactions | Pending implementation review |
| Ledger → documents/reports | Every mutation has a valid source and actor; balances derived from all movements; source drilldown and export obey identical scope and filters | Pending implementation review |
| Template → CLI/catalog | Manifest and registry IDs agree; standalone configuration and packaging prepared; planned/private until required verification exists | Pending implementation review |

## High-risk acceptance checkpoints

- AT01–06: opening 1,000; dispatch 200 gives 800/200/0; sale 5 gives
  800/200/-5; receive 200 gives 800/0/195. Retry adds nothing and changed payload
  under the same ID is rejected. These are required expected results, not measured results.
- AT07–15: partial receipts, damaged and outstanding quantities, excess findings,
  shortage decisions and actual goods returns remain distinguishable. No status
  transition may hide a remaining shipment balance.
- AT16–19: count adjustments use the cutoff difference and preserve later
  movements. Pending arrived shipments block closure. A late receipt correction
  and neutralization of the earlier count adjustment must commit together.
- AT20–23: unit factors are snapshotted, inactive SKU history remains accessible,
  mixed cashier-at-A/pricing-at-B grants never produce cashier-at-B privileges,
  and revoked sessions cannot replay or retrieve newly unauthorized results.
- AT24–29: effective price intervals are start-inclusive/end-exclusive; rounding
  and largest-remainder allocation are deterministic; original totals survive
  catalogue changes; the last voucher quota is consumed once; changed totals
  require fresh confirmation; legitimate free sales have no fabricated payment.
- AT30–33: money already collected remains discoverable when a sale is unresolved;
  refund without goods has no inventory effect; partial returns use original
  allocations and final rounding remainder; closed shift reports stay immutable.
- AT34–40: report totals and exports agree on scope, filters and time basis;
  recorded time is server-owned; backup restore validates references before any
  replacement; import identity prevents duplicate opening stock; disabled modules
  preserve historical documents; quality targets remain targets until measured.

## Review record

2026-11-10: read the supplied business rules AB01–34, functional requirements
KF01–38, use cases UC01–15, UI01–14, acceptance cases AT01–40 and decisions V01–12.
Implementation responsibilities are split across transactional domain/persistence,
UI, and reusable scaffold/registry. No build, typecheck, installation or acceptance
suite has been run. This file records integration risks separately from the
family requirement matrix; it must be updated with actual findings and evidence.

2026-11-10 integration pass: scaffold used `config/sample.json`, inconsistent with
the agreed runtime path. Replaced it with `config/operations.json` containing the
typed location/product fields, six locations in the specified three cities and
two cimol SKU. Kept opening stock and sample prices under `demo` for explicit
demo-only initialization. A small Python JSON/reference check passed (unique IDs,
valid seed references and positive unit factors); this does not prove runtime
configuration validation. Added separate local Wrangler persistence directories
for demo and client. Domain and UI implementers were informed of the canonical
configuration path and IDs. Added a role-based operator guide with expected
results explicitly distinguished from executed acceptance evidence.

2026-11-10 generator integration: added a dedicated Operations generator and
doctor behind the existing availability gate. Client output owns shared packages,
uses validated configuration, carries no demo balances/prices and locks the
development, frontend build and Worker to client mode. Source-only generation of
an alternate organization passed structural checks in a temporary directory.
Public registry remains planned; packed distribution and generated runtime remain
unverified. CLI payload families now derive from the available registry entries,
so a future approved promotion does not require a second hardcoded family list.
