import configured from "../config/booking.json" with { type: "json" };
import { presetContent } from "../content/presets.ts";
import {
  capabilities,
  LEVELS,
  PRESETS,
  type Bootstrap,
  type BusinessSettings,
  type Level,
  type Preset,
  type Resource,
  type Service,
  type Location,
  type ServiceCategory,
} from "../src/domain/model.ts";
import { settingsInput } from "../src/domain/content-validation.ts";
import { choice, fail } from "../src/domain/validation.ts";
import type { Env, ScopeRow, Session, Statement } from "./types.ts";
import { now } from "./types.ts";
import { digest, random, rateLimit, uid } from "./security.ts";
export const q = (env: Env, sql: string, ...values: unknown[]) =>
  env.DB.prepare(sql).bind(...values);
export const all = async <T>(
  env: Env,
  sql: string,
  ...values: unknown[]
): Promise<T[]> => (await q(env, sql, ...values).all<T>()).results;
export async function scopeRow(env: Env, s: Session): Promise<ScopeRow> {
  const row = await q(
    env,
    "SELECT * FROM scopes WHERE id=?",
    s.scope,
  ).first<ScopeRow>();
  if (!row)
    fail(401, "SESSION_EXPIRED", "Your session expired. Reload this page.");
  return row;
}
export function deploymentConfig(env: Env): BusinessSettings {
  const input = { ...configured, ...env.BOOKING_CONFIG },
    preset = choice(input.preset, PRESETS, "Preset"),
    base = presetContent(preset).config;
  const merged = {
    ...base,
    ...input,
    brand: { ...base.brand, ...input.brand },
    policy: { ...base.policy, ...("policy" in input ? input.policy : {}) },
    level: choice(input.level, LEVELS, "Level"),
  } as BusinessSettings;
  return settingsInput(merged, merged);
}
export function units(
  env: Env,
  scope: string,
  resource: string,
  capacity: number,
): Statement[] {
  return [
    q(
      env,
      "DELETE FROM resource_units WHERE scope=? AND resource=? AND unit>=?",
      scope,
      resource,
      capacity,
    ),
    q(
      env,
      "INSERT OR IGNORE INTO resource_units(scope,resource,unit) SELECT ?,?,value FROM json_each(?)",
      scope,
      resource,
      JSON.stringify(Array.from({ length: capacity }, (_, i) => i)),
    ),
  ];
}
function seed(env: Env, scope: string, demo: boolean): Statement[] {
  const initial = deploymentConfig(env),
    state = {
      preset: initial.preset,
      level: demo ? "full" : initial.level,
      layout: initial.layout,
      palette: initial.palette,
    };
  const statements = [
    q(
      env,
      "INSERT OR IGNORE INTO scopes(id,demo,state_json,secret,created_at,expires_at) VALUES(?,?,?,?,?,?)",
      scope,
      Number(demo),
      JSON.stringify(state),
      random(),
      now(env),
      demo ? now(env) + 86400000 : null,
    ),
  ];
  for (const preset of demo ? PRESETS : [initial.preset]) {
    const content = presetContent(preset),
      cfg = preset === initial.preset ? initial : content.config;
    statements.push(
      q(
        env,
        "INSERT OR IGNORE INTO settings(scope,preset,config_json) VALUES(?,?,?)",
        scope,
        preset,
        JSON.stringify(cfg),
      ),
    );
    const records = [
      ...content.services.map((data) => ({
        kind: "service",
        id: data.id,
        data,
      })),
      ...content.resources.map((data) => ({
        kind: "resource",
        id: data.id,
        data,
      })),
      ...content.locations.map((data) => ({
        kind: "location",
        id: data.id,
        data,
      })),
      ...content.categories.map((data) => ({
        kind: "category",
        id: `${preset}-${data.id}`,
        data,
      })),
    ];
    statements.push(
      q(
        env,
        "INSERT OR IGNORE INTO entities(scope,preset,kind,id,data) SELECT ?,?,json_extract(value,'$.kind'),json_extract(value,'$.id'),json_extract(value,'$.data') FROM json_each(?)",
        scope,
        preset,
        JSON.stringify(records),
      ),
    );
    const subjects = [
      ...content.resources.map((r) => [r.id, r.capacity] as const),
      ...content.locations.map((r) => [`loc:${r.id}`, r.capacity] as const),
      ...content.services.map((r) => [`svc:${r.id}`, r.capacity] as const),
    ];
    const values = subjects.flatMap(([resource, capacity]) =>
      Array.from({ length: capacity }, (_, unit) => ({ resource, unit })),
    );
    statements.push(
      q(
        env,
        "INSERT OR IGNORE INTO resource_units(scope,resource,unit) SELECT ?,json_extract(value,'$.resource'),json_extract(value,'$.unit') FROM json_each(?)",
        scope,
        JSON.stringify(values),
      ),
    );
  }
  return statements;
}
export function cookie(request: Request, token: string, maxAge: number) {
  return `tl_booking_session=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${new URL(request.url).protocol === "https:" ? "; Secure" : ""}`;
}
export async function sessionFor(
  request: Request,
  env: Env,
  force = false,
): Promise<Session> {
  const demo = env.DEMO_MODE === "true";
  const token = force
    ? undefined
    : request.headers
        .get("cookie")
        ?.split(";")
        .map((x) => x.trim())
        .find((x) => x.startsWith("tl_booking_session="))
        ?.slice("tl_booking_session=".length);
  if (token && /^[a-f0-9]{64}$/.test(token)) {
    const hash = await digest(token),
      row = await q(
        env,
        "SELECT s.*,c.demo,c.expires_at AS scope_expiry FROM sessions s JOIN scopes c ON c.id=s.scope WHERE hash=?",
        hash,
      ).first<{
        scope: string;
        principal: string;
        role: Session["role"];
        expires_at: number;
        scope_expiry: number | null;
        demo: number;
      }>();
    if (
      row &&
      row.expires_at > now(env) &&
      (row.scope_expiry === null || row.scope_expiry > now(env)) &&
      Boolean(row.demo) === demo
    )
      return {
        hash,
        scope: row.scope,
        principal: row.principal,
        role: row.role,
        demo,
      };
  }
  await rateLimit(
    env,
    "session:" +
      (await digest(request.headers.get("cf-connecting-ip") || "local")),
    120,
    3600,
  );
  const raw = random(),
    hash = await digest(raw),
    scope = demo ? uid("demo_") : "business",
    principal = uid("visitor_"),
    ttl = demo ? 86400 : 30 * 86400;
  const exists = await q(
    env,
    "SELECT id FROM scopes WHERE id=?",
    scope,
  ).first();
  await env.DB.batch([
    ...(exists ? [] : seed(env, scope, demo)),
    q(
      env,
      "INSERT INTO sessions(hash,scope,principal,role,expires_at) VALUES(?,?,?,'customer',?)",
      hash,
      scope,
      principal,
      now(env) + ttl * 1000,
    ),
  ]);
  return {
    hash,
    scope,
    principal,
    role: "customer",
    demo,
    cookie: cookie(request, raw, ttl),
  };
}
export async function configFor(
  env: Env,
  s: Session,
): Promise<BusinessSettings> {
  const scope = await scopeRow(env, s),
    state = JSON.parse(scope.state_json),
    deployed = deploymentConfig(env);
  const preset: Preset = s.demo
    ? choice(state.preset, PRESETS, "Preset")
    : deployed.preset;
  const row = await q(
    env,
    "SELECT config_json FROM settings WHERE scope=? AND preset=?",
    s.scope,
    preset,
  ).first<{ config_json: string }>();
  if (!row)
    fail(503, "CONFIG_NOT_FOUND", "Business configuration is not initialized.");
  const config = JSON.parse(row.config_json) as BusinessSettings;
  return {
    ...config,
    preset,
    level: s.demo ? state.level : deployed.level,
    ...(s.demo ? { layout: state.layout, palette: state.palette } : {}),
    brand: { ...config.brand, ...(s.demo ? { whatsapp: "", email: "" } : {}) },
  };
}
export async function entities<T>(
  env: Env,
  s: Session,
  kind: string,
  preset: Preset,
): Promise<T[]> {
  return (
    await all<{ data: string }>(
      env,
      "SELECT data FROM entities WHERE scope=? AND kind=? AND preset=? ORDER BY rowid",
      s.scope,
      kind,
      preset,
    )
  ).map((r) => JSON.parse(r.data) as T);
}
export async function bootstrap(
  env: Env,
  s: Session,
  staff = false,
): Promise<Bootstrap> {
  const config = await configFor(env, s),
    [services, resources, locations, categories, scope] = await Promise.all([
      entities<Service>(env, s, "service", config.preset),
      entities<Resource>(env, s, "resource", config.preset),
      entities<Location>(env, s, "location", config.preset),
      entities<ServiceCategory>(env, s, "category", config.preset),
      scopeRow(env, s),
    ]);
  return {
    demo: s.demo,
    config,
    capabilities: capabilities(config.level),
    role: s.role,
    revision: scope.revision,
    services: services.filter((x) => staff || x.active),
    resources: resources.filter((x) => staff || x.active),
    locations: locations.filter((x) => staff || x.active),
    categories,
    paymentConfigured: s.demo || Boolean(env.MIDTRANS_SERVER_KEY),
    ticketConfigured:
      s.demo || Boolean(env.TICKET_SECRET && env.TICKET_SECRET.length >= 32),
  };
}
/** Abort the whole D1 batch when a conditional mutation affected no row. */
export function changedGuard(env: Env): Statement[] {
  const key = uid();
  return [
    q(env, "INSERT INTO mutation_guards(id,ok) VALUES(?,changes())", key),
    q(env, "DELETE FROM mutation_guards WHERE id=?", key),
  ];
}
/** Booking reads and schedule edits must use the same configuration revision. */
export function revisionGuard(
  env: Env,
  s: Session,
  revision: number,
): Statement[] {
  const key = uid();
  return [
    q(
      env,
      "INSERT INTO mutation_guards(id,ok) VALUES(?,CASE WHEN (SELECT revision FROM scopes WHERE id=?)=? THEN 1 ELSE 0 END)",
      key,
      s.scope,
      revision,
    ),
    q(env, "DELETE FROM mutation_guards WHERE id=?", key),
  ];
}
export function bumpRevision(
  env: Env,
  s: Session,
  revision: number,
): Statement[] {
  return [
    q(
      env,
      "UPDATE scopes SET revision=revision+1 WHERE id=? AND revision=?",
      s.scope,
      revision,
    ),
    ...changedGuard(env),
  ];
}
export async function expire(env: Env, s?: Session) {
  const where = `status IN('requested','pending_confirmation','awaiting_payment') AND expires_at IS NOT NULL AND expires_at<=?${s ? " AND scope=?" : ""}`,
    args = s ? [now(env), s.scope] : [now(env)];
  await env.DB.batch([
    q(
      env,
      `INSERT INTO booking_events(id,scope,booking_id,action,actor,note,at) SELECT lower(hex(randomblob(16))),scope,id,'expired','system','Reservation expired',? FROM bookings WHERE ${where}`,
      now(env),
      ...args,
    ),
    q(
      env,
      `UPDATE bookings SET status='expired',payment_status=CASE WHEN paid_amount>refunded_amount THEN 'refund_due' ELSE payment_status END,refund_eligible=paid_amount-refunded_amount,expires_at=NULL,version=version+1,updated_at=? WHERE ${where}`,
      now(env),
      ...args,
    ),
  ]);
}
