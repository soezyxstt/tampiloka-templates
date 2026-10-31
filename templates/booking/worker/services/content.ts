import {
  capabilities,
  type Location,
  type Resource,
  type Service,
  type StaffSnapshot,
} from "../../src/domain/model.ts";
import {
  locationInput,
  resourceInput,
  serviceInput,
  settingsInput,
} from "../../src/domain/content-validation.ts";
import {
  fail,
  id,
  integer,
  localized,
  object,
  text,
  timestamp,
} from "../../src/domain/validation.ts";
import { scheduleContains, TICK } from "../../src/domain/time.ts";
import {
  all,
  bootstrap,
  bumpRevision,
  configFor,
  q,
  scopeRow,
  units,
} from "../db.ts";
import { requireCapability, requireStaff, uid } from "../security.ts";
import { now, type Env, type Session, type Statement } from "../types.ts";

export async function snapshot(env: Env, s: Session): Promise<StaffSnapshot> {
  requireStaff(s);
  const data = await bootstrap(env, s, true);
  const rows = await all<{
    id: string;
    preset: StaffSnapshot["config"]["preset"];
    resource_id: string;
    location_id: string;
    starts_at: number;
    ends_at: number;
    reason: string;
  }>(
    env,
    "SELECT * FROM blackouts WHERE scope=? AND preset=? ORDER BY starts_at",
    s.scope,
    data.config.preset,
  );
  const metrics = data.capabilities.booking
    ? await q(
        env,
        "SELECT COUNT(*) AS appointments,COALESCE(SUM(status='confirmed'),0) AS confirmed,COALESCE(SUM(status IN('pending_confirmation','awaiting_payment','requested')),0) AS pending,COALESCE(SUM(paid_amount),0) AS received,COALESCE(SUM(refunded_amount),0) AS refunded,COALESCE(SUM(refund_eligible),0) AS refundDue FROM bookings WHERE scope=? AND preset=?",
        s.scope,
        data.config.preset,
      ).first<StaffSnapshot["metrics"]>()
    : null;
  const totals = metrics || {
    appointments: 0,
    confirmed: 0,
    pending: 0,
    received: 0,
    refunded: 0,
    refundDue: 0,
  };
  if (!data.capabilities.reports) {
    totals.received = 0;
    totals.refunded = 0;
    totals.refundDue = 0;
  }
  return {
    ...data,
    blackouts: rows.map((x) => ({
      id: x.id,
      preset: x.preset,
      resourceId: x.resource_id,
      locationId: x.location_id,
      start: x.starts_at,
      end: x.ends_at,
      reason: x.reason,
    })),
    metrics: totals,
  };
}
export async function saveEntity(
  env: Env,
  s: Session,
  kind: string,
  value: unknown,
) {
  requireStaff(s, true, true);
  const data = await bootstrap(env, s, true),
    raw = object(value),
    revision = integer(raw.revision, "Revision"),
    input = object(raw.data),
    preset = data.config.preset;
  requireCapability(data.capabilities, "cms");
  let record:
      | Service
      | Resource
      | Location
      | { id: string; name: { id: string; en: string } },
    storedId: string,
    unitName = "",
    capacity = 0,
    statements: Statement[] = [];
  if (kind === "service") {
    const service = serviceInput(input, preset);
    record = service;
    storedId = service.id;
    unitName = `svc:${storedId}`;
    capacity = service.capacity;
    if (
      !service.locationIds.length ||
      service.locationIds.some((x) => !data.locations.some((l) => l.id === x))
    )
      fail(422, "UNKNOWN_LOCATION", "Select existing locations.");
    if (!data.categories.some((x) => x.id === service.category))
      fail(422, "UNKNOWN_CATEGORY", "Select an existing category.");
  } else if (kind === "location") {
    record = locationInput(input, preset);
    storedId = record.id;
    unitName = `loc:${storedId}`;
    capacity = record.capacity;
  } else if (kind === "resource") {
    const resource = resourceInput(input, preset);
    record = resource;
    storedId = resource.id;
    unitName = storedId;
    capacity = resource.capacity;
    if (
      !data.locations.some((x) => x.id === resource.locationId) ||
      resource.serviceIds.some(
        (x) =>
          !data.services.some(
            (y) => y.id === x && y.locationIds.includes(resource.locationId),
          ),
      )
    )
      fail(
        422,
        "UNKNOWN_RESOURCE_SERVICE",
        "Choose services offered at the resource location.",
      );
  } else if (kind === "category") {
    record = { id: id(input.id), name: localized(input.name, "Category", 100) };
    storedId = `${preset}-${record.id}`;
  } else return fail(422, "UNKNOWN_ENTITY", "Unsupported content collection.");
  const existing = await q(
    env,
    "SELECT preset FROM entities WHERE scope=? AND kind=? AND id=?",
    s.scope,
    kind,
    storedId,
  ).first<{ preset: string }>();
  if (existing && existing.preset !== preset)
    fail(
      403,
      "PRESET_MISMATCH",
      "This record belongs to another business preset.",
    );
  if (!existing) {
    const count = await q(
      env,
      "SELECT COUNT(*) AS n FROM entities WHERE scope=? AND preset=?",
      s.scope,
      preset,
    ).first<{ n: number }>();
    if ((count?.n || 0) >= 300)
      fail(
        422,
        "CONTENT_LIMIT",
        "This template supports up to 300 catalog records per business.",
      );
  }
  if (kind === "location" || kind === "resource") {
    const target = record as Location | Resource,
      zone =
        kind === "location"
          ? (target as Location).timezone
          : data.locations.find(
              (l) => l.id === (target as Resource).locationId,
            )!.timezone;
    const allocated = await all<{ tick: number; unit: number }>(
      env,
      "SELECT tick,unit FROM allocations WHERE scope=? AND resource=? AND tick>=?",
      s.scope,
      unitName,
      Math.floor(now(env) / TICK),
    );
    if (
      allocated.some(
        (a) =>
          a.unit >= capacity ||
          !target.active ||
          !scheduleContains(
            target.schedule,
            a.tick * TICK,
            (a.tick + 1) * TICK,
            zone,
          ),
      )
    )
      fail(
        409,
        "RESERVATIONS_EXIST",
        "The new schedule or capacity conflicts with an existing appointment. Move or cancel it first.",
      );
  }
  if (unitName) statements = units(env, s.scope, unitName, capacity);
  await env.DB.batch([
    ...bumpRevision(env, s, revision),
    q(
      env,
      "INSERT INTO entities(scope,kind,id,preset,data) VALUES(?,?,?,?,?) ON CONFLICT(scope,kind,id) DO UPDATE SET data=excluded.data",
      s.scope,
      kind,
      storedId,
      preset,
      JSON.stringify(record),
    ),
    ...statements,
  ]);
  return { record, revision: (await scopeRow(env, s)).revision };
}
export async function saveSettings(env: Env, s: Session, value: unknown) {
  requireStaff(s, true, true);
  const raw = object(value),
    current = await configFor(env, s),
    next = settingsInput(raw.data, current),
    revision = integer(raw.revision, "Revision");
  // A demo never points visitors at a real business or a payment account.
  if (s.demo) {
    next.brand.whatsapp = "";
    next.brand.email = "";
  }
  const scope = await scopeRow(env, s),
    state = JSON.parse(scope.state_json);
  await env.DB.batch([
    ...bumpRevision(env, s, revision),
    q(
      env,
      "UPDATE settings SET config_json=? WHERE scope=? AND preset=?",
      JSON.stringify(next),
      s.scope,
      current.preset,
    ),
    ...(s.demo
      ? [
          q(
            env,
            "UPDATE scopes SET state_json=? WHERE id=?",
            JSON.stringify({
              ...state,
              layout: next.layout,
              palette: next.palette,
            }),
            s.scope,
          ),
        ]
      : []),
  ]);
  return { config: next };
}
export async function saveBlackout(env: Env, s: Session, value: unknown) {
  requireStaff(s, true, true);
  const data = await bootstrap(env, s, true),
    raw = object(value),
    revision = integer(raw.revision, "Revision");
  const resourceId = raw.resourceId ? id(raw.resourceId) : "",
    locationId = raw.locationId ? id(raw.locationId) : "";
  if (!resourceId && !locationId)
    fail(422, "BLACKOUT_TARGET", "Choose a resource or location.");
  if (
    (resourceId && !data.resources.some((r) => r.id === resourceId)) ||
    (locationId && !data.locations.some((l) => l.id === locationId))
  )
    fail(422, "BLACKOUT_TARGET", "Unknown resource or location.");
  const start = timestamp(raw.start),
    end = timestamp(raw.end),
    reason = text(raw.reason, "Time off reason", 200, true);
  if (end <= start || end - start > 366 * 86400000)
    fail(
      422,
      "INVALID_PERIOD",
      "Choose a valid time off period shorter than one year.",
    );
  const target = resourceId || `loc:${locationId}`;
  const conflict = await q(
    env,
    "SELECT booking_id FROM allocations WHERE scope=? AND resource=? AND tick>=? AND tick<? LIMIT 1",
    s.scope,
    target,
    Math.floor(start / TICK),
    Math.ceil(end / TICK),
  ).first();
  if (conflict)
    fail(
      409,
      "RESERVATIONS_EXIST",
      "Move or cancel existing appointments before adding this time off.",
    );
  const key = uid("off_");
  await env.DB.batch([
    ...bumpRevision(env, s, revision),
    q(
      env,
      "INSERT INTO blackouts(scope,id,preset,resource_id,location_id,starts_at,ends_at,reason) VALUES(?,?,?,?,?,?,?,?)",
      s.scope,
      key,
      data.config.preset,
      resourceId,
      locationId,
      start,
      end,
      reason,
    ),
  ]);
  return { id: key };
}
export async function deleteBlackout(
  env: Env,
  s: Session,
  key: string,
  value: unknown,
) {
  requireStaff(s, true, true);
  const cfg = await configFor(env, s),
    revision = integer(object(value).revision, "Revision");
  await env.DB.batch([
    ...bumpRevision(env, s, revision),
    q(
      env,
      "DELETE FROM blackouts WHERE scope=? AND preset=? AND id=?",
      s.scope,
      cfg.preset,
      key,
    ),
  ]);
  return { ok: true };
}
export async function reportCsv(env: Env, s: Session) {
  requireStaff(s);
  const cfg = await configFor(env, s);
  requireCapability(capabilities(cfg.level), "reports");
  const rows = await all<{
    reference: string;
    starts_at: number;
    status: string;
    payment_status: string;
    total: number;
    paid_amount: number;
    refunded_amount: number;
    refund_eligible: number;
  }>(
    env,
    "SELECT reference,starts_at,status,payment_status,total,paid_amount,refunded_amount,refund_eligible FROM bookings WHERE scope=? AND preset=? ORDER BY starts_at DESC LIMIT 10000",
    s.scope,
    cfg.preset,
  );
  const cell = (x: unknown) =>
    `"${String(x)
      .replaceAll('"', '""')
      .replace(/^[=+\-@\t\r]/, "'$&")}"`;
  return (
    "\uFEFF" +
    [
      [
        "Reference",
        "Starts at UTC",
        "Booking status",
        "Payment status",
        "Total IDR",
        "Received IDR",
        "Refunded IDR",
        "Refund due IDR",
      ],
      ...rows.map((r) => [
        r.reference,
        new Date(r.starts_at).toISOString(),
        r.status,
        r.payment_status,
        r.total,
        r.paid_amount,
        r.refunded_amount,
        r.refund_eligible,
      ]),
    ]
      .map((row) => row.map(cell).join(","))
      .join("\r\n")
  );
}
