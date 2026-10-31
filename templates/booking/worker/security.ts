import type { Capabilities, Role } from "../src/domain/model.ts";
import { fail, object } from "../src/domain/validation.ts";
import type { Env, Session } from "./types.ts";
import { now } from "./types.ts";
export const random = () =>
  Array.from(crypto.getRandomValues(new Uint8Array(32)), (v) =>
    v.toString(16).padStart(2, "0"),
  ).join("");
export const uid = (prefix = "") =>
  prefix + crypto.randomUUID().replaceAll("-", "");
export async function digest(value: string, algorithm = "SHA-256") {
  return Array.from(
    new Uint8Array(
      await crypto.subtle.digest(algorithm, new TextEncoder().encode(value)),
    ),
    (v) => v.toString(16).padStart(2, "0"),
  ).join("");
}
export async function hmac(secret: string, message: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return Array.from(
    new Uint8Array(
      await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message)),
    ),
    (v) => v.toString(16).padStart(2, "0"),
  ).join("");
}
export function equal(a: string, b: string) {
  if (a.length !== b.length) return false;
  let n = 0;
  for (let i = 0; i < a.length; i++) n |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return n === 0;
}
export function requireCapability(cap: Capabilities, name: keyof Capabilities) {
  if (!cap[name])
    fail(
      403,
      "FEATURE_DISABLED",
      "This feature is not enabled at the selected level.",
    );
}
export function requireStaff(
  s: Session,
  write = false,
  owner = false,
): Exclude<Role, "customer"> {
  if (s.role === "customer")
    fail(401, "STAFF_REQUIRED", "Sign in to the staff workspace.");
  if ((write && s.role === "viewer") || (owner && s.role !== "owner"))
    fail(403, "ROLE_FORBIDDEN", "Your role cannot perform this action.");
  return s.role;
}
export function sameOrigin(request: Request) {
  if (["GET", "HEAD", "OPTIONS"].includes(request.method)) return;
  if (
    request.headers.get("origin") !== new URL(request.url).origin ||
    request.headers.get("sec-fetch-site") === "cross-site"
  )
    fail(403, "ORIGIN_FORBIDDEN", "Cross-site requests are not allowed.");
  if (!request.headers.get("content-type")?.startsWith("application/json"))
    fail(415, "JSON_REQUIRED", "Use application/json.");
}
export async function body(request: Request) {
  if (Number(request.headers.get("content-length") || 0) > 65536)
    fail(413, "BODY_TOO_LARGE", "Request too large.");
  const reader = request.body?.getReader();
  if (!reader) return {};
  let length = 0;
  const chunks: Uint8Array[] = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    length += value.length;
    if (length > 65536) {
      await reader.cancel();
      fail(413, "BODY_TOO_LARGE", "Request too large.");
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const c of chunks) {
    bytes.set(c, offset);
    offset += c.length;
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(new TextDecoder().decode(bytes) || "{}");
  } catch {
    fail(400, "INVALID_JSON", "Invalid JSON body.");
  }
  return object(parsed);
}
export async function rateLimit(
  env: Env,
  key: string,
  limit: number,
  seconds = 900,
) {
  const stamp = now(env);
  const result = await env.DB.prepare(
    "INSERT INTO rate_limits(key,count,expires_at) VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET count=CASE WHEN expires_at<=? THEN 1 ELSE count+1 END, expires_at=CASE WHEN expires_at<=? THEN excluded.expires_at ELSE expires_at END RETURNING count",
  )
    .bind(key, stamp + seconds * 1000, stamp, stamp)
    .first<{ count: number }>();
  if (result!.count > limit)
    fail(429, "RATE_LIMIT", "Too many attempts. Please try later.");
}
