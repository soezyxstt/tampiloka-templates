import { choice, fail, object, text } from "../src/domain/validation.ts";
import { cookie, q } from "./db.ts";
import { digest, equal, random, rateLimit } from "./security.ts";
import { now, type Env, type Session } from "./types.ts";

/** Replace this adapter with your identity provider when individual staff accounts are required. */
export interface StaffIdentityProvider {
  authenticate(
    role: "owner" | "operations" | "viewer",
    password: string,
  ): Promise<boolean>;
}
export function environmentIdentity(env: Env): StaffIdentityProvider {
  return {
    async authenticate(role, password) {
      const secret = {
        owner: env.STAFF_OWNER_PASSWORD,
        operations: env.STAFF_OPERATIONS_PASSWORD,
        viewer: env.STAFF_VIEWER_PASSWORD,
      }[role];
      if (!secret || secret.length < 12)
        fail(
          503,
          "STAFF_NOT_CONFIGURED",
          "This staff role has not been configured.",
        );
      return equal(await digest(password), await digest(secret));
    },
  };
}
export async function login(
  request: Request,
  env: Env,
  s: Session,
  value: unknown,
) {
  const v = object(value),
    role = choice(v.role, ["owner", "operations", "viewer"] as const, "Role");
  await rateLimit(
    env,
    "login:" +
      (await digest(request.headers.get("cf-connecting-ip") || "local")),
    10,
    900,
  );
  if (
    !(await environmentIdentity(env).authenticate(
      role,
      text(v.password, "Password", 200, true),
    ))
  )
    fail(401, "INVALID_CREDENTIALS", "Invalid role or password.");
  const token = random(),
    hash = await digest(token);
  const result = await q(
    env,
    "UPDATE sessions SET hash=?,role=?,expires_at=? WHERE hash=? AND scope=?",
    hash,
    role,
    now(env) + 8 * 3600000,
    s.hash,
    s.scope,
  ).run();
  if (!result.meta?.changes)
    fail(
      401,
      "SESSION_EXPIRED",
      "Your session expired. Reload before signing in.",
    );
  s.hash = hash;
  s.role = role;
  s.cookie = cookie(request, token, 8 * 3600);
  return { role };
}
export async function logout(request: Request, env: Env, s: Session) {
  // Preserve this browser's customer access, while invalidating the previous staff token.
  const token = random(),
    hash = await digest(token),
    ttl = s.demo ? 86400 : 30 * 86400;
  await q(
    env,
    "UPDATE sessions SET hash=?,role='customer',expires_at=? WHERE hash=? AND scope=?",
    hash,
    now(env) + ttl * 1000,
    s.hash,
    s.scope,
  ).run();
  s.hash = hash;
  s.role = "customer";
  s.cookie = cookie(request, token, ttl);
  return { role: s.role };
}
