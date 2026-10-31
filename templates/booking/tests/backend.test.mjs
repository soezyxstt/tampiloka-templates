import test from "node:test";
import assert from "node:assert/strict";
import {
  fixture,
  client,
  configure,
  owner,
  inputFor,
  create,
  action,
} from "./harness.mjs";
import { cleanup } from "../worker/index.ts";
import { digest } from "../worker/security.ts";
const good = (r) => assert.equal(r.status, 200, JSON.stringify(r.data));

test("catalog/WhatsApp never create booking, payment or ticket records", async (t) => {
  const { env, c } = fixture(t);
  for (const level of ["catalog", "whatsapp"]) {
    const b = await configure(c, { level });
    const x = {
      serviceId: b.services[0].id,
      locationId: b.locations[0].id,
      options: {},
      lang: "en",
    };
    assert.equal(
      (await c.post("/api/availability", { ...x, date: "2026-11-02" })).status,
      403,
    );
    assert.equal((await c.post("/api/bookings", {})).status, 403);
    assert.equal((await c.get("/api/bookings")).status, 403);
    const r = await c.post("/api/whatsapp", x);
    assert.equal(r.status, level === "catalog" ? 403 : 200);
    if (level === "whatsapp") {
      assert.equal(r.data.confirmed, false);
      assert.equal(r.data.delivered, false);
      assert.equal(r.data.url, null);
      assert.match(r.data.message, /does not confirm/);
    }
    await owner(c);
    assert.equal(
      (await c.post("/api/staff/tickets/validate", { payload: "x" })).status,
      403,
    );
  }
  assert.equal(env.DB.db.prepare("SELECT COUNT(*) n FROM bookings").get().n, 0);
  assert.equal(
    env.DB.db.prepare("SELECT COUNT(*) n FROM customers").get().n,
    0,
  );
});
test("all four use cases create real customer records with server-owned prices", async (t) => {
  const { c } = fixture(t);
  for (const preset of ["medical", "aesthetic", "detailing", "consulting"]) {
    await configure(c, { preset, level: "booking" });
    const input = await inputFor(c);
    good(await c.post("/api/bookings", input));
    assert.equal(
      (
        await c.post("/api/bookings", {
          ...input,
          idempotencyKey: crypto.randomUUID(),
          expectedTotal: 1,
        })
      ).status,
      409,
    );
    const list = await c.get("/api/bookings");
    good(list);
    assert.equal(list.data.total, 1);
    assert.equal(list.data.bookings[0].preset, preset);
    assert.equal(
      (await c.post(`/api/bookings/${list.data.bookings[0].id}/payment`, {}))
        .status,
      403,
    );
  }
});
test("database transactions reject concurrent attempts for the same practitioner and slot", async (t) => {
  const { env, c } = fixture(t);
  await configure(c, { level: "booking" });
  const input = await inputFor(c);
  const pair = await Promise.all([
    c.post("/api/bookings", input),
    c.post("/api/bookings", { ...input, idempotencyKey: crypto.randomUUID() }),
  ]);
  assert.deepEqual(pair.map((r) => r.status).sort(), [200, 409]);
  assert.equal(env.DB.db.prepare("SELECT COUNT(*) n FROM bookings").get().n, 1);
});
test("idempotent creation retries return the same booking and access key", async (t) => {
  const { env, c } = fixture(t);
  await configure(c, { level: "booking" });
  const input = await inputFor(c),
    a = await c.post("/api/bookings", input),
    b = await c.post("/api/bookings", input);
  good(a);
  good(b);
  assert.equal(a.data.id, b.data.id);
  assert.equal(a.data.accessToken, b.data.accessToken);
  assert.equal(
    (
      await c.post("/api/bookings", {
        ...input,
        customer: { ...input.customer, name: "Changed" },
      })
    ).status,
    409,
  );
  assert.notEqual(
    env.DB.db.prepare("SELECT access_hash FROM bookings").get().access_hash,
    a.data.accessToken,
  );
});
test("capacity uses two bays, then refuses the third concurrent booking", async (t) => {
  const { c } = fixture(t);
  await configure(c, { preset: "detailing", level: "booking" });
  const input = await inputFor(c);
  const results = await Promise.all(
    [1, 2, 3].map(() =>
      c.post("/api/bookings", {
        ...input,
        idempotencyKey: crypto.randomUUID(),
      }),
    ),
  );
  assert.equal(results.filter((r) => r.status === 200).length, 2);
  assert.equal(results.filter((r) => r.status === 409).length, 1);
});
test("authorized reschedule choices exclude only the original booking", async (t) => {
  const { env, c } = fixture(t, {
    DEMO_MODE: "false",
    STAFF_OWNER_PASSWORD: "owner-long-password",
    STAFF_VIEWER_PASSWORD: "viewer-long-password",
  });
  const input = await inputFor(c), first = await c.post("/api/bookings", input);
  good(first);
  const second = await c.post("/api/bookings", {
    ...input, startsAt: input.startsAt + 60 * 60000, idempotencyKey: crypto.randomUUID(),
  });
  good(second);
  const date = { date: "2026-11-02" },
    customerPath = `/api/bookings/${first.data.id}`,
    staffPath = `/api/staff/bookings/${first.data.id}`,
    overlap = input.startsAt + 15 * 60000,
    blocked = input.startsAt + 45 * 60000,
    includes = (response, time) => response.data.slots.some((slot) => slot.startsAt === time);
  const general = await c.post("/api/availability", { ...input, ...date });
  good(general);
  assert.equal(includes(general, overlap), false);
  const choices = await c.post(customerPath + "/availability", date);
  good(choices);
  assert.equal(includes(choices, overlap), true);
  assert.equal(includes(choices, blocked), false);
  assert.equal((await c.post(customerPath + "/actions", { action: "reschedule", startsAt: blocked })).status, 409);
  const other = client(env);
  assert.equal((await other.post(customerPath + "/availability", date)).status, 404);
  assert.equal((await other.post(customerPath + "/actions", { action: "reschedule", startsAt: overlap })).status, 404);
  const tampered = await c.post(customerPath + "/availability", { ...date, bookingId: second.data.id });
  good(tampered);
  assert.equal(includes(tampered, blocked), false);
  const moved = await c.post(customerPath + "/actions", { action: "reschedule", startsAt: overlap });
  good(moved);
  assert.equal(moved.data.startsAt, overlap);
  const viewer = client(env);
  good(await viewer.post("/api/staff/login", { role: "viewer", password: env.STAFF_VIEWER_PASSWORD }));
  assert.equal((await viewer.post(staffPath + "/availability", date)).status, 403);
  assert.equal((await viewer.post(staffPath + "/actions", { action: "reschedule", startsAt: input.startsAt })).status, 403);
  const staff = client(env);
  good(await staff.post("/api/staff/login", { role: "owner", password: env.STAFF_OWNER_PASSWORD }));
  const staffChoices = await staff.post(staffPath + "/availability", date);
  good(staffChoices);
  assert.equal(includes(staffChoices, input.startsAt), true);
  assert.equal(includes(staffChoices, blocked), false);
  const returned = await staff.post(staffPath + "/actions", { action: "reschedule", startsAt: input.startsAt });
  good(returned);
  assert.equal(returned.data.startsAt, input.startsAt);
});
test("cancellation releases the entire interval, including buffers; reschedule moves it atomically", async (t) => {
  const { c } = fixture(t);
  await configure(c, { level: "booking" });
  const input = await inputFor(c),
    one = await c.post("/api/bookings", input);
  good(one);
  good(
    await c.post(`/api/bookings/${one.data.id}/actions`, { action: "cancel" }),
  );
  const two = await c.post("/api/bookings", {
    ...input,
    idempotencyKey: crypto.randomUUID(),
  });
  good(two);
  const available = await c.post("/api/availability", {
    ...input,
    date: "2026-11-02",
  });
  const next = available.data.slots.at(-1);
  const moved = await c.post(`/api/bookings/${two.data.id}/actions`, {
    action: "reschedule",
    startsAt: next.startsAt,
    version: two.data.version,
  });
  good(moved);
  assert.equal(moved.data.startsAt, next.startsAt);
  good(
    await c.post("/api/bookings", {
      ...input,
      idempotencyKey: crypto.randomUUID(),
    }),
  );
});
test("public demo sessions are isolated across both customer and staff views", async (t) => {
  const { env, c } = fixture(t);
  await configure(c, { level: "full" });
  const b = await create(c);
  good(b);
  const other = client(env);
  await other.get("/api/bootstrap");
  assert.equal((await other.get(`/api/bookings/${b.data.id}`)).status, 404);
  await owner(other);
  assert.equal((await other.get("/api/staff/bookings")).data.total, 0);
  assert.equal(
    (
      await other.post("/api/access", {
        reference: b.data.reference,
        token: b.data.accessToken,
      })
    ).status,
    404,
  );
  await owner(c);
  assert.equal((await c.get("/api/staff/bookings")).data.total, 1);
  good(await c.post("/api/demo/reset", {}));
  assert.equal((await c.get("/api/bookings")).data.total, 0);
});
test("production customer access grants work across devices without sharing all customer history", async (t) => {
  const { env, c } = fixture(t, { DEMO_MODE: "false" });
  const b = await create(c);
  good(b);
  const other = client(env);
  await other.get("/api/bootstrap");
  assert.equal((await other.get(`/api/bookings/${b.data.id}`)).status, 404);
  good(
    await other.post("/api/access", {
      reference: b.data.reference,
      token: b.data.accessToken,
    }),
  );
  good(await other.get(`/api/bookings/${b.data.id}`));
  assert.equal((await other.get("/api/staff/snapshot")).status, 401);
  assert.equal(
    (await other.post("/api/demo/role", { role: "owner" })).status,
    403,
  );
});
test("production staff authentication rotates sessions and enforces owner/operations/viewer roles", async (t) => {
  const { env, c } = fixture(t, {
    DEMO_MODE: "false",
    STAFF_OWNER_PASSWORD: "owner-long-password",
    STAFF_OPERATIONS_PASSWORD: "operations-password",
    STAFF_VIEWER_PASSWORD: "viewer-long-password",
  });
  await c.get("/api/bootstrap");
  const old = c.cookie;
  good(
    await c.post("/api/staff/login", {
      role: "owner",
      password: env.STAFF_OWNER_PASSWORD,
    }),
  );
  assert.notEqual(c.cookie, old);
  good(await c.get("/api/staff/snapshot"));
  const stolen = client(env);
  stolen.cookie = old;
  assert.equal((await stolen.get("/api/staff/snapshot")).status, 401);
  const v = client(env);
  await v.get("/api/bootstrap");
  good(
    await v.post("/api/staff/login", {
      role: "viewer",
      password: env.STAFF_VIEWER_PASSWORD,
    }),
  );
  assert.equal((await v.put("/api/staff/settings", {})).status, 403);
  assert.equal(
    (await c.post("/api/bookings", {}, { Origin: "https://evil.test" })).status,
    403,
  );
  good(await c.post("/api/logout", {}));
  assert.equal((await c.get("/api/staff/snapshot")).status, 401);
});
test("full payment simulation issues a verifiable QR only after valid confirmation", async (t) => {
  const { env, c, setNow } = fixture(t);
  await configure(c, { level: "full" });
  const b = await create(c, { paymentMethod: "online" });
  good(b);
  assert.equal(b.data.status, "awaiting_payment");
  assert.equal(b.data.ticket, null);
  good(
    await c.post(`/api/bookings/${b.data.id}/simulate`, { status: "failed" }),
  );
  const paid = await c.post(`/api/bookings/${b.data.id}/simulate`, {
    status: "paid",
  });
  good(paid);
  assert.equal(paid.data.status, "confirmed");
  assert.equal(paid.data.paymentStatus, "partial");
  assert.ok(paid.data.ticket.payload);
  assert.ok(!paid.data.ticket.payload.includes("Example"));
  await owner(c);
  assert.equal(
    (
      await c.post("/api/staff/tickets/validate", {
        payload: paid.data.ticket.payload,
        checkIn: true,
      })
    ).status,
    409,
  );
  setNow(paid.data.startsAt - 5 * 60000);
  const checked = await c.post("/api/staff/tickets/validate", {
    payload: paid.data.ticket.payload,
    checkIn: true,
  });
  good(checked);
  assert.equal(checked.data.booking.status, "checked_in");
  const duplicate = await c.post("/api/staff/tickets/validate", {
    payload: paid.data.ticket.payload,
    checkIn: true,
  });
  good(duplicate);
  assert.equal(duplicate.data.alreadyCheckedIn, true);
  assert.equal(
    (
      await c.post("/api/staff/tickets/validate", {
        payload:
          paid.data.ticket.payload.slice(0, -1) +
          (paid.data.ticket.payload.endsWith("a") ? "b" : "a"),
      })
    ).status,
    404,
  );
  good(await action(c, b.data, "completed"));
  assert.equal(
    env.DB.db.prepare("SELECT COUNT(*) n FROM allocations").get().n,
    0,
  );
});
test("free service in Full needs neither online payment nor a gateway", async (t) => {
  const { c } = fixture(t);
  const data = await configure(c, { level: "full" }),
    free = data.services.find((s) => s.price === 0);
  assert.ok(free);
  const b = await create(c, { serviceId: free.id });
  good(b);
  assert.equal(b.data.paymentStatus, "not_required");
  assert.equal(b.data.status, "confirmed");
  assert.ok(b.data.ticket);
});
test("manual confirmation, private staff notes and stale version guards", async (t) => {
  const { c } = fixture(t);
  let data = await configure(c, { level: "full" });
  await owner(c);
  good(
    await c.put("/api/staff/settings", {
      revision: data.revision,
      data: {
        ...data.config,
        policy: { ...data.config.policy, manualConfirmation: true },
      },
    }),
  );
  const b = await create(c);
  good(b);
  assert.equal(b.data.status, "pending_confirmation");
  assert.equal(b.data.ticket, null);
  good(
    await action(c, b.data, "note", {
      note: "Call before arrival",
      version: b.data.version,
    }),
  );
  assert.equal(
    (await action(c, b.data, "confirm", { version: b.data.version })).status,
    409,
  );
  const yes = await action(c, b.data, "confirm");
  good(yes);
  assert.equal(yes.data.status, "confirmed");
  assert.ok(yes.data.ticket);
  assert.equal(
    (await c.get(`/api/bookings/${b.data.id}`)).data.events.some(
      (e) => e.internal,
    ),
    false,
  );
  assert.equal(
    yes.data.events.some((e) => e.internal),
    true,
  );
});
test("schedule edits and time off reject conflicts with reserved intervals", async (t) => {
  const { c } = fixture(t);
  await configure(c, { level: "booking" });
  const b = await create(c);
  good(b);
  const data = await owner(c);
  const r = data.resources.find((r) => r.id === b.data.practitionerId);
  assert.equal(
    (
      await c.put("/api/staff/content/resource", {
        revision: data.revision,
        data: { ...r, schedule: [] },
      })
    ).status,
    409,
  );
  assert.equal(
    (
      await c.post("/api/staff/blackouts", {
        revision: data.revision,
        resourceId: r.id,
        start: b.data.startsAt,
        end: b.data.endsAt,
        reason: "Time off",
      })
    ).status,
    409,
  );
  good(
    await c.post(`/api/bookings/${b.data.id}/actions`, { action: "cancel" }),
  );
  const fresh = (await c.get("/api/bootstrap")).data;
  good(
    await c.post("/api/staff/blackouts", {
      revision: fresh.revision,
      resourceId: r.id,
      start: b.data.startsAt,
      end: b.data.endsAt,
      reason: "Time off",
    }),
  );
});
test("expired holds release slots and never become confirmed after a late payment", async (t) => {
  const { env, c, setNow } = fixture(t);
  await configure(c, { level: "full" });
  const b = await create(c, { paymentMethod: "online" });
  good(b);
  good(await c.post(`/api/bookings/${b.data.id}/payment`, {}));
  setNow(b.data.expiresAt + 1);
  await cleanup(env);
  assert.equal(
    (await c.get(`/api/bookings/${b.data.id}`)).data.status,
    "expired",
  );
  assert.equal(
    env.DB.db.prepare("SELECT COUNT(*) n FROM allocations").get().n,
    0,
  );
});
test("cancelled paid appointment supports policy refund, receipt, and no resurrection", async (t) => {
  const { c } = fixture(t);
  await configure(c, { level: "full" });
  const b = await create(c, { paymentMethod: "online" });
  good(b);
  good(await c.post(`/api/bookings/${b.data.id}/simulate`, { status: "paid" }));
  const cancelled = await c.post(`/api/bookings/${b.data.id}/actions`, {
    action: "cancel",
  });
  good(cancelled);
  assert.equal(cancelled.data.paymentStatus, "refund_due");
  await owner(c);
  const refunded = await c.post(`/api/staff/bookings/${b.data.id}/refund`, {
    reason: "Example cancellation",
  });
  good(refunded);
  assert.equal(refunded.data.paymentStatus, "refunded");
  assert.equal(refunded.data.status, "cancelled");
  assert.equal(refunded.data.ticket, null);
  good(await c.get(`/api/bookings/${b.data.id}/receipt`));
});
test("CMS updates persist and public responses do not expose secrets", async (t) => {
  const { c } = fixture(t);
  await configure(c, { level: "catalog" });
  let data = await owner(c);
  good(
    await c.put("/api/staff/content/service", {
      revision: data.revision,
      data: { ...data.services[0], price: 250000 },
    }),
  );
  data = (await c.get("/api/bootstrap")).data;
  assert.equal(data.services[0].price, 250000);
  good(
    await c.put("/api/staff/settings", {
      revision: data.revision,
      data: {
        ...data.config,
        brand: { ...data.config.brand, name: "Example CMS" },
      },
    }),
  );
  assert.equal(
    (await c.get("/api/bootstrap")).data.config.brand.name,
    "Example CMS",
  );
  assert.doesNotMatch(JSON.stringify(data), /secret|token_hash|access_hash/);
});

