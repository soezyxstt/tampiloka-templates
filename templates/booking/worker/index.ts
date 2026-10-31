import { capabilities } from "../src/domain/model.ts";
import { adapters } from "../src/domain/adapters.ts";
import {
  DomainError,
  choice,
  dateOnly,
  fail,
  object,
  text,
} from "../src/domain/validation.ts";
import { all, bootstrap, configFor, expire, q, sessionFor } from "./db.ts";
import {
  body,
  digest,
  rateLimit,
  requireCapability,
  requireStaff,
  sameOrigin,
  uid,
} from "./security.ts";
import { login, logout } from "./auth.ts";
import { demoAction } from "./demo.ts";
import {
  availability,
  parseSelection,
  quoteSelection,
} from "./services/availability.ts";
import {
  accessToken,
  bookingAction,
  bookingDetail,
  createBooking,
  listBookings,
  restoreAccess,
} from "./services/bookings.ts";
import {
  deleteBlackout,
  reportCsv,
  saveBlackout,
  saveEntity,
  saveSettings,
  snapshot,
} from "./services/content.ts";
import {
  applyStatus,
  reconcilePayment,
  recordLocationPayment,
  refundPayment,
  simulatePayment,
  startPayment,
  webhook,
} from "./services/payments.ts";
import { validateTicket } from "./services/tickets.ts";
import { deliverNotifications } from "./providers/notifications.ts";
import { paymentProviders } from "./providers/payments.ts";
import { now, type Env, type PaymentRow, type Session } from "./types.ts";

const headers = {
  "Cache-Control": "no-store",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "no-referrer",
  "Permissions-Policy": "camera=(self), microphone=(), geolocation=()",
};
const json = (value: unknown, status = 200, cookie?: string) =>
  Response.json(value, {
    status,
    headers: { ...headers, ...(cookie ? { "Set-Cookie": cookie } : {}) },
  });
