import test from "node:test";
import assert from "node:assert/strict";
import { fixture, client, create, action } from "./harness.mjs";
import { digest } from "../worker/security.ts";

const ok = (r) => assert.equal(r.status, 200, JSON.stringify(r.data));
function providerFixture(t) {
  const f = fixture(t, {
    DEMO_MODE: "false",
    BOOKING_CONFIG: { level: "full" },
    TICKET_SECRET: "ticket-signing-key-for-automated-tests-only",
    MIDTRANS_SERVER_KEY: "mock-server-key-not-a-real-credential",
    STAFF_OWNER_PASSWORD: "test-owner-password-only",
  });
  const original = globalThis.fetch;
  t.after(() => {
    globalThis.fetch = original;
  });
  const state = {
    reference: "",
    amount: 0,
    status: "pending",
    code: "201",
    refundAmount: 0,
    confirmed: false,
    creates: 0,
    reads: 0,
    refunds: [],
    unavailable: false,
    wrongAmount: false,
    wrongReference: false,
  };
  globalThis.fetch = async (url, options) => {
    assert.match(String(url), /^https:\/\/(app|api)\.sandbox\.midtrans\.com\//);
    assert.match(options.headers.Authorization, /^Basic /);
    if (state.unavailable) throw new Error("Test provider timeout");
    if (String(url).includes("/snap/")) {
      const body = JSON.parse(options.body);
      state.creates++;
      if (state.reference)
        assert.equal(
          body.transaction_details.order_id,
          state.reference,
          "uncertain retries must keep the provider reference",
        );
      state.reference = body.transaction_details.order_id;
      state.amount = body.transaction_details.gross_amount;
      return Response.json({
        redirect_url:
          "https://app.sandbox.midtrans.com/snap/v2/vtweb/example-only",
      });
    }
    if (String(url).endsWith("/refund")) {
      const body = JSON.parse(options.body);
      state.refunds.push(body);
      return Response.json({
        status_code: "200",
        transaction_status: "refund",
      });
    }
    state.reads++;
    return Response.json({
      order_id: state.wrongReference ? "unrelated-order" : state.reference,
      gross_amount: String(state.wrongAmount ? 1 : state.amount) + ".00",
      status_code: state.code,
      transaction_status: state.status,
      transaction_id: "mock-transaction",
      fraud_status: "accept",
      ...(state.refundAmount
        ? { refund_amount: String(state.refundAmount) + ".00" }
        : {}),
      ...(state.confirmed ? { bank_confirmed_at: "2026-11-01T12:00:00Z" } : {}),
    });
  };
  async function notify(extra = {}) {
    const gross = String(state.amount) + ".00";
    return f.c.post("/api/webhooks/midtrans", {
      order_id: state.reference,
      status_code: "200",
      gross_amount: gross,
      transaction_status: "settlement",
      signature_key: await digest(
        `${state.reference}200${gross}${f.env.MIDTRANS_SERVER_KEY}`,
        "SHA-512",
      ),
      ...extra,
    });
  }
  async function start() {
    const b = await create(f.c, { paymentMethod: "online" });
    ok(b);
    ok(await f.c.post(`/api/bookings/${b.data.id}/payment`, {}));
    return b.data;
  }
  async function owner() {
    ok(
      await f.c.post("/api/staff/login", {
        role: "owner",
        password: f.env.STAFF_OWNER_PASSWORD,
      }),
    );
  }
  return { ...f, state, notify, start, owner };
}
test("Midtrans authenticates signatures and trusts only canonical amount/reference/state", async (t) => {
  const { c, env, state, start, notify } = providerFixture(t),
    b = await start();
  assert.equal(b.status, "awaiting_payment");
  assert.equal(b.ticket, null);
  assert.equal((await notify({ signature_key: "0".repeat(128) })).status, 403);
  assert.equal(state.reads, 0);
  ok(await notify());
  assert.equal(
    (await c.get(`/api/bookings/${b.id}`)).data.paymentStatus,
    "pending",
    "signed settlement text cannot override a pending canonical status",
  );
  state.status = "settlement";
  state.code = "200";
  state.wrongAmount = true;
  assert.equal((await notify()).status, 409);
  state.wrongAmount = false;
  state.wrongReference = true;
  assert.equal((await notify()).status, 409);
  state.wrongReference = false;
  const responses = await Promise.all([notify(), notify()]);
  responses.forEach(ok);
  const paid = (await c.get(`/api/bookings/${b.id}`)).data;
  assert.equal(paid.paidAmount, state.amount);
  assert.equal(paid.paymentStatus, "partial");
  assert.equal(paid.status, "confirmed");
  assert.ok(paid.ticket?.payload);
  assert.equal((await notify()).data.duplicate, true);
  state.status = "pending";
  state.code = "201";
  ok(await notify());
  assert.equal(
    (await c.get(`/api/bookings/${b.id}`)).data.paidAmount,
    state.amount,
  );
  assert.equal(env.DB.db.prepare("SELECT COUNT(*) n FROM tickets").get().n, 1);
});
test("payment initiation survives provider timeouts without a second active charge", async (t) => {
  const { c, state, start } = providerFixture(t);
  state.unavailable = true;
  const b = await create(c, { paymentMethod: "online" });
  ok(b);
  assert.equal(
    (await c.post(`/api/bookings/${b.data.id}/payment`, {})).status,
    502,
  );
  let row = (await c.get(`/api/bookings/${b.data.id}`)).data;
  assert.equal(row.paidAmount, 0);
  assert.equal(row.payments.length, 1);
  assert.equal(row.ticket, null);
  state.unavailable = false;
  ok(await c.post(`/api/bookings/${b.data.id}/payment`, {}));
  ok(await c.post(`/api/bookings/${b.data.id}/payment`, {}));
  assert.equal(state.creates, 1);
  row = (await c.get(`/api/bookings/${b.data.id}`)).data;
  assert.equal(row.payments.length, 1);
  assert.match(row.payments[0].checkoutUrl, /app\.sandbox\.midtrans\.com/);
});
test("a denied payment attempt can later settle, but an expired reservation never revives", async (t) => {
  const { c, state, start, notify, setNow, env } = providerFixture(t),
    b = await start();
  state.status = "deny";
  state.code = "200";
  ok(await notify());
  assert.equal(
    (await c.get(`/api/bookings/${b.id}`)).data.paymentStatus,
    "failed",
  );
  assert.equal(
    (await c.get(`/api/bookings/${b.id}`)).data.status,
    "awaiting_payment",
  );
  setNow(b.expiresAt + 1);
  state.status = "settlement";
  ok(await notify());
  const late = (await c.get(`/api/bookings/${b.id}`)).data;
  assert.equal(late.status, "expired");
  assert.equal(late.paymentStatus, "refund_due");
  assert.equal(late.refundEligible, state.amount);
  assert.equal(late.ticket, null);
  assert.equal(
    env.DB.db.prepare("SELECT COUNT(*) n FROM allocations").get().n,
    0,
  );
});
test("refund requests are not receipts; bank-confirmed callbacks settle the refund once", async (t) => {
  const { c, state, start, notify, owner } = providerFixture(t),
    b = await start();
  state.status = "settlement";
  state.code = "200";
  ok(await notify());
  ok(await c.post(`/api/bookings/${b.id}/actions`, { action: "cancel" }));
  await owner();
  ok(
    await c.post(`/api/staff/bookings/${b.id}/refund`, {
      reason: "Customer cancellation",
    }),
  );
  ok(await c.post(`/api/staff/bookings/${b.id}/refund`, { reason: "Retry" }));
  assert.equal(state.refunds[0].refund_key, state.refunds[1].refund_key);
  assert.equal(state.refunds[0].amount, state.amount);
  state.status = "refund";
  state.refundAmount = state.amount;
  ok(await notify());
  assert.equal(
    (await c.get(`/api/staff/bookings/${b.id}`)).data.refundedAmount,
    0,
  );
  state.confirmed = true;
  ok(await notify());
  ok(await notify());
  const refunded = (await c.get(`/api/staff/bookings/${b.id}`)).data;
  assert.equal(refunded.refundedAmount, state.amount);
  assert.equal(refunded.status, "cancelled");
  assert.equal(refunded.paymentStatus, "refunded");
  assert.equal(refunded.ticket, null);
});
test("production simulations, unsigned callbacks and customer financial writes fail closed", async (t) => {
  const { c, state, start, env } = providerFixture(t),
    b = await start(),
    other = client(env);
  await other.get("/api/bootstrap");
  assert.equal(
    (await c.post(`/api/bookings/${b.id}/simulate`, { status: "paid" })).status,
    403,
  );
  assert.equal(
    (
      await c.post(`/api/staff/bookings/${b.id}/payment`, {
        reference: "fake",
        idempotencyKey: crypto.randomUUID(),
      })
    ).status,
    401,
  );
  assert.equal(
    (await other.post(`/api/bookings/${b.id}/payment`, {})).status,
    404,
  );
  assert.equal((await c.get(`/api/bookings/${b.id}/receipt`)).status, 409);
  assert.equal((await c.post("/api/webhooks/midtrans", {})).status, 422);
  assert.equal((await c.get(`/api/bookings/${b.id}`)).data.paidAmount, 0);
});
