# Feature matrix and lifecycle

| Capability                                               | Catalog     | WhatsApp     | Booking | Full |
| -------------------------------------------------------- | ----------- | ------------ | ------- | ---- |
| Search, categories, service detail, profiles, hours, FAQ | Yes         | Yes          | Yes     | Yes  |
| Owner content editor and appearance settings             | Yes         | Yes          | Yes     | Yes  |
| Request summary and WhatsApp draft                       | No          | Yes          | Yes     | Yes  |
| Server availability and real reservation records         | No          | No           | Yes     | Yes  |
| Secure customer detail/history, cancellation/reschedule  | No          | No           | Yes     | Yes  |
| Staff calendar, appointment list, operational notes      | No          | No           | Yes     | Yes  |
| Free services and pay at location                        | Information | Request only | Yes     | Yes  |
| Online deposit/full payment and financial history        | No          | No           | No      | Yes  |
| Verified receipts, refund ledger and reconciliation      | No          | No           | No      | Yes  |
| Signed QR ticket and server-validated arrival            | No          | No           | No      | Yes  |
| Financial reporting and CSV export                       | No          | No           | No      | Yes  |

All four levels retain a staff content workspace. Lower levels reject booking/history/payment/ticket APIs even when a visitor manually constructs a request. They do not create customer appointment records. WhatsApp only builds an encoded message to a configured number. Opening that URL is not delivery, a booking or a confirmation. Public demos have no destination number.

Booking and Full support direct confirmation or manual confirmation. Online payment is an independently configured policy within Full: deposits from 1–100%, optional or required for paid services. Free services bypass online payment. The remaining deposit balance can be recorded at location in Full. Booking does not require a gateway or track financial receipts.

## Legal states

- `requested` can move to pending confirmation, awaiting payment, confirmed, cancelled or expired.
- `pending_confirmation` can move to awaiting payment, confirmed, cancelled or expired.
- `awaiting_payment` can move to confirmed, cancelled or expired.
- `confirmed` can move to pending confirmation on a policy-controlled reschedule, checked in, cancelled or no-show.
- `checked_in` can move to completed.
- Completed, cancelled, expired and no-show are terminal. Repeating the same state is safe; changing a terminal state is not.

The default create route starts at pending confirmation, awaiting payment or confirmed. `requested` exists for future approval/notification adapters, not as a fake confirmation step. No-show requires the appointment end time to pass. Check-in requires the configured arrival window. Cancellation/expiration removes allocations, not payment history. Payment callbacks that arrive after a terminal state retain that state and record refund liability.

`not_required`, `unpaid`, `pending`, `partial`, `paid`, `failed`, `refund_due` and `refunded` describe the separate financial lifecycle. A 30% deposit is `partial`, never a claim of full payment. A failed attempt can remain within its payment hold and retry safely.

Changing a deployed level gates existing records rather than deleting them. Before a downgrade, staff must settle outstanding appointments/payments and export any required financial records. Generate the higher level again for an upgrade: lower-level generated projects intentionally omit upper-level adapters.
