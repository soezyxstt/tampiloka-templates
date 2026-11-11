import { LocalDatabase } from "../scripts/sqlite.mjs";
import { handleRequest } from "../worker/index.ts";
import { defaultOptions } from "../src/domain/adapters.ts";

class TestDatabase extends LocalDatabase {
  batch(statements) {
    this.beforeBatch?.(statements);
    return super.batch(statements);
  }
}
export function fixture(t, overrides = {}) {
  let clock = Date.parse("2026-11-01T12:00:00Z");
  const env = {
    DB: new TestDatabase(),
    DEMO_MODE: "true",
    NOW: () => clock,
    ...overrides,
  };
  t.after(() => env.DB.close());
  return {
    env,
    c: client(env),
    setNow: (value) =>
      (clock = typeof value === "string" ? Date.parse(value) : value),
  };
}
export function client(env, ip = crypto.randomUUID()) {
  let cookie = "";
  return {
    get cookie() {
      return cookie;
    },
    set cookie(v) {
      cookie = v;
    },
    async request(path, method = "GET", body, extra = {}) {
      const response = await handleRequest(
        new Request("https://booking.test" + path, {
          method,
          headers: {
            Origin: "https://booking.test",
            "CF-Connecting-IP": ip,
            ...(cookie ? { Cookie: cookie } : {}),
            ...(body !== undefined
              ? { "Content-Type": "application/json" }
              : {}),
            ...extra,
          },
          ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
        }),
        env,
      );
      const next = response.headers.get("Set-Cookie");
      if (next) cookie = next.split(";")[0];
      const data = response.headers
        .get("content-type")
        ?.includes("application/json")
        ? await response.json()
        : await response.text();
      return { status: response.status, data, headers: response.headers };
    },
    get(path, headers) {
      return this.request(path, "GET", undefined, headers);
    },
    post(path, body, headers) {
      return this.request(path, "POST", body, headers);
    },
    put(path, body, headers) {
      return this.request(path, "PUT", body, headers);
    },
  };
}
export async function configure(c, value) {
  await c.get("/api/bootstrap");
  const r = await c.post("/api/demo/config", value);
  if (r.status !== 200) throw Error(JSON.stringify(r));
  return r.data;
}
export async function owner(c) {
  const r = await c.post("/api/demo/role", { role: "owner" });
  if (r.status !== 200) throw Error(JSON.stringify(r));
  return r.data;
}
export async function inputFor(c, overrides = {}) {
  const data = (await c.get("/api/bootstrap")).data;
  const options = defaultOptions(data.config.preset);
  if (data.config.preset === "detailing")
    options.vehicleModel = "Example hatchback";
  const selection = {
    serviceId: data.services[0].id,
    locationId: data.locations[0].id,
    options,
    ...overrides,
  };
  const available = await c.post("/api/availability", {
    ...selection,
    date: "2026-11-02",
  });
  if (available.status !== 200) throw Error(JSON.stringify(available));
  if (!available.data.slots.length) throw Error("No test slot");
  return {
    ...selection,
    startsAt: available.data.slots[0].startsAt,
    customer: { name: "Example Customer", phone: "081234567890", email: "" },
    paymentMethod: "location",
    expectedTotal: available.data.quote.total,
    idempotencyKey: crypto.randomUUID(),
    ...overrides,
  };
}
export async function create(c, overrides = {}) {
  return c.post("/api/bookings", await inputFor(c, overrides));
}
export const action = (c, b, action, extra = {}) =>
  c.post(`/api/staff/bookings/${typeof b === "string" ? b : b.id}/actions`, {
    action,
    ...extra,
  });