test("uncertain creation recovery is principal-scoped and level-gated", async (t) => {
  const { env, c } = fixture(t);
  await configure(c, { level: "booking" });
  const input = await inputFor(c),
    b = await c.post("/api/bookings", input);
  good(b);
  const recovered = await c.get(
    `/api/bookings/attempt/${input.idempotencyKey}`,
  );
  good(recovered);
  assert.equal(recovered.data.booking.id, b.data.id);
  assert.equal(recovered.data.booking.accessToken, b.data.accessToken);
  const other = client(env);
  await other.get("/api/bootstrap");
  assert.equal(
    (await other.get(`/api/bookings/attempt/${input.idempotencyKey}`)).data
      .booking,
    null,
  );
  await configure(c, { level: "catalog" });
  assert.equal(
    (await c.get(`/api/bookings/attempt/${input.idempotencyKey}`)).status,
    403,
  );
});
test("failed rescheduling preserves the original reservation and revokes no valid ticket", async (t) => {
  const { c, env } = fixture(t);
  await configure(c, { level: "full" });
  const input = await inputFor(c),
    a = await c.post("/api/bookings", input);
  good(a);
  const available = (
    await c.post("/api/availability", { ...input, date: "2026-11-02" })
  ).data;
  const b = await c.post("/api/bookings", {
    ...input,
    startsAt: available.slots.at(-1).startsAt,
    idempotencyKey: crypto.randomUUID(),
  });
  good(b);
  const rejected = await c.post(`/api/bookings/${a.data.id}/actions`, {
    action: "reschedule",
    startsAt: b.data.startsAt,
    version: a.data.version,
  });
  assert.equal(rejected.status, 409);
  const unchanged = (await c.get(`/api/bookings/${a.data.id}`)).data;
  assert.equal(unchanged.startsAt, a.data.startsAt);
  assert.equal(unchanged.ticket.payload, a.data.ticket.payload);
  assert.ok(
    env.DB.db
      .prepare("SELECT COUNT(*) n FROM allocations WHERE booking_id=?")
      .get(a.data.id).n > 0,
  );
});
test("manual rescheduling returns to confirmation and invalidates the old ticket", async (t) => {
  const { c } = fixture(t);
  let data = await configure(c, { level: "full" });
  await owner(c);
  good(
    await c.put("/api/staff/settings", {
      revision: data.revision,
      data: {
        ...data.config,
        policy: { ...data.config.policy, manualConfirmation: true },
      },
    }),
  );
  const b = await create(c);
  good(b);
  const confirmed = await action(c, b.data, "confirm");
  good(confirmed);
  const times = (
    await c.post("/api/availability", {
      serviceId: b.data.item.serviceId,
      locationId: b.data.locationId,
      options: {},
      date: "2026-11-03",
    })
  ).data.slots;
  const moved = await c.post(`/api/bookings/${b.data.id}/actions`, {
    action: "reschedule",
    startsAt: times[0].startsAt,
  });
  good(moved);
  assert.equal(moved.data.status, "pending_confirmation");
  assert.equal(moved.data.ticket, null);
  assert.equal(
    (
      await c.post("/api/staff/tickets/validate", {
        payload: confirmed.data.ticket.payload,
      })
    ).status,
    404,
  );
  const next = await action(c, b.data, "confirm");
  good(next);
  assert.notEqual(next.data.ticket.payload, confirmed.data.ticket.payload);
});