async function whatsapp(env: Env, s: Session, input: unknown) {
  const data = await bootstrap(env, s);
  requireCapability(data.capabilities, "whatsapp");
  const raw = object(input),
    selection = parseSelection(raw, data),
    { quote, service } = quoteSelection(data, selection),
    lang = choice(
      raw.lang || data.config.language,
      ["id", "en"] as const,
      "Language",
    );
  const resource = selection.practitionerId
    ? data.resources.find(
        (x) =>
          x.id === selection.practitionerId &&
          x.serviceIds.includes(service.id) &&
          x.locationId === selection.locationId &&
          x.active,
      )
    : null;
  if (selection.practitionerId && !resource)
    fail(
      422,
      "PRACTITIONER_UNAVAILABLE",
      "Choose a professional who provides this service.",
    );
  const preferredDate = raw.preferredDate ? dateOnly(raw.preferredDate) : "",
    preferredTime = text(raw.preferredTime, "Preferred time", 5);
  if (preferredTime && !/^([01]\d|2[0-3]):[0-5]\d$/.test(preferredTime))
    fail(422, "INVALID_TIME", "Use a valid HH:mm time.");
  const message = [
    lang === "id"
      ? `Halo ${data.config.brand.name}, saya ingin bertanya tentang janji berikut.`
      : `Hello ${data.config.brand.name}, I would like to request an appointment.`,
    service.name[lang],
    `${quote.duration} min · IDR ${quote.total.toLocaleString("en-US")}`,
    resource?.name || "",
    data.locations.find((l) => l.id === selection.locationId)?.name || "",
    preferredDate,
    preferredTime,
    ...adapters[data.config.preset].fields.map((f) =>
      selection.options[f.key]
        ? `${f.label[lang]}: ${f.options?.find((o) => o.value === selection.options[f.key])?.label[lang] || selection.options[f.key]}`
        : "",
    ),
    lang === "id"
      ? "Mohon konfirmasi jadwal dan harga. Pesan ini belum menjadi janji yang terkonfirmasi."
      : "Please confirm availability and price. This request does not confirm an appointment.",
  ]
    .filter(Boolean)
    .join("\n");
  return {
    message,
    url: data.config.brand.whatsapp
      ? `https://wa.me/${data.config.brand.whatsapp}?text=${encodeURIComponent(message)}`
      : null,
    confirmed: false,
    delivered: false,
  };
}
async function route(request: Request, env: Env, s: Session, url: URL) {
  const path = url.pathname,
    method = request.method;
  if (path === "/api/bootstrap" && method === "GET") {
    await expire(env, s);
    return bootstrap(env, s);
  }
  if (path === "/api/staff/login" && method === "POST")
    return login(request, env, s, await body(request));
  if (path === "/api/logout" && method === "POST")
    return logout(request, env, s);
  if (path.startsWith("/api/demo/") && method === "POST")
    return demoAction(request, env, s, path.slice(10), await body(request));
  if (path === "/api/whatsapp" && method === "POST")
    return whatsapp(env, s, await body(request));
  if (path === "/api/availability" && method === "POST") {
    await rateLimit(env, "slots:" + s.principal, 600, 3600);
    const result = await availability(env, s, await body(request));
    return {
      slots: result.slots.map(
        ({ assignments, occupiedStart, occupiedEnd, ...slot }) => slot,
      ),
      quote: result.quote,
    };
  }
  if (path === "/api/quote" && method === "POST") {
    const data = await bootstrap(env, s);
    requireCapability(data.capabilities, "whatsapp");
    return quoteSelection(data, parseSelection(await body(request), data))
      .quote;
  }
  if (path === "/api/bookings" && method === "POST") {
    await rateLimit(env, "create:" + s.principal, 50, 3600);
    return createBooking(env, s, await body(request));
  }
  if (path === "/api/bookings" && method === "GET")
    return listBookings(env, s, url.searchParams);
  if (path === "/api/access" && method === "POST") {
    await rateLimit(
      env,
      "access:" +
        (await digest(request.headers.get("cf-connecting-ip") || "local")),
      10,
      900,
    );
    return restoreAccess(env, s, await body(request));
  }
  const attempt = path.match(
    /^\/api\/bookings\/attempt\/([a-zA-Z0-9_-]{16,100})$/,
  );
  if (attempt && method === "GET") {
    requireCapability(capabilities((await configFor(env, s)).level), "booking");
    const row = await q(
      env,
      "SELECT * FROM bookings WHERE scope=? AND principal=? AND idempotency_key=?",
      s.scope,
      s.principal,
      attempt[1],
    ).first<import("./types.ts").BookingRow>();
    return {
      booking: row
        ? {
            ...(await bookingDetail(env, s, row.id)),
            accessToken: await accessToken(env, s, row),
          }
        : null,
    };
  }
  let match = path.match(
    /^\/api\/(staff\/)?bookings\/([a-zA-Z0-9_-]+)(?:\/(actions|payment|reconcile|simulate|receipt|refund))?$/,
  );
  if (match) {
    const staff = Boolean(match[1]),
      key = match[2],
      action = match[3];
    if (!action && method === "GET") {
      await expire(env, s);
      return bookingDetail(env, s, key, staff);
    }
    if (action === "actions" && method === "POST")
      return bookingAction(env, s, key, await body(request), staff);
    if (action === "payment" && method === "POST")
      return staff
        ? recordLocationPayment(env, s, key, await body(request))
        : startPayment(env, s, key);
    if (action === "reconcile" && method === "POST")
      return reconcilePayment(env, s, key, staff);
    if (action === "simulate" && method === "POST" && !staff)
      return simulatePayment(env, s, key, await body(request));
    if (action === "refund" && method === "POST" && staff)
      return refundPayment(env, s, key, await body(request));
    if (action === "receipt" && method === "GET") {
      requireCapability(
        capabilities((await configFor(env, s)).level),
        "payments",
      );
      const b = await bookingDetail(env, s, key, staff);
      if (!b.paidAmount)
        fail(
          409,
          "NO_RECEIPT",
          "A receipt is available after verified payment.",
        );
      return {
        reference: b.reference,
        issuedAt: b.updatedAt,
        currency: "IDR",
        total: b.total,
        received: b.paidAmount,
        refunded: b.refundedAmount,
        balance: Math.max(0, b.total - b.paidAmount),
        payments: b.payments.filter((p) =>
          ["paid", "refund_pending", "refunded"].includes(p.status),
        ),
        demo: s.demo,
      };
    }
  }
  if (path === "/api/staff/snapshot" && method === "GET") {
    requireStaff(s);
    await expire(env, s);
    return snapshot(env, s);
  }
  if (path === "/api/staff/bookings" && method === "GET")
    return listBookings(env, s, url.searchParams, true);
  if (path === "/api/staff/settings" && method === "PUT")
    return saveSettings(env, s, await body(request));
  match = path.match(
    /^\/api\/staff\/content\/(service|resource|location|category)$/,
  );
  if (match && method === "PUT")
    return saveEntity(env, s, match[1], await body(request));
  if (path === "/api/staff/blackouts" && method === "POST")
    return saveBlackout(env, s, await body(request));
  match = path.match(/^\/api\/staff\/blackouts\/([a-zA-Z0-9_-]+)$/);
  if (match && method === "DELETE")
    return deleteBlackout(env, s, match[1], await body(request));
  if (path === "/api/staff/tickets/validate" && method === "POST") {
    await rateLimit(env, "tickets:" + s.principal, 120, 900);
    return validateTicket(env, s, await body(request));
  }
  if (path === "/api/staff/report.csv" && method === "GET")
    return new Response(await reportCsv(env, s), {
      headers: {
        ...headers,
        "Content-Type": "text/csv;charset=utf-8",
        "Content-Disposition": 'attachment; filename="appointments.csv"',
      },
    });
  return fail(404, "NOT_FOUND", "API route not found.");
}
export async function handleRequest(
  request: Request,
  env: Env,
): Promise<Response> {
  const url = new URL(request.url);
  if (!url.pathname.startsWith("/api/")) {
    if (!env.ASSETS)
      return new Response(
        "Booking API: start the frontend to open the website.",
        { status: 404 },
      );
    const source = await env.ASSETS.fetch(request),
      response = new Response(source.body, source);
    response.headers.set("X-Content-Type-Options", "nosniff");
    response.headers.set("Referrer-Policy", "no-referrer");
    response.headers.set(
      "Content-Security-Policy",
      "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' https: data:; font-src 'self'; connect-src 'self'; frame-ancestors 'self'; base-uri 'self'; form-action 'self'",
    );
    return response;
  }
  const requestId = uid();
  let s: Session | undefined;
  try {
    if (!env.DB)
      fail(503, "DATABASE_NOT_CONFIGURED", "Database binding is missing.");
    if (url.pathname === "/api/health" && request.method === "GET") {
      await q(env, "SELECT id FROM scopes LIMIT 1").first();
      return json({
        ok: true,
        service: "tampiloka-booking",
        demo: env.DEMO_MODE === "true",
      });
    }
    if (url.pathname === "/api/webhooks/midtrans" && request.method === "POST")
      return json(await webhook(env, await body(request)));
    sameOrigin(request);
    s = await sessionFor(request, env);
    const result = await route(request, env, s, url);
    if (result instanceof Response) {
      if (s.cookie) result.headers.set("Set-Cookie", s.cookie);
      return result;
    }
    return json(result, 200, s.cookie);
  } catch (error) {
    let status = 500,
      code = "INTERNAL_ERROR",
      message =
        "The request could not be completed. Retry with the same request key.";
    if (error instanceof DomainError) {
      status = error.status;
      code = error.code;
      message = error.message;
    } else if (
      /constraint|INVALID_TRANSITION|SQLITE_BUSY|mutation_guards/i.test(
        String(error),
      )
    ) {
      status = 409;
      code = "CONFLICT";
      message = "The appointment or schedule changed. Refresh and retry.";
    } else
      console.error(
        JSON.stringify({
          requestId,
          code,
          name: error instanceof Error ? error.name : "Error",
        }),
      );
    return json({ error: { code, message }, requestId }, status, s?.cookie);
  }
}
export async function cleanup(env: Env) {
  await expire(env);
  if (env.DEMO_MODE !== "true" && env.MIDTRANS_SERVER_KEY) {
    const pending = await all<PaymentRow>(
      env,
      "SELECT p.* FROM payments p JOIN scopes s ON s.id=p.scope WHERE s.demo=0 AND p.provider='midtrans' AND p.status IN('created','starting','pending','refund_pending') ORDER BY p.updated_at LIMIT 25",
    );
    for (const p of pending)
      try {
        await applyStatus(
          env,
          p.id,
          await paymentProviders.midtrans(env).status(p.reference),
        );
      } catch {
        /* A retry or staff reconciliation retains the same provider reference. */
      }
  }
  await deliverNotifications(env);
  await env.DB.batch([
    q(env, "DELETE FROM scopes WHERE demo=1 AND expires_at<=?", now(env)),
    q(env, "DELETE FROM sessions WHERE expires_at<=?", now(env)),
    q(env, "DELETE FROM rate_limits WHERE expires_at<=?", now(env)),
  ]);
}
export default {
  fetch: handleRequest,
  async scheduled(_controller: unknown, env: Env) {
    await cleanup(env);
  },
};
