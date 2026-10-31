import {
  capabilities,
  type Booking,
  type BusinessSettings,
  type PaymentStatus,
} from "../../src/domain/model.ts";
import { terminal } from "../../src/domain/state.ts";
import {
  canonical,
  choice,
  fail,
  id,
  object,
  text,
} from "../../src/domain/validation.ts";
import {
  all,
  changedGuard,
  configFor,
  deploymentConfig,
  expire,
  q,
} from "../db.ts";
import { digest, requireCapability, requireStaff, uid } from "../security.ts";
import type {
  BookingRow,
  Env,
  PaymentRow,
  Session,
  Statement,
} from "../types.ts";
import { now } from "../types.ts";
import {
  paymentProviders,
  type ProviderStatus,
} from "../providers/payments.ts";
import {
  bookingDetail,
  eventStatements,
  issueTicket,
  mutation,
  rawBooking,
} from "./bookings.ts";

async function gate(env: Env, s: Session) {
  requireCapability(capabilities((await configFor(env, s)).level), "payments");
}
function balanceStatus(
  paid: number,
  total: number,
  refunded: number,
  eligible: number,
): PaymentStatus {
  if (eligible > 0) return "refund_due";
  if (paid > 0 && paid === refunded) return "refunded";
  if (paid >= total) return "paid";
  return paid > 0 ? "partial" : "unpaid";
}
function paymentMutation(env: Env, p: PaymentRow, status: string): Statement[] {
  return [
    q(
      env,
      "UPDATE payments SET status=?,version=version+1,updated_at=? WHERE id=? AND scope=? AND version=?",
      status,
      now(env),
      p.id,
      p.scope,
      p.version,
    ),
    ...changedGuard(env),
  ];
}
export async function startPayment(
  env: Env,
  s: Session,
  bookingId: string,
): Promise<Booking> {
  await gate(env, s);
  await expire(env, s);
  const row = await rawBooking(env, s, bookingId);
  if (
    row.status !== "awaiting_payment" ||
    row.payment_method !== "online" ||
    row.due_now <= row.paid_amount
  )
    fail(
      409,
      "PAYMENT_NOT_DUE",
      "This appointment is not awaiting online payment.",
    );
  if (!s.demo && !env.MIDTRANS_SERVER_KEY)
    fail(503, "PAYMENT_NOT_CONFIGURED", "Online payment is not configured.");
  let payment = await q(
    env,
    "SELECT * FROM payments WHERE scope=? AND booking_id=? AND status IN('created','starting','pending')",
    s.scope,
    bookingId,
  ).first<PaymentRow>();
  if (!payment) {
    // The unique active-payment index and booking CAS close simultaneous start requests.
    const pid = uid("pay_"),
      reference = uid("tlb_"),
      stamp = now(env);
    try {
      await env.DB.batch([
        ...mutation(env, s, row, {}, "payment_started"),
        q(
          env,
          "INSERT INTO payments(id,scope,booking_id,provider,amount,status,reference,created_at,updated_at) VALUES(?,?,?,?,?,'created',?,?,?)",
          pid,
          s.scope,
          bookingId,
          s.demo ? "demo" : "midtrans",
          row.due_now - row.paid_amount,
          reference,
          stamp,
          stamp,
        ),
      ]);
    } catch (error) {
      if (!/constraint/i.test(String(error))) throw error;
    }
    payment = await q(
      env,
      "SELECT * FROM payments WHERE scope=? AND booking_id=? AND status IN('created','starting','pending')",
      s.scope,
      bookingId,
    ).first<PaymentRow>();
    if (!payment)
      fail(409, "PAYMENT_CHANGED", "Payment changed. Reload the appointment.");
  }
  if (s.demo || payment.checkout_url) return bookingDetail(env, s, bookingId);
  if (payment.status === "starting" && now(env) - payment.updated_at < 30000)
    fail(409, "PAYMENT_STARTING", "Payment is being prepared. Retry shortly.");
  const lock = await q(
    env,
    "UPDATE payments SET status='starting',version=version+1,updated_at=? WHERE id=? AND version=?",
    now(env),
    payment.id,
    payment.version,
  ).run();
  if (!lock.meta?.changes)
    fail(409, "PAYMENT_STARTING", "Another request is preparing payment.");
  const provider = paymentProviders[payment.provider]?.(env);
  if (!provider)
    fail(503, "PROVIDER_UNKNOWN", "Payment provider is not configured.");
  try {
    const url = await provider.create(
      payment,
      Math.ceil(((row.expires_at || now(env)) - now(env)) / 60000),
    );
    await q(
      env,
      "UPDATE payments SET status=CASE WHEN status='starting' THEN 'pending' ELSE status END,checkout_url=?,version=version+1,updated_at=? WHERE id=? AND scope=?",
      url,
      now(env),
      payment.id,
      s.scope,
    ).run();
  } catch (error) {
    // A timeout may follow a successful external create. Keep the same reference for recovery.
    await q(
      env,
      "UPDATE payments SET status='created',version=version+1 WHERE id=? AND status='starting'",
      payment.id,
    ).run();
    throw error;
  }
  return bookingDetail(env, s, bookingId);
}
/** Apply only canonical, server-fetched provider state or an explicitly isolated demo result. */
export async function applyStatus(
  env: Env,
  paymentId: string,
  value: ProviderStatus,
  demo = false,
) {
  await expire(env);
  const eventKey = await digest(canonical({ paymentId, ...value }));
  for (let attempt = 0; attempt < 4; attempt++) {
    if (
      await q(env, "SELECT id FROM payment_events WHERE id=?", eventKey).first()
    )
      return { ok: true, duplicate: true };
    const p = await q(
      env,
      "SELECT p.* FROM payments p JOIN scopes s ON s.id=p.scope WHERE p.id=? AND s.demo=?",
      paymentId,
      Number(demo),
    ).first<PaymentRow>();
    if (!p) fail(404, "PAYMENT_NOT_FOUND", "Payment not found.");
    if (value.reference !== p.reference || value.amount !== p.amount)
      fail(
        409,
        "PAYMENT_MISMATCH",
        "Payment reference or amount does not match.",
      );
    const s: Session = {
      scope: p.scope,
      principal: "provider",
      hash: "provider",
      role: "owner",
      demo,
    };
    const row = await rawBooking(env, s, p.booking_id, true);
    let statements: Statement[] = [];
    const paid = ["paid", "refund_pending", "refunded"].includes(p.status);
    if (value.state === "paid" && !paid) {
      const received = row.paid_amount + p.amount,
        late = terminal(row.status),
        eligible = row.refund_eligible + (late ? p.amount : 0);
      const status =
        row.status === "awaiting_payment" ? "confirmed" : row.status;
      statements = [
        ...paymentMutation(env, p, "paid"),
        ...mutation(
          env,
          s,
          row,
          {
            paid_amount: received,
            payment_status: balanceStatus(
              received,
              row.total,
              row.refunded_amount,
              eligible,
            ),
            refund_eligible: eligible,
            status,
            expires_at: status === "confirmed" ? null : row.expires_at,
          },
          late ? "late_payment_refund_due" : "payment_verified",
          demo ? "Demo simulation. No real money moved." : "",
        ),
        ...issueTicket(
          env,
          s,
          row.id,
          capabilities((await configFor(env, s)).level).tickets,
        ),
      ];
    } else if (
      value.state === "refunded" &&
      value.refundConfirmed &&
      value.refundedAmount > 0
    ) {
      if (value.refundedAmount > p.amount)
        fail(409, "REFUND_MISMATCH", "Provider refund exceeds this payment.");
      const refund = await q(
        env,
        "SELECT * FROM refunds WHERE payment_id=?",
        p.id,
      ).first<{ id: string; amount: number; status: string }>();
      if (!refund || refund.status !== "confirmed") {
        if (refund && refund.amount !== value.refundedAmount)
          fail(
            409,
            "REFUND_MISMATCH",
            "Provider refund differs from the requested refund.",
          );
        if (!paid)
          fail(
            409,
            "REFUND_BEFORE_PAYMENT",
            "Reconcile the original payment before its refund.",
          );
        const returned = row.refunded_amount + value.refundedAmount,
          eligible = Math.max(0, row.refund_eligible - value.refundedAmount);
        statements = [
          ...paymentMutation(
            env,
            p,
            value.refundedAmount === p.amount ? "refunded" : "paid",
          ),
          ...mutation(
            env,
            s,
            row,
            {
              refunded_amount: returned,
              refund_eligible: eligible,
              payment_status: balanceStatus(
                row.paid_amount,
                row.total,
                returned,
                eligible,
              ),
            },
            "refund_verified",
            demo ? "Demo refund simulation." : "",
          ),
          refund
            ? q(
                env,
                "UPDATE refunds SET status='confirmed' WHERE id=?",
                refund.id,
              )
            : q(
                env,
                "INSERT INTO refunds(id,scope,payment_id,booking_id,amount,status,reference,created_at) VALUES(?,?,?,?,?,'confirmed',?,?)",
                uid("rf_"),
                s.scope,
                p.id,
                row.id,
                value.refundedAmount,
                `provider-${p.id}`,
                now(env),
              ),
        ];
      }
    } else if (!paid && value.state === "expired") {
      statements = [
        ...paymentMutation(env, p, "failed"),
        ...(row.status === "awaiting_payment"
          ? mutation(
              env,
              s,
              row,
              { status: "expired", expires_at: null, payment_status: "failed" },
              "payment_expired",
            )
          : []),
      ];
    } else if (!paid && ["pending", "failed_attempt"].includes(value.state)) {
      // Snap can later settle after a denied attempt. Preserve its token/reference and hold.
      statements = [
        ...paymentMutation(env, p, "pending"),
        ...(row.status === "awaiting_payment"
          ? mutation(
              env,
              s,
              row,
              {
                payment_status:
                  value.state === "failed_attempt" ? "failed" : "pending",
              },
              value.state === "failed_attempt"
                ? "payment_attempt_failed"
                : "payment_pending",
            )
          : []),
      ];
    }
    try {
      await env.DB.batch([
        ...statements,
        q(
          env,
          "INSERT INTO payment_events(id,payment_id,state,at) VALUES(?,?,?,?)",
          eventKey,
          p.id,
          value.state,
          now(env),
        ),
      ]);
      return { ok: true, duplicate: false };
    } catch (error) {
      if (!/constraint|SQLITE_BUSY/i.test(String(error))) throw error;
      if (attempt === 3)
        fail(
          409,
          "PAYMENT_CHANGED",
          "Payment changed concurrently. Retry this event.",
        );
    }
  }
  return { ok: false };
}
export async function webhook(env: Env, input: unknown) {
  if (env.DEMO_MODE === "true")
    fail(
      403,
      "DEMO_CALLBACK_DISABLED",
      "External payment callbacks are disabled in the public demo.",
    );
  requireCapability(capabilities(deploymentConfig(env).level), "payments");
  const provider = paymentProviders.midtrans(env),
    reference = await provider.authenticate(input);
  const p = await q(
    env,
    "SELECT p.id FROM payments p JOIN scopes s ON s.id=p.scope WHERE p.reference=? AND p.provider='midtrans' AND s.demo=0",
    reference,
  ).first<{ id: string }>();
  if (!p) fail(404, "PAYMENT_NOT_FOUND", "Payment not found.");
  // The notification signature does not cover transaction_status. Fetch the authoritative record.
  return applyStatus(env, p.id, await provider.status(reference));
}
export async function reconcilePayment(
  env: Env,
  s: Session,
  bookingId: string,
  staff = false,
) {
  await gate(env, s);
  if (staff) requireStaff(s, true);
  await rawBooking(env, s, bookingId, staff);
  if (!s.demo) {
    const ps = await all<PaymentRow>(
      env,
      "SELECT * FROM payments WHERE scope=? AND booking_id=? AND provider<>'location'",
      s.scope,
      bookingId,
    );
    for (const p of ps)
      await applyStatus(
        env,
        p.id,
        await paymentProviders[p.provider](env).status(p.reference),
      );
  }
  return bookingDetail(env, s, bookingId, staff);
}
export async function simulatePayment(
  env: Env,
  s: Session,
  bookingId: string,
  input: unknown,
) {
  if (!s.demo)
    fail(
      403,
      "DEMO_ONLY",
      "Payment simulation is only available in an isolated public demo.",
    );
  await gate(env, s);
  await startPayment(env, s, bookingId);
  const state = choice(
    object(input).status,
    ["paid", "failed"] as const,
    "Simulation status",
  );
  const p = await q(
    env,
    "SELECT * FROM payments WHERE scope=? AND booking_id=? AND provider='demo' ORDER BY created_at DESC LIMIT 1",
    s.scope,
    bookingId,
  ).first<PaymentRow>();
  if (!p) fail(404, "PAYMENT_NOT_FOUND", "Start payment first.");
  await applyStatus(
    env,
    p.id,
    {
      reference: p.reference,
      amount: p.amount,
      transactionId: p.id,
      state: state === "paid" ? "paid" : "failed_attempt",
      refundedAmount: 0,
      refundConfirmed: false,
    },
    true,
  );
  return bookingDetail(env, s, bookingId);
}
export async function recordLocationPayment(
  env: Env,
  s: Session,
  bookingId: string,
  input: unknown,
) {
  await gate(env, s);
  requireStaff(s, true);
  const raw = object(input),
    key = id(raw.idempotencyKey, "Request key"),
    reference = text(raw.reference, "Receipt reference", 100, true);
  const row = await rawBooking(env, s, bookingId, true),
    existing = await q(
      env,
      "SELECT * FROM payments WHERE scope=? AND reference=?",
      s.scope,
      `local-${row.id}-${key}`,
    ).first<PaymentRow>();
  if (existing) return bookingDetail(env, s, bookingId, true);
  if (
    !["confirmed", "checked_in", "completed"].includes(row.status) ||
    row.paid_amount >= row.total
  )
    fail(409, "PAYMENT_NOT_DUE", "No remaining on-site payment is due.");
  const remaining = row.total - row.paid_amount;
  await env.DB.batch([
    ...mutation(
      env,
      s,
      row,
      { paid_amount: row.total, payment_status: "paid" },
      "location_payment_recorded",
      reference,
    ),
    q(
      env,
      "INSERT INTO payments(id,scope,booking_id,provider,amount,status,reference,created_at,updated_at) VALUES(?,?,?,'location',?,'paid',?,?,?)",
      uid("pay_"),
      s.scope,
      row.id,
      remaining,
      `local-${row.id}-${key}`,
      now(env),
      now(env),
    ),
  ]);
  return bookingDetail(env, s, row.id, true);
}
export async function refundPayment(
  env: Env,
  s: Session,
  bookingId: string,
  input: unknown,
) {
  await gate(env, s);
  requireStaff(s, true, true);
  const raw = object(input),
    reason = text(raw.reason, "Refund reason", 300, true),
    manualReference = text(raw.reference, "Refund receipt", 100);
  const row = await rawBooking(env, s, bookingId, true);
  const prior = await q(
    env,
    "SELECT id FROM refunds WHERE scope=? AND booking_id=? AND status IN('requested','pending')",
    s.scope,
    bookingId,
  ).first();
  if (row.refund_eligible === 0 && !prior)
    return bookingDetail(env, s, bookingId, true);
  let remaining = row.refund_eligible;
  for (const p of await all<PaymentRow>(
    env,
    "SELECT * FROM payments WHERE scope=? AND booking_id=? AND status IN('paid','refund_pending') ORDER BY created_at",
    s.scope,
    bookingId,
  )) {
    let refund = await q(
      env,
      "SELECT * FROM refunds WHERE payment_id=?",
      p.id,
    ).first<{
      id: string;
      amount: number;
      reference: string;
      status: string;
    }>();
    if (refund?.status === "confirmed") continue;
    if (!refund) {
      if (remaining <= 0) break;
      const amount = Math.min(remaining, p.amount),
        key = uid("rf_");
      if (p.provider === "location" && !s.demo && !manualReference)
        fail(
          422,
          "REFUND_RECEIPT_REQUIRED",
          "Record the external refund receipt after returning the money.",
        );
      await env.DB.batch([
        q(
          env,
          "INSERT INTO refunds(id,scope,payment_id,booking_id,amount,status,reference,created_at) VALUES(?,?,?,?,?,'requested',?,?)",
          key,
          s.scope,
          p.id,
          bookingId,
          amount,
          key,
          now(env),
        ),
        ...paymentMutation(env, p, "refund_pending"),
      ]);
      refund = { id: key, amount, reference: key, status: "requested" };
    }
    remaining -= refund.amount;
    if (s.demo || p.provider === "location") {
      await applyStatus(
        env,
        p.id,
        {
          reference: p.reference,
          amount: p.amount,
          transactionId: p.id,
          state: "refunded",
          refundedAmount: refund.amount,
          refundConfirmed: true,
        },
        s.demo,
      );
    } else {
      await paymentProviders[p.provider](env).refund(
        p,
        refund.reference,
        refund.amount,
        reason,
      );
      await q(
        env,
        "UPDATE refunds SET status='pending' WHERE id=? AND status='requested'",
        refund.id,
      ).run();
    }
  }
  await env.DB.batch(
    eventStatements(
      env,
      s,
      row.id,
      "refund_requested",
      s.demo ? "Demo refund, no real funds." : manualReference || reason,
    ),
  );
  return bookingDetail(env, s, bookingId, true);
}
