# Operations workspace integration

2026-11-10 — UI implementation in `src` outside `src/domain`. No other agent's domain, Worker, configuration, registry, or operator-guide files were edited.

## Implemented surfaces

- Responsive task navigation, owner overview, filtered SKU/location balances, outstanding shipments, negative-stock and discrepancy follow-up.
- Shipment drafts with multiple SKU lines and fixed unit choices; dispatch; arrival without stock change; partial receipt split by good/held condition; evidence/responsibility; supplemental dispatch, loss, origin return, discrepancy resolution and close/cancel commands.
- Receiving explicitly asks **Jumlah yang datang pada penerimaan ini / Quantity arriving in this receipt**, in base units. It shows current balance plus arriving quantity as an estimate; it never sets a final stock balance. Server-confirmed balances replace estimates.
- Counts capture the server cutoff/baseline, physical quantities, approval, linked late-receipt correction, reversals and held-stock release/disposal.
- POS product search, quantity editing, scoped local draft persistence, server-side price quotation, immutable quote fingerprint, discount/service/tax breakdown, payment amount/change and confirmation, numbered historical receipt and print action. An open own shift is required before completion. Historical receipts remain in reports across feature-mode changes.
- Partial return selects the original immutable sale line; good/held conditions are separate from refund without goods. Cashiers request approval; owners finalize. Payment recording and owner reconciliation are separate tasks.
- Shift opening, signed cash movements, counted close and separate post-close correction; recorded shift history.
- Location-specific dated price, promotion/voucher and tax/service profile creation. Price overlap, quota, allocation and historical consistency remain server decisions.
- Filtered server reports by location/city/SKU/time range/time basis with IDR totals and matching CSV endpoint. Source links open document and mutation details, related original/correction references and audit.
- Product/unit and location/policy editor, multi-assignment access editor with effective role/location preview, identity/module settings, import preview/apply, signed backup download and restricted restore upload.

All mutation actions invoke real `/api/commands` commands; no client-side stock ledger or optimistic success exists. Generic operational task forms intentionally reuse one validation, review, confirmation and error treatment. JSON is limited to advanced unit mapping/import, immutable audit details and recovery artifacts.

## Shared shell and accessibility

`DemoToolbarShell` supplies verified brand/gallery navigation, toolbar wrapping, selected persona treatment and ResizeObserver measurement of `--demo-height`. `demo.css` is the final CSS import. Top selectors keep `theme=sand|forest|ink`, `mode=inventory|retail|full`, and `preset=food|retail|supplies` separate. ID/EN uses the shared fixed bottom-right language control. Workspace bottom padding reserves its space. Native navigation anchors preserve modified-click behavior.

Controls reuse ui-core Button, Input, Textarea and Radix Dialog; a single Radix Select wrapper provides viewport-aware portals, check marks, scrolling and focus/keyboard handling. Labels and helper text are connected by IDs. Body text is 14px, metadata at least 12px, mobile inputs 16px, controls at least 44px, purchase confirmation 48px. Table overflow stays within its own region rather than hiding page overflow. Native number validation supplements server validation. Shared motion and short CSS disclosure/view feedback respect live `prefers-reduced-motion` changes; essential data is not gated by animation timers.

Semantic color values live only in `styles/tokens.css`. Shared aliases explicitly map `--brand-action`, `--brand-on-action`, `--brand-text`, `--brand-canvas`, `--brand-focus`, `--tl-danger`, and `--tl-overlay`. Brand action and fixed semantic status roles are distinct.

## URL and session decisions

Navigation uses URL/URLSearchParams and preserves unrelated query parameters and hashes. Back/forward restores route state. Explicit language overrides saved language, then the choice is retained. Config supplies initial theme/mode/preset, while business identity/products/locations come from the authorized server snapshot.

Demo login request: `POST /api/demo/session {persona, mode, preset}`. Switching persona keeps business data. Mode changes require a server update as well as UI gating: inventory blocks new POS/payment/shift/price operations; retail provides POS with commercial rules disabled; full enables commercial setup. Historical report/document routes remain available. Inventory mode maps unsupported cashier/pricing/mixed personas to owner.

Preset changes require actual server-selected sample content and dataset isolation. UI sends the selected preset and does not fabricate a local product catalog. At the latest inspected Worker revision, preset handling only changed two product names; the Worker/domain owner must complete unit/SKU/price sample selection and isolation before claiming presets complete. The confirmation copy describes the intended isolated-dataset contract. This integration remains an explicit acceptance gap until the server fulfills it.

## Uncertain results and freshness

The typed store imports `domain/contract.ts`, fetches the authenticated session and filtered state, and polls visible/online sessions every three seconds. It shows last successful fetch age, snapshot revision, offline status and failed-refresh warnings without replacing balances with zero. Older in-flight snapshots cannot overwrite newer revisions.

