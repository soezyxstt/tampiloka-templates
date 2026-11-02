import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdir, writeFile, readFile, rm, mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { createServer } from "node:net";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { defaultOptions } from "../src/domain/adapters.ts";

// Exercises the built application and its real Worker/D1 API. No mocked business results.
// A latency regression holds an actual API response to verify stale permission handling.
// A remote target is permitted only after its health endpoint confirms isolated demo mode.
const root = fileURLToPath(new URL("../", import.meta.url));
const out = join(root, "test-results/browser");
await mkdir(out, { recursive: true });
const external = process.env.BOOKING_TEST_URL;
const port = external ? null : await new Promise((resolve, reject) => {
  const socket = createServer();
  socket.once("error", reject);
  socket.listen(0, "127.0.0.1", () => {
    const selected = socket.address().port;
    socket.close(error => error ? reject(error) : resolve(selected));
  });
});
const base = external || `http://127.0.0.1:${port}`;
const processes = [];
let browser;
const report = {
  checkedAt: new Date().toISOString(),
  base,
  checks: [],
  errors: [],
  realPayments: false,
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function command(bin, args) {
  await new Promise((ok, no) => {
    const p = spawn(bin, args, {
      cwd: root,
      stdio: "inherit",
      env: { ...process.env, WRANGLER_SEND_METRICS: "false" },
    });
    p.on("error", no);
    p.on("exit", (c) =>
      c === 0 ? ok() : no(Error(`${bin} ${args.join(" ")}: ${c}`)),
    );
  });
}
const checkFilter = process.env.BOOKING_CHECK_FILTER ? new RegExp(process.env.BOOKING_CHECK_FILTER) : null;
if (external && !checkFilter) throw new Error("Set BOOKING_CHECK_FILTER explicitly for a hosted browser run to avoid unexpected D1 usage.");
if (checkFilter) report.filter = process.env.BOOKING_CHECK_FILTER;
async function check(name, fn) {
  if (checkFilter && !checkFilter.test(name)) { report.checks.push({ name, status: "skipped" }); return; }
  try {
    await fn();
    report.checks.push({ name, status: "passed" });
    console.log(`PASS ${name}`);
  } catch (e) {
    report.checks.push({ name, status: "failed", message: e.stack });
    console.error(`FAIL ${name}: ${e.message}`);
  }
}
async function boot(page, params = {}) {
  const url = new URL(base);
  url.search = new URLSearchParams({ lang: "en", ...params }).toString();
  await page.goto(url.href, { waitUntil: "domcontentloaded" });
  await page.locator(".booking-app").waitFor();
  await page.locator(".b-progress").waitFor({ state: "detached" });
  assert.equal(await page.locator(".b-global-error").count(), 0);
}
async function call(context, path, method = "GET", data) {
  const response = await context.request.fetch(new URL(path, base).href, {
    method,
    headers: { Origin: new URL(base).origin },
    ...(data === undefined ? {} : { data }),
  });
  const body = await response.json();
  assert.equal(
    response.ok(),
    true,
    `${path}: ${response.status()} ${JSON.stringify(body)}`,
  );
  return body;
}
async function picker(page, label, option) {
  await page.getByRole("combobox", { name: label, exact: true }).click();
  await page.getByRole("option", { name: option, exact: true }).click();
  await page.locator(".b-progress").waitFor({ state: "detached" });
}
const presets = ["medical", "aesthetic", "detailing", "consulting"];
const layouts = [
  "appointment-first",
  "editorial",
  "service-market",
  "minimal-professional",
];
const palettes = ["sage", "rose", "slate", "ochre"];
const levels = ["catalog", "whatsapp", "booking", "full"];
async function newPage(width = 1440) {
  const context = await browser.newContext({
    viewport: { width, height: 900 },
    locale: "en-GB",
    reducedMotion: "reduce",
  });
  const page = await context.newPage();
  page.setDefaultTimeout(30000);
  page.on("pageerror", (e) => report.errors.push(e.message));
  return { context, page };
}
async function geometry(page) {
  await page.locator('.b-loading').waitFor({state:'detached'});
  await page.evaluate(async () => { await document.fonts.ready; await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))); });
  // Trigger lazy images before checking their load state and capturing the full page.
  await page.locator("img").evaluateAll(images => images.forEach(image => { image.loading = "eager"; }));
  await page.waitForFunction(() => Array.from(document.images).every(image => image.complete), {timeout:15000});
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
    true,
    "Page overflows horizontally",
  );
  const missing = await page
    .locator("img")
    .evaluateAll((images) =>
      images
        .filter((x) => !x.complete || x.naturalWidth === 0)
        .map((x) => x.src),
    );
  assert.deepEqual(missing, [], "Broken images");
}
async function prepareSameDay(context) {
  await call(context, "/api/demo/role", "POST", { role: "owner" });
  let data = await call(context, "/api/staff/snapshot");
  const schedule = Array.from({ length: 7 }, (_, weekday) => ({
    weekday,
    start: 0,
    end: 1440,
  }));
  for (const kind of ["location", "resource"])
    for (const entity of data[
      kind === "location" ? "locations" : "resources"
    ]) {
      const current = await call(context, "/api/staff/snapshot");
      await call(context, `/api/staff/content/${kind}`, "PUT", {
        revision: current.revision,
        data: { ...entity, schedule },
      });
    }
  data = await call(context, "/api/staff/snapshot");
  await call(context, "/api/staff/settings", "PUT", {
    revision: data.revision,
    data: {
      ...data.config,
      policy: {
        ...data.config.policy,
        minNoticeMinutes: 0,
        cancellationHours: 0,
        checkInEarlyMinutes: 1440,
        manualConfirmation: false,
      },
    },
  });
  await call(context, "/api/demo/role", "POST", { role: "customer" });
}
try {
  if (!external) {
    await command("pnpm", ["exec", "vite", "build", "--mode", "demo"]);
    const state = await mkdtemp(join(tmpdir(), "booking-browser-"));
    report.persistence = "Temporary local D1 database, real SQL migrations";
    await command("pnpm", [
      "exec",
      "wrangler",
      "d1",
      "migrations",
      "apply",
      "DB",
      "--local",
      "--config",
      "wrangler.demo.jsonc",
      "--persist-to",
      state,
    ]);
    const child = spawn(
      "pnpm",
      [
        "exec",
        "wrangler",
        "dev",
        "--local",
        "--config",
        "wrangler.demo.jsonc",
        "--port",
        String(port),
        "--ip",
        "127.0.0.1",
        "--persist-to",
        state,
      ],
      {
        cwd: root,
        env: { ...process.env, WRANGLER_SEND_METRICS: "false" },
        stdio: ["ignore", "pipe", "pipe"],
        detached: process.platform !== "win32",
      },
    );
    processes.push(child);
    let logs = "";
    child.stdout.on("data", (d) => (logs += d));
    child.stderr.on("data", (d) => (logs += d));
    child.on("exit", () => void writeFile(join(out, "worker.log"), logs));
  }
  let health;
  for (let i = 0; i < 100; i++) {
    if (!external && processes.some(child => child.exitCode !== null)) throw new Error("Test Worker exited before health check; refusing to use an unrelated server");
    try {
      health = await (await fetch(base + "/api/health", { signal: AbortSignal.timeout(3000) })).json();
      if (health.ok) break;
    } catch {}
    await sleep(500);
  }
  assert.equal(
    health?.demo,
    true,
    "Refusing to run destructive browser scenarios against a production project",
  );
  browser = await chromium.launch({ headless: true,
    ...(process.env.BOOKING_CHROMIUM_EXECUTABLE ? { executablePath: process.env.BOOKING_CHROMIUM_EXECUTABLE } : {}),
  });
  for (let n = 0; n < layouts.length; n++)
    for (const width of [360, 390, 1024, 1440])
      await check(`${layouts[n]} ${width}px reduced motion`, async () => {
        const { context, page } = await newPage(width);
        try {
          await boot(page, {
            preset: presets[n],
            layout: layouts[n],
            palette: palettes[n],
            level: "full",
          });
          await geometry(page);
          assert.equal(
            await page.getByRole("heading", { level: 1 }).count(),
            1,
          );
          assert.equal(await page.locator("html").getAttribute("lang"), "en");
          await page.screenshot({
            path: join(out, `${layouts[n]}-${width}.png`),
            fullPage: true,
          });
          if (width === 1440) {
            await page.setViewportSize({ width: 1280, height: 800 });
            await page.screenshot({
              path: join(out, `${layouts[n]}-preview.png`),
            });
          }
        } finally {
          await context.close();
        }
      });
  for (const preset of presets)
    for (const level of levels)
      await check(`${preset} ${level} boundary and navigation`, async () => {
        const { context, page } = await newPage(390);
        try {
          await boot(page, { preset, level, page: "services" });
          const data = await call(context, "/api/bootstrap");
          assert.equal(data.config.preset, preset);
          assert.equal(data.config.level, level);
          assert.equal(
            data.capabilities.booking,
            ["booking", "full"].includes(level),
          );
          if (!data.capabilities.booking) {
            const rejected = await context.request.post(
              base + "/api/bookings",
              { data: {}, headers: { Origin: new URL(base).origin } },
            );
            assert.equal(rejected.status(), 403);
          }
          await page
            .getByRole("button", { name: "Staff", exact: true })
            .click();
          await page
            .getByRole("navigation", { name: "Staff workspace navigation" })
            .waitFor();
          await geometry(page);
          await page
            .getByRole("button", { name: "Customer", exact: true })
            .click();
          await page.locator(".b-staff").waitFor({ state: "detached" });
          await page.reload({ waitUntil: "domcontentloaded" });
          await page.locator(".b-progress").waitFor({ state: "detached" });
          assert.equal(new URL(page.url()).searchParams.get("level"), level);
        } finally {
          await context.close();
        }
      });
  await check(
    "Independent URL axes, appearance, history, language, role and refresh",
    async () => {
      const { context, page } = await newPage();
      try {
        await boot(page, {
          preset: "aesthetic",
          level: "booking",
          layout: "editorial",
          palette: "rose",
        });
        await picker(page, "Demo theme", "Slate");
        assert.equal(
          await page.locator(".booking-app").getAttribute("data-palette"),
          "slate",
        );
        assert.equal(
          new URL(page.url()).searchParams.get("layout"),
          "editorial",
        );
        await page.goBack({ waitUntil: "domcontentloaded" });
        await page.waitForFunction(
          () =>
            document
              .querySelector(".booking-app")
              ?.getAttribute("data-palette") === "rose",
        );
        await page.goForward({ waitUntil: "domcontentloaded" });
        await page.waitForFunction(
          () =>
            document
              .querySelector(".booking-app")
              ?.getAttribute("data-palette") === "slate",
        );
        await page.getByRole("button", { name: "Customize demo" }).click();
        await page
          .getByRole("button", { name: "Minimal professional", exact: true })
          .click();
        await page.keyboard.press("Escape");
        await page.waitForFunction(
          () =>
            document
              .querySelector(".booking-app")
              ?.getAttribute("data-layout") === "minimal-professional",
        );
        await page
          .getByRole("button", { name: "Ganti ke Bahasa Indonesia" })
          .click();
        assert.equal(await page.locator("html").getAttribute("lang"), "id");
        await page.reload({ waitUntil: "domcontentloaded" });
        await page.locator(".booking-app").waitFor();
        assert.equal(await page.locator("html").getAttribute("lang"), "id");
        await page.getByRole("button", { name: "Switch to English" }).click();
        await page.getByRole("button", { name: "Staff", exact: true }).click();
        await page
          .getByRole("navigation", { name: "Staff workspace navigation" })
          .waitFor();
        await page.getByRole("button", { name: "Customize demo" }).click();
        await picker(page, "Demo staff role", "Viewer");
        await page.keyboard.press("Escape");
        await page
          .getByRole("link", { name: "Site & settings", exact: true })
          .click();
        const readOnlyName = page.getByLabel("Business name", { exact: true });
        await readOnlyName.waitFor();
        await page.waitForFunction(el => el.matches(':disabled'), await readOnlyName.elementHandle());
        assert.equal(await readOnlyName.isDisabled(), true);
      } finally {
        await context.close();
      }
    },
  );
  await check("Overlapping reschedule picker and Worker mutation for customer and staff", async () => {
    const { context, page } = await newPage(390);
    try {
      await boot(page, { preset: "medical", level: "booking" });
      await prepareSameDay(context);
      const state = await call(context, "/api/bootstrap");
      const date = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
      const selection = { serviceId: state.services[0].id, locationId: state.locations[0].id, options: defaultOptions("medical"), date };
      const available = await call(context, "/api/availability", "POST", selection);
      const original = available.slots.find(slot => slot.label === "09:00") ?? available.slots[0];
      assert.ok(original, "An appointment time is available");
      const booking = await call(context, "/api/bookings", "POST", { ...selection, startsAt: original.startsAt, expectedTotal: available.quote.total, customer: { name: "Reschedule Example", phone: "081234567890", email: "" }, paymentMethod: "location", idempotencyKey: crypto.randomUUID() });
      const overlap = original.startsAt + 15 * 60000;
      assert.equal((await call(context, "/api/availability", "POST", selection)).slots.some(slot => slot.startsAt === overlap), false);
      for (const staff of [false, true]) {
        if (staff) await call(context, "/api/demo/role", "POST", { role: "owner" });
        await page.setViewportSize({ width: staff ? 1024 : 390, height: 900 });
        await boot(page, { preset: "medical", level: "booking", view: staff ? "staff" : "customer", page: staff ? "bookings" : "appointments", booking: booking.id });
        const basePath = `/api/${staff ? "staff/" : ""}bookings/${booking.id}`;
        const choices = page.waitForResponse(response => response.url().includes(basePath + "/availability"));
        await page.getByRole("dialog").getByRole("button", { name: "Reschedule", exact: true }).click();
        const offered = await (await choices).json();
        const target = offered.slots.find(slot => slot.startsAt === (staff ? original.startsAt : overlap));
        assert.ok(target, "Picker offers the overlapping move");
        await page.getByRole("dialog").locator(".b-slot-grid button").filter({ hasText: target.label }).first().click();
        const changed = page.waitForResponse(response => response.url().includes(basePath + "/actions") && response.request().method() === "POST");
        await page.getByRole("button", { name: "Save new time", exact: true }).click();
        assert.equal((await (await changed).json()).startsAt, target.startsAt);
        await page.screenshot({ path: join(out, `reschedule-${staff ? "staff-1024" : "customer-390"}.png`), fullPage: true });
      }
    } finally { await context.close(); }
  });
  await check(
    "Full customer booking, failed attempt, retry, payment, receipt, QR image and staff check-in",
    async () => {
      const { context, page } = await newPage(390);
      try {
        await boot(page, { preset: "medical", level: "full" });
        await prepareSameDay(context);
        await boot(page, { preset: "medical", level: "full", page: "book" });
        await page
          .getByRole("button", { name: "Continue to time selection" })
          .click();
        await page.getByRole("group", { name: "Available times" }).waitFor();
        await page
          .getByRole("group", { name: "Available times" })
          .getByRole("button")
          .first()
          .click();
        await page.getByRole("button", { name: "Review appointment" }).click();
        await page
          .getByLabel("Full name", { exact: true })
          .fill("Browser Example");
        await page
          .getByLabel("Phone number", { exact: true })
          .fill("081234567890");
        await page.getByRole("radio", { name: /Deposit/ }).check();
        await page.getByRole("checkbox").check();
        await page.screenshot({
          path: join(out, "booking-review-390.png"),
          fullPage: true,
        });
        await page
          .getByRole("button", { name: "Save appointment", exact: true })
          .click();
        const detail = page.getByRole("dialog");
        await detail.waitFor();
        await detail.getByRole("button", { name: "Simulate failure" }).click();
        await detail
          .getByRole("button", { name: "Simulate success" })
          .waitFor();
        await detail.getByRole("button", { name: "Simulate success" }).click();
        await detail
          .getByRole("heading", { name: "Your appointment ticket" })
          .waitFor();
        await page.screenshot({
          path: join(out, "ticket-390.png"),
          fullPage: true,
        });
        const history = await call(context, "/api/bookings");
        assert.equal(history.total, 1);
        const booking = await call(
          context,
          "/api/bookings/" + history.bookings[0].id,
        );
        assert.equal(booking.status, "confirmed");
        assert.ok(booking.paidAmount > 0);
        assert.ok(booking.ticket.payload);
        assert.equal(booking.ticket.payload.includes("Browser Example"), false);
        await detail
          .getByRole("button", { name: "Receipt", exact: true })
          .click();
        await page.screenshot({
          path: join(out, "receipt-390.png"),
          fullPage: true,
        });
        await page.keyboard.press("Escape");
        await page.getByRole("button", { name: "Staff", exact: true }).click();
        await page
          .getByRole("navigation", { name: "Staff workspace navigation" })
          .waitFor();
        await page
          .getByRole("link", { name: "Verify ticket", exact: true })
          .click();
        const QR = (await import("qrcode")).default;
        const image = await QR.toBuffer(booking.ticket.payload, {
          width: 460,
          margin: 3,
        });
        await page
          .getByLabel("Upload QR image")
          .setInputFiles({
            name: "ticket.png",
            mimeType: "image/png",
            buffer: image,
          });
        await page.getByLabel("Ticket code", {exact:true}).waitFor();
        await page.waitForFunction(() => Boolean(document.querySelector('textarea')?.value));
        await page.getByRole("button", {name:"Verify ticket",exact:true}).click();
        await page
          .getByRole("heading", { name: "Valid ticket", exact: true })
          .waitFor();
        await page
          .getByRole("button", { name: "Check in", exact: true })
          .click();
        await page.getByRole("heading", { name: "Arrival recorded" }).waitFor();
        await page.screenshot({
          path: join(out, "staff-check-in-390.png"),
          fullPage: true,
        });
        const verified = await call(
          context,
          "/api/staff/tickets/validate",
          "POST",
          { payload: booking.ticket.payload },
        );
        assert.equal(verified.alreadyCheckedIn, true);
        const other = await browser.newContext();
        try {
          await call(other, "/api/bootstrap");
          const r = await other.request.get(
            base + "/api/bookings/" + booking.id,
          );
          assert.equal(r.status(), 404);
          assert.equal((await call(other, "/api/bookings")).total, 0);
        } finally {
          await other.close();
        }
      } finally {
        await context.close();
      }
    },
  );
  await check(
    "WhatsApp request remains unconfirmed and creates no customer record",
    async () => {
      const { context, page } = await newPage(390);
      try {
        await boot(page, {
          preset: "detailing",
          level: "whatsapp",
          page: "book",
        });
        await page
          .getByLabel("Make and model", { exact: true })
          .fill("Example hatchback");
        await page
          .getByRole("button", { name: "Continue to time selection" })
          .click();
        await page.getByRole("button", { name: "Review appointment" }).click();
        await page
          .getByRole("textbox", { name: "WhatsApp message preview" })
          .waitFor();
        assert.match(
          await page
            .getByRole("textbox", { name: "WhatsApp message preview" })
            .inputValue(),
          /Example hatchback/,
        );
        await page
          .getByText(
            "Opening WhatsApp does not confirm your appointment or mean that the message was delivered.",
          )
          .waitFor();
        await page.screenshot({
          path: join(out, "whatsapp-390.png"),
          fullPage: true,
        });
        const r = await context.request.get(base + "/api/bookings");
        assert.equal(r.status(), 403);
      } finally {
        await context.close();
      }
    },
  );
  await check(
    "Owner content persistence, staff sample scenarios, empty and error states",
    async () => {
      const { context, page } = await newPage();
      try {
        await boot(page, {
          preset: "consulting",
          level: "full",
          view: "staff",
          page: "settings",
        });
        await page
          .getByLabel("Business name", { exact: true })
          .fill("Northline Browser Example");
        await page
          .getByRole("button", { name: "Save settings", exact: true })
          .click();
        await page.getByText("Settings saved.", { exact: true }).waitFor();
        await page.reload({ waitUntil: "domcontentloaded" });
        await page.locator(".b-progress").waitFor({ state: "detached" });
        assert.equal(
          await page.getByLabel("Business name", { exact: true }).inputValue(),
          "Northline Browser Example",
        );
        await page.getByRole("button", { name: "Customize demo" }).click();
        // The demo creates three real appointments, not a UI fixture. Await its
        // bounded server result before asserting the dialog's completion state.
        const scenarioResponse = page.waitForResponse(response =>
          new URL(response.url()).pathname === "/api/demo/scenario" && response.request().method() === "POST",
          { timeout: 60000 });
        await page.getByRole("button", { name: "Add sample appointments" }).click();
        const scenario = await scenarioResponse;
        const scenarioResult = await scenario.json();
        assert.equal(scenario.ok(), true, JSON.stringify(scenarioResult));
        assert.equal(scenarioResult.created, 3);
        await page.getByRole("dialog").waitFor({ state: "detached" });
        await page
          .getByRole("link", { name: "Appointments", exact: true })
          .click();
        await page.locator(".b-table tbody tr").first().waitFor();
        await page.screenshot({
          path: join(out, "staff-list-1440.png"),
          fullPage: true,
        });
        await page
          .getByRole("link", { name: "Verify ticket", exact: true })
          .click();
        await page
          .getByLabel("Ticket code", { exact: true })
          .fill("not-a-ticket");
        await page
          .getByRole("button", { name: "Verify ticket", exact: true })
          .click();
        await page.getByRole("alert").waitFor();
        await page
          .getByRole("button", { name: "Customer", exact: true })
          .click();
        await boot(page, {
          preset: "consulting",
          level: "full",
          page: "appointments",
        });
        await page
          .getByRole("heading", { name: "Your appointments." })
          .waitFor();
      } finally {
        await context.close();
      }
    },
  );
  await (await import("./workspace-checks.mjs")).workspaceChecks({browser, base, out, check, boot, geometry});
  assert.deepEqual(report.errors, [], "Browser runtime exceptions");
} catch (e) {
  report.fatal = e.stack;
  process.exitCode = 1;
} finally {
  if (browser) await browser.close();
  for (const p of processes) {
    try { if (process.platform === "win32") p.kill("SIGTERM"); else process.kill(-p.pid,"SIGTERM"); } catch {}
    p.stdout?.destroy(); p.stderr?.destroy(); p.unref();
  }
  report.passed = report.checks.filter((x) => x.status === "passed").length;
  report.failed = report.checks.filter((x) => x.status === "failed").length;
  report.skipped = report.checks.filter((x) => x.status === "skipped").length;
  if (!report.passed && !report.fatal) report.fatal = "No browser checks passed; check the filter and failures.";
  await writeFile(join(out, "report.json"), JSON.stringify(report, null, 2));
  if (report.failed || report.fatal || report.errors.length)
    process.exitCode = 1;
  console.log(
    JSON.stringify(
      {
        passed: report.passed,
        failed: report.failed,
        errors: report.errors,
        fatal: report.fatal,
      },
      null,
      2,
    ),
  );
}
