import { LAYOUTS, LEVELS, PALETTES, PRESETS } from "../src/domain/model.ts";
import { defaultOptions } from "../src/domain/adapters.ts";
import { choice, fail, object } from "../src/domain/validation.ts";
import { localTime } from "../src/domain/time.ts";
import { bootstrap, bumpRevision, q, scopeRow, sessionFor } from "./db.ts";
import { uid } from "./security.ts";
import { now, type Env, type Session } from "./types.ts";
import { availability } from "./services/availability.ts";
import { bookingAction, createBooking } from "./services/bookings.ts";

export async function demoAction(
  request: Request,
  env: Env,
  s: Session,
  action: string,
  value: unknown,
) {
  if (!s.demo)
    fail(
      403,
      "DEMO_ONLY",
      "Public demo controls are disabled in client projects.",
    );
  const raw = object(value);
  if (action === "reset") {
    await q(env, "DELETE FROM scopes WHERE id=? AND demo=1", s.scope).run();
    Object.assign(s, await sessionFor(request, env, true));
    return bootstrap(env, s);
  }
  if (action === "role") {
    const role = choice(
      raw.role,
      ["customer", "owner", "operations", "viewer"] as const,
      "Demo role",
    );
    await q(
      env,
      "UPDATE sessions SET role=? WHERE hash=? AND scope=?",
      role,
      s.hash,
      s.scope,
    ).run();
    s.role = role;
    return bootstrap(env, s);
  }
  if (action === "config") {
    const scope = await scopeRow(env, s),
      state = JSON.parse(scope.state_json);
    for (const [key, values] of [
      ["preset", PRESETS],
      ["level", LEVELS],
      ["layout", LAYOUTS],
      ["palette", PALETTES],
    ] as const)
      if (raw[key] !== undefined) state[key] = choice(raw[key], values, key);
    await env.DB.batch([
      ...bumpRevision(env, s, scope.revision),
      q(
        env,
        "UPDATE scopes SET state_json=? WHERE id=?",
        JSON.stringify(state),
        s.scope,
      ),
    ]);
    return bootstrap(env, s);
  }
  if (action === "scenario") {
    const data = await bootstrap(env, s);
    if (!data.capabilities.booking)
      fail(
        403,
        "FEATURE_DISABLED",
        "Sample appointments require Booking or Full.",
      );
    const options = defaultOptions(data.config.preset);
    if (data.config.preset === "detailing")
      options.vehicleModel = "Example compact car";
    const service = data.services[0],
      location = data.locations[0],
      ids: string[] = [];
    for (let n = 0; n < 3; n++)
      for (let day = 1; day < 10; day++) {
        const result = await availability(env, s, {
          serviceId: service.id,
          locationId: location.id,
          options,
          date: localTime(now(env) + day * 86400000, location.timezone).date,
        });
        if (!result.slots.length) continue;
        const booking = await createBooking(env, s, {
          serviceId: service.id,
          locationId: location.id,
          options,
          startsAt: result.slots[0].startsAt,
          customer: {
            name: ["Alex Example", "Mira Example", "Dian Example"][n],
            phone: "081200000000",
            email: "",
          },
          paymentMethod:
            data.capabilities.payments && n === 1 ? "online" : "location",
          idempotencyKey: uid(),
          expectedTotal: result.quote.total,
        });
        ids.push(booking.id);
        if (n === 2)
          await bookingAction(env, s, booking.id, { action: "cancel" });
        break;
      }
    return { created: ids.length, ids };
  }
  return fail(404, "NOT_FOUND", "Demo action not found.");
}