A per-page command lock prevents double submission. The generated UUID, command type, exact payload, actor and creation time are persisted to sessionStorage **before** sending. Network errors, timeout, invalid response and server 5xx keep the attempt uncertain and block new commands/persona changes. Definite 4xx rejections retain form input but permit correction. Recovery checks `GET /api/commands/:id`, accepting either a bare CommandResult or `{result,state}`; it then reloads a filtered snapshot. Retry sends the same identity and payload. No automatic replay, offline completion, second charge, or false success occurs. Server revalidates actor and location permissions on every command and replay.

Cashier drafts are scoped by user, preset and location and are never treated as completed sales. Their presence does not guarantee current stock or price. A recovered result can be traced from its document number even if the original form was closed.

## Acceptance coverage and remaining verification

| Requirements | UI integration | Acceptance status |
| --- | --- | --- |
| KF01–KF05 | Login, context, scope-pair access editor, masters and opening receipt | Implemented; unexecuted |
| KF06–KF13, KF17–KF18 | Stock, shipment and receipt tasks, condition splits, exceptions and stable identities | Implemented; unexecuted |
| KF14–KF16, KF32, KF38 | Count cutoff/variance, corrections and document/mutation trace | Implemented; unexecuted |
| KF19–KF28 | Quotes, pricing/promotions/profile, POS/payment, partial returns, shifts | Implemented; unexecuted |
| KF29–KF34 | Filtered reports/CSV, actionable exceptions, audit, freshness/recovery | Implemented; unexecuted |
| KF35–KF37 | Configuration defaults, modules, import preview/apply, backup/restore interface | Integrated; preset server gap; restore unproven |

AT01–AT40 have **not been run**. The expected main scenario remains warehouse 1000 → dispatch 200 → warehouse 800/transit 200 → sale 5 → outlet −5 → receipt 200 → outlet 195/transit 0; duplicate command must preserve 195. These are specification expectations, not observed results.

Checks performed: source/spec/contract inspection; `git diff --check -- templates/operations/src templates/operations/docs/ui.md` (no whitespace diagnostics for tracked changes); scoped `rg` scan found no raw color values outside token definitions or text below 12px. New untracked source also needs eventual full lint. The parent reported a lightweight WCAG calculation of ten pairs across the palettes; this UI agent did not independently execute that calculation.

Explicit task restriction: no install, build, typecheck, browser, heavy tests or high CPU/RAM processes. Consequently compilation, keyboard/dialog behavior, 360/390/768/1024/1280 layout, reduced motion, interrupted dialogs, main scenario, concurrency, 5-second sync target, report reconciliation, recovery, RPO/RTO and all acceptance assertions remain unverified. No performance or production-readiness claim is made.

Additional limitations to validate before pilot: independent browser sessions need a deliberate shared-business test setup rather than unrelated isolated demo rooms; generic task sources may list already-closed records and rely on server rejection; advanced import/unit editing requires JSON; payment evidence currently uses references instead of file attachment upload; commercial editors support creation and updating an existing scoped rule, but multi-location or multi-product rule editing currently uses one selected location/SKU; full user-facing localization of audit machine codes and business-supplied names is intentionally not attempted. Server errors expose their stable code with a bilingual explanation, with more specific translations for core stock/quote/access/recovery failures.

Final lightweight scan: 13 UI source files, zero missing relative import targets and zero trailing-whitespace findings. React source checklist applied without executing code: stable module-level components, hook ordering, native semantics, no parallel mutation requests, session-aware permissions, stale-response protection, retained drafts and command identity. Recovery clears the matching completed-sale draft; percentage UI values convert to domain basis points; outstanding stock derives from transfer-line remainders rather than the snapshot location transit placeholder.

## Pesan penolakan operasional

Pesan penolakan yang umum berada di `src/lib/errors.ts`, dengan pasangan Indonesia/Inggris: stok/kiriman, opname, sumber persetujuan, draf selesai, pembayaran tersimpan, rujukan duplikat, refund, sif, aturan harga/voucher, modul, dan sesi. Pesan memberi tindakan berikutnya serta mempertahankan instruksi jangan menagih ulang pada uang yang sudah tercatat. Kode tak dikenal tetap memakai fallback lokal tanpa menampilkan isi error server. Import modul melalui Node berhasil; uji keadaan error tersembunyi di browser masih belum dilakukan.

## Pemulihan tindakan lintas penutupan tab

Command belum pasti disimpan pada localStorage per identitas dan scope instalasi dari server sebelum dikirim. Scope memisahkan instalasi nyata, ruang demo dan preset; token sesi tidak disimpan di sini. Data berisi payload tindakan bisnis dan tetap berada pada profil browser sampai hasil pasti menghapus identitas terkait. Tidak ada replay otomatis. Storage/focus memperbarui pending antartab. Jika penyimpanan gagal atau rusak, aplikasi menahan pengiriman/pemulihan dan meminta pemeriksaan hasil server. Menghapus data situs menghapus bukti lokal; jurnal server tetap menjadi sumber hasil yang sudah disahkan. Draf lokal keranjang belum dipindahkan dari sessionStorage.
