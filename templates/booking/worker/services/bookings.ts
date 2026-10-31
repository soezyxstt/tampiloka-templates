import type {
  Booking,
  BookingEvent,
  BookingPage,
  BookingStatus,
  BusinessSettings,
  Payment,
  Refund,
} from "../../src/domain/model.ts";
import { capabilities, BOOKING_STATES } from "../../src/domain/model.ts";
import { assertTransition, reschedulable } from "../../src/domain/state.ts";
import {
  canonical,
  choice,
  customer,
  fail,
  id,
  integer,
  object,
  text,
} from "../../src/domain/validation.ts";
import { TICK } from "../../src/domain/time.ts";
import {
  all,
  bootstrap,
  bumpRevision,
  changedGuard,
  configFor,
  expire,
  q,
  revisionGuard,
  scopeRow,
} from "../db.ts";
import {
  digest,
  hmac,
  requireCapability,
  requireStaff,
  uid,
} from "../security.ts";
import type {
  BookingRow,
  Env,
  PaymentRow,
  Session,
  Statement,
  TicketRow,
} from "../types.ts";
import { now } from "../types.ts";
import { selectedSlot, type AvailableSlot } from "./availability.ts";

export async function rawBooking(
  env: Env,
  s: Session,
  bookingId: string,
  staff = false,
): Promise<BookingRow> {
  if (staff) requireStaff(s);
  const row = await q(
    env,
    `SELECT * FROM bookings WHERE scope=? AND id=?${staff ? "" : " AND (principal=? OR id IN(SELECT booking_id FROM access_grants WHERE scope=? AND principal=?))"}`,
    s.scope,
    bookingId,
    ...(staff ? [] : [s.principal, s.scope, s.principal]),
  ).first<BookingRow>();
  if (!row) fail(404, "BOOKING_NOT_FOUND", "Appointment not found.");
  return row;
}
export function mapBooking(row: BookingRow): Booking {
  return {
    id: row.id,
    reference: row.reference,
    preset: row.preset,
    status: row.status,
    paymentStatus: row.payment_status,
    customer: JSON.parse(row.customer_json),
    item: JSON.parse(row.item_json),
    locationId: row.location_id,
    locationName: row.location_name,
    timezone: row.timezone,
    practitionerId: row.practitioner_id,
    practitionerName: row.practitioner_name,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    expiresAt: row.expires_at,
    total: row.total,
    dueNow: row.due_now,
    paidAmount: row.paid_amount,
    refundedAmount: row.refunded_amount,
    refundEligible: row.refund_eligible,
    options: JSON.parse(row.options_json),
    paymentMethod: row.payment_method,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    version: row.version,
    events: [],
    payments: [],
    refunds: [],
    ticket: null,
  };
}
export async function ticketPayload(
  env: Env,
  s: Session,
  ticket: TicketRow,
): Promise<string> {
  const secret = s.demo ? (await scopeRow(env, s)).secret : env.TICKET_SECRET;
  if (!secret || secret.length < 32)
    fail(503, "TICKET_NOT_CONFIGURED", "Ticket signing is not configured.");
  return `tampiloka-ticket:v1:${ticket.id}:${await hmac(secret, `${s.scope}:${ticket.id}`)}`;
}
export function issueTicket(
  env: Env,
  s: Session,
  bookingId: string,
  enabled: boolean,
): Statement[] {
  if (
    !enabled ||
    (!s.demo && (!env.TICKET_SECRET || env.TICKET_SECRET.length < 32))
  )
    return [];
  return [
    q(
      env,
      "INSERT OR IGNORE INTO tickets(id,scope,booking_id) SELECT ?,scope,id FROM bookings WHERE scope=? AND id=? AND status='confirmed' AND (payment_method='location' OR paid_amount>=due_now)",
      uid("tk_"),
      s.scope,
      bookingId,
    ),
  ];
}
export async function bookingDetail(
  env: Env,
  s: Session,
  bookingId: string,
  staff = false,
): Promise<Booking> {
  const cfg = await configFor(env, s);
  requireCapability(capabilities(cfg.level), "booking");
  const row = await rawBooking(env, s, bookingId, staff),
    result = mapBooking(row),
    cap = capabilities(cfg.level);
  const events = await all<{
    id: string;
    action: string;
    actor: string;
    note: string;
    at: number;
    internal: number;
  }>(
    env,
    `SELECT id,action,actor,note,at,internal FROM booking_events WHERE scope=? AND booking_id=?${staff ? "" : " AND internal=0"} ORDER BY at,rowid`,
    s.scope,
    bookingId,
  );
  result.events = events.map((e) => ({ ...e, internal: Boolean(e.internal) }));
  if (cap.payments) {
    const [payments, refunds] = await Promise.all([
      all<PaymentRow>(
        env,
        "SELECT * FROM payments WHERE scope=? AND booking_id=? ORDER BY created_at",
        s.scope,
        bookingId,
      ),
      all<{
        id: string;
        payment_id: string;
        amount: number;
        status: Refund["status"];
        reference: string;
        created_at: number;
      }>(
        env,
        "SELECT * FROM refunds WHERE scope=? AND booking_id=? ORDER BY created_at",
        s.scope,
        bookingId,
      ),
    ]);
    result.payments = payments.map((p) => ({
      id: p.id,
      amount: p.amount,
      provider: p.provider,
      status: p.status,
      checkoutUrl:
        !["cancelled", "expired", "completed", "no_show"].includes(
          row.status,
        ) && ["created", "starting", "pending"].includes(p.status)
          ? p.checkout_url
          : null,
      createdAt: p.created_at,
      reference: p.reference,
    }));
    result.refunds = refunds.map((r) => ({
      id: r.id,
      paymentId: r.payment_id,
      amount: r.amount,
      status: r.status,
      reference: r.reference,
      createdAt: r.created_at,
    }));
  }
  if (cap.tickets && ["confirmed", "checked_in"].includes(row.status)) {
    const ticket = await q(
      env,
      "SELECT * FROM tickets WHERE scope=? AND booking_id=? AND revoked=0",
      s.scope,
      bookingId,
    ).first<TicketRow>();
    if (ticket)
      result.ticket = {
        id: ticket.id,
        payload: await ticketPayload(env, s, ticket),
        usedAt: ticket.used_at,
        validUntil: row.ends_at + 86400000,
      };
  }
  return result;
}
export function eventStatements(
  env: Env,
  s: Session,
  bookingId: string,
  action: string,
  note = "",
  internal = false,
): Statement[] {
  const key = uid("ev_"),
    stamp = now(env);
  return [
    q(
      env,
      "INSERT INTO booking_events(id,scope,booking_id,action,actor,note,internal,at) VALUES(?,?,?,?,?,?,?,?)",
      key,
      s.scope,
      bookingId,
      action,
      s.role,
      note,
      Number(internal),
      stamp,
    ),
    ...(internal
      ? []
      : [
          q(
            env,
            "INSERT INTO notification_jobs(id,scope,booking_id,event,next_at) VALUES(?,?,?,?,?)",
            key,
            s.scope,
            bookingId,
            action,
            stamp,
          ),
        ]),
  ];
}
export function allocationStatements(
  env: Env,
  s: Session,
  bookingId: string,
  slot: AvailableSlot,
): Statement[] {
  const values = slot.assignments.flatMap((a) =>
    Array.from(
      { length: (slot.occupiedEnd - slot.occupiedStart) / TICK },
      (_, i) => ({
        resource: a.resource,
        unit: a.unit,
        tick: slot.occupiedStart / TICK + i,
      }),
    ),
  );
  return [
    q(
      env,
      "INSERT INTO allocations(scope,resource,unit,tick,booking_id) SELECT ?,json_extract(value,'$.resource'),json_extract(value,'$.unit'),json_extract(value,'$.tick'),? FROM json_each(?)",
      s.scope,
      bookingId,
      JSON.stringify(values),
    ),
  ];
}
const mutable = new Set([
  "status",
  "payment_status",
  "starts_at",
  "ends_at",
  "practitioner_id",
  "practitioner_name",
  "expires_at",
  "paid_amount",
  "refunded_amount",
  "refund_eligible",
]);
export function mutation(
  env: Env,
  s: Session,
  row: BookingRow,
  changes: Record<string, unknown>,
  action: string,
  note = "",
  internal = false,
): Statement[] {
  const keys = Object.keys(changes);
  if (keys.some((k) => !mutable.has(k)))
    throw new Error("Unsupported internal booking mutation");
  return [
    q(
      env,
      `UPDATE bookings SET ${keys.map((k) => `${k}=?`).join(",")}${keys.length ? "," : ""}version=version+1,updated_at=? WHERE scope=? AND id=? AND version=?`,
      ...keys.map((k) => changes[k]),
      now(env),
      s.scope,
      row.id,
      row.version,
    ),
    ...changedGuard(env),
    ...eventStatements(env, s, row.id, action, note, internal),
  ];
}
export async function accessToken(env: Env, s: Session, row: BookingRow) {
  return hmac((await scopeRow(env, s)).secret, `booking-access:${row.id}`);
}
export async function createBooking(
  env: Env,
  s: Session,
  input: unknown,
): Promise<Booking> {
  const raw = object(input),
    data = await bootstrap(env, s);
  requireCapability(data.capabilities, "booking");
  const key = id(raw.idempotencyKey, "Idempotency key");
  if (key.length < 16)
    fail(
      422,
      "INVALID_KEY",
      "Use a random idempotency key of at least 16 characters.",
    );
  const contact = customer(raw.customer),
    method = choice(
      raw.paymentMethod,
      ["location", "online"] as const,
      "Payment method",
    ),
    expectedTotal = integer(raw.expectedTotal, "Accepted price");
  const requestHash = await digest(
    canonical({ ...raw, customer: contact, idempotencyKey: key }),
  );
  const existing = await q(
    env,
    "SELECT * FROM bookings WHERE scope=? AND principal=? AND idempotency_key=?",
    s.scope,
    s.principal,
    key,
  ).first<BookingRow>();
  if (existing) {
    if (existing.request_hash !== requestHash)
      fail(
        409,
        "IDEMPOTENCY_CONFLICT",
        "This request key belongs to a different appointment.",
      );
    return {
      ...(await bookingDetail(env, s, existing.id)),
      accessToken: await accessToken(env, s, existing),
    };
  }
  for (let attempt = 0; attempt < 3; attempt++) {
    const {
      slot,
      service,
      quote,
      selection,
      data: fresh,
    } = await selectedSlot(env, s, raw);
    if (expectedTotal !== quote.total)
      fail(
        409,
        "PRICE_CHANGED",
        "The price changed. Review the new total before booking.",
      );
    if (
      method === "online" &&
      (!fresh.capabilities.payments || !fresh.paymentConfigured)
    )
      fail(
        403,
        "PAYMENT_UNAVAILABLE",
        "Online payment is not configured at this level.",
      );
    if (quote.paymentRequired && method !== "online")
      fail(422, "PAYMENT_REQUIRED", "This service requires an online payment.");
    const actualMethod = quote.total === 0 ? "location" : method,
      due = actualMethod === "online" ? quote.dueNow : 0,
      policy = fresh.config.policy;
    const status: BookingStatus = policy.manualConfirmation
      ? "pending_confirmation"
      : due > 0
        ? "awaiting_payment"
        : "confirmed";
    const expiry =
      status === "confirmed"
        ? null
        : now(env) +
          (status === "awaiting_payment"
            ? policy.paymentMinutes
            : policy.holdMinutes) *
            60000;
    const bookingId = uid("bk_"),
      token = await hmac(
        (await scopeRow(env, s)).secret,
        `booking-access:${bookingId}`,
      ),
      stamp = now(env),
      customerId = `cus_${s.principal}`;
    const reference = `APT-${new Date(stamp).toISOString().slice(0, 10).replaceAll("-", "")}-${bookingId.slice(-8).toUpperCase()}`;
    const row: BookingRow = {
      id: bookingId,
      scope: s.scope,
      preset: fresh.config.preset,
      principal: s.principal,
      customer_id: customerId,
      customer_json: JSON.stringify(contact),
      reference,
      idempotency_key: key,
      request_hash: requestHash,
      access_hash: await digest(token),
      service_id: service.id,
      item_json: JSON.stringify({
        serviceId: service.id,
        name: service.name,
        duration: quote.duration,
        unitPrice: quote.total,
        quantity: 1,
      }),
      location_id: selection.locationId,
      location_name: fresh.locations.find((l) => l.id === selection.locationId)!
        .name,
      timezone: fresh.locations.find((l) => l.id === selection.locationId)!
        .timezone,
      practitioner_id: slot.practitionerId,
      practitioner_name: slot.practitionerName,
      starts_at: slot.startsAt,
      ends_at: slot.endsAt,
      status,
      payment_status:
        quote.total === 0 ? "not_required" : due > 0 ? "pending" : "unpaid",
      payment_method: actualMethod,
      total: quote.total,
      due_now: due,
      paid_amount: 0,
      refunded_amount: 0,
      refund_eligible: 0,
      policy_json: JSON.stringify(policy),
      options_json: JSON.stringify(selection.options),
      expires_at: expiry,
      version: 0,
      created_at: stamp,
      updated_at: stamp,
    };
    const columns = Object.keys(row) as (keyof BookingRow)[];
    try {
      await env.DB.batch([
        ...bumpRevision(env, s, fresh.revision),
        q(
          env,
          "INSERT INTO customers(scope,id,principal,data) VALUES(?,?,?,?) ON CONFLICT(scope,principal) DO UPDATE SET data=excluded.data",
          s.scope,
          customerId,
          s.principal,
          JSON.stringify(contact),
        ),
        q(
          env,
          `INSERT INTO bookings(${columns.join(",")}) VALUES(${columns.map(() => "?").join(",")})`,
          ...columns.map((k) => row[k]),
        ),
        ...allocationStatements(env, s, bookingId, slot),
        ...eventStatements(env, s, bookingId, "created"),
        ...issueTicket(env, s, bookingId, fresh.capabilities.tickets),
      ]);
      return {
        ...(await bookingDetail(env, s, bookingId)),
        accessToken: token,
      };
    } catch (error) {
      const prior = await q(
        env,
        "SELECT * FROM bookings WHERE scope=? AND principal=? AND idempotency_key=?",
        s.scope,
        s.principal,
        key,
      ).first<BookingRow>();
      if (prior) {
        if (prior.request_hash !== requestHash)
          fail(
            409,
            "IDEMPOTENCY_CONFLICT",
            "This key belongs to another request.",
          );
        return {
          ...(await bookingDetail(env, s, prior.id)),
          accessToken: await accessToken(env, s, prior),
        };
      }
      if (!/constraint|mutation_guards|SQLITE_BUSY/i.test(String(error)))
        throw error;
      if (attempt === 2)
        fail(
          409,
          "SLOT_CONFLICT",
          "Availability changed. Choose another time or retry.",
        );
    }
  }
  return fail(409, "SLOT_CONFLICT", "Availability changed.");
}
export async function listBookings(
  env: Env,
  s: Session,
  params: URLSearchParams,
  staff = false,
): Promise<BookingPage> {
  const cfg = await configFor(env, s);
  requireCapability(capabilities(cfg.level), "booking");
  if (staff) requireStaff(s);
  await expire(env, s);
  const limit = integer(Number(params.get("limit") || 25), "Limit", 1, 100),
    offset = integer(Number(params.get("offset") || 0), "Offset", 0, 1000000),
    search = text(params.get("q"), "Search", 100),
    status = params.get("status") || "all";
  if (status !== "all") choice(status, BOOKING_STATES, "Status");
  const conditions = ["scope=?", "preset=?"],
    values: unknown[] = [s.scope, cfg.preset];
  if (!staff) {
    conditions.push(
      "(principal=? OR id IN(SELECT booking_id FROM access_grants WHERE scope=? AND principal=?))",
    );
    values.push(s.principal, s.scope, s.principal);
  }
  if (status !== "all") {
    conditions.push("status=?");
    values.push(status);
  }
  if (search) {
    conditions.push(
      "(instr(lower(reference),lower(?))>0 OR instr(lower(json_extract(customer_json,'$.name')),lower(?))>0)",
    );
    values.push(search, search);
  }
  for (const [key, op] of [
    ["from", ">="],
    ["to", "<"],
  ] as const)
    if (params.has(key)) {
      conditions.push(`starts_at${op}?`);
      values.push(
        integer(Number(params.get(key)), key, 0, 8_640_000_000_000_000),
      );
    }
  const where = conditions.join(" AND "),
    [page, count] = await env.DB.batch<BookingRow & { total: number }>([
      q(
        env,
        `SELECT * FROM bookings WHERE ${where} ORDER BY starts_at DESC,id LIMIT ? OFFSET ?`,
        ...values,
        limit,
        offset,
      ),
      q(
        env,
        `SELECT COUNT(*) AS total FROM bookings WHERE ${where}`,
        ...values,
      ),
    ]);
  return {
    bookings: page.results.map(mapBooking),
    total: count.results[0].total,
    limit,
    offset,
  };
}
export async function bookingAction(
  env: Env,
  s: Session,
  bookingId: string,
  input: unknown,
  staff = false,
): Promise<Booking> {
  const cfg = await configFor(env, s),
    cap = capabilities(cfg.level);
  requireCapability(cap, "booking");
  if (staff) requireStaff(s, true);
  await expire(env, s);
  const row = await rawBooking(env, s, bookingId, staff),
    raw = object(input),
    action = text(raw.action, "Action", 30, true),
    policy = JSON.parse(row.policy_json) as BusinessSettings["policy"];
  if (
    raw.version !== undefined &&
    integer(raw.version, "Version") !== row.version
  )
    fail(409, "STALE_VERSION", "The appointment changed. Refresh its details.");
  if (action === "cancel") {
    if (row.status === "cancelled")
      return bookingDetail(env, s, bookingId, staff);
    assertTransition(row.status, "cancelled");
    if (!staff && row.starts_at - now(env) < policy.cancellationHours * 3600000)
      fail(
        409,
        "CANCELLATION_CUTOFF",
        "The online cancellation deadline has passed. Contact the business.",
      );
    const percent = staff ? 100 : policy.refundPercent,
      eligible = Math.floor(
        ((row.paid_amount - row.refunded_amount) * percent) / 100,
      );
    await env.DB.batch(
      mutation(
        env,
        s,
        row,
        {
          status: "cancelled",
          expires_at: null,
          payment_status: eligible > 0 ? "refund_due" : row.payment_status,
          refund_eligible: eligible,
        },
        "cancelled",
        text(raw.note, "Reason", 500),
      ),
    );
  } else if (action === "reschedule") {
    if (!reschedulable(row.status))
      fail(
        409,
        "INVALID_TRANSITION",
        "This appointment cannot be rescheduled.",
      );
    if (!staff && row.starts_at - now(env) < policy.cancellationHours * 3600000)
      fail(
        409,
        "RESCHEDULE_CUTOFF",
        "The online rescheduling deadline has passed. Contact the business.",
      );
    const selection = {
      serviceId: row.service_id,
      locationId: row.location_id,
      practitionerId: row.practitioner_id,
      options: JSON.parse(row.options_json),
      startsAt: raw.startsAt,
    };
    const next = await selectedSlot(env, s, selection, row.id);
    if (
      next.quote.total !== row.total ||
      next.quote.duration !== JSON.parse(row.item_json).duration
    )
      fail(
        409,
        "SERVICE_CHANGED",
        "This service changed. Contact staff before rescheduling.",
      );
    if (next.slot.startsAt === row.starts_at)
      return bookingDetail(env, s, bookingId, staff);
    const status: BookingStatus =
      policy.manualConfirmation && row.status === "confirmed"
        ? "pending_confirmation"
        : row.status;
    await env.DB.batch([
      ...bumpRevision(env, s, next.data.revision),
      ...mutation(
        env,
        s,
        row,
        {
          starts_at: next.slot.startsAt,
          ends_at: next.slot.endsAt,
          practitioner_id: next.slot.practitionerId,
          practitioner_name: next.slot.practitionerName,
          status,
          expires_at:
            status === "pending_confirmation"
              ? now(env) + policy.holdMinutes * 60000
              : row.expires_at,
        },
        "rescheduled",
      ),
      q(
        env,
        "DELETE FROM allocations WHERE scope=? AND booking_id=?",
        s.scope,
        row.id,
      ),
      ...allocationStatements(env, s, row.id, next.slot),
      q(
        env,
        "UPDATE tickets SET revoked=1 WHERE scope=? AND booking_id=?",
        s.scope,
        row.id,
      ),
      ...issueTicket(env, s, row.id, cap.tickets),
    ]);
  } else {
    if (!staff)
      fail(403, "STAFF_REQUIRED", "This action requires staff access.");
    if (action === "note") {
      await env.DB.batch(
        mutation(
          env,
          s,
          row,
          {},
          "staff_note",
          text(raw.note, "Note", 1000, true),
          true,
        ),
      );
    } else if (action === "confirm") {
      const target: BookingStatus =
        row.payment_method === "online" && row.paid_amount < row.due_now
          ? "awaiting_payment"
          : "confirmed";
      assertTransition(row.status, target);
      if (row.status === target) return bookingDetail(env, s, bookingId, staff);
      await env.DB.batch([
        ...mutation(
          env,
          s,
          row,
          {
            status: target,
            expires_at:
              target === "awaiting_payment"
                ? now(env) + policy.paymentMinutes * 60000
                : null,
          },
          "staff_confirmed",
        ),
        ...issueTicket(env, s, row.id, cap.tickets),
      ]);
    } else if (["checked_in", "completed", "no_show"].includes(action)) {
      const target = action as BookingStatus;
      assertTransition(row.status, target);
      if (
        target === "checked_in" &&
        (now(env) < row.starts_at - policy.checkInEarlyMinutes * 60000 ||
          now(env) > row.ends_at + 86400000)
      )
        fail(
          409,
          "CHECKIN_WINDOW",
          "This appointment is outside its check-in window.",
        );
      if (target === "no_show" && now(env) < row.ends_at)
        fail(
          409,
          "TOO_EARLY",
          "Wait until the appointment ends before marking no-show.",
        );
      await env.DB.batch([
        ...mutation(env, s, row, { status: target }, target),
        ...(target === "checked_in"
          ? [
              q(
                env,
                "UPDATE tickets SET used_at=? WHERE scope=? AND booking_id=? AND revoked=0 AND used_at IS NULL",
                now(env),
                s.scope,
                row.id,
              ),
            ]
          : []),
      ]);
    } else fail(422, "UNKNOWN_ACTION", "Unsupported appointment action.");
  }
  return bookingDetail(env, s, bookingId, staff);
}
export async function restoreAccess(env: Env, s: Session, input: unknown) {
  const cfg = await configFor(env, s);
  requireCapability(capabilities(cfg.level), "booking");
  const raw = object(input),
    reference = text(raw.reference, "Reference", 50, true).toUpperCase(),
    token = text(raw.token, "Access token", 100, true);
  if (!/^[a-f0-9]{64}$/.test(token))
    fail(404, "BOOKING_NOT_FOUND", "Reference or access key not found.");
  const row = await q(
    env,
    "SELECT id FROM bookings WHERE scope=? AND reference=? AND access_hash=?",
    s.scope,
    reference,
    await digest(token),
  ).first<{ id: string }>();
  if (!row)
    fail(404, "BOOKING_NOT_FOUND", "Reference or access key not found.");
  await q(
    env,
    "INSERT OR IGNORE INTO access_grants(scope,principal,booking_id) VALUES(?,?,?)",
    s.scope,
    s.principal,
    row.id,
  ).run();
  return bookingDetail(env, s, row.id);
}
