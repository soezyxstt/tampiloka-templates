import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import {
  mkdtemp,
  mkdir,
  readFile,
  writeFile,
  readdir,
  rm,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
const root = fileURLToPath(new URL("../../../", import.meta.url));
const output = join(root, "templates/booking/test-results/standalone");
await mkdir(output, { recursive: true });
const report = { checkedAt: new Date().toISOString(), projects: [] };
const staging = await mkdtemp(join(tmpdir(), "tampiloka-booking-clients-"));
function run(bin, args, cwd, env = {}) {
  return new Promise((resolve, reject) => {
    const p = spawn(bin, args, {
      cwd,
      env: { ...process.env, CI: "true", WRANGLER_SEND_METRICS: "false", ...env },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let text = "";
    p.stdout.on("data", (d) => (text += d));
    p.stderr.on("data", (d) => (text += d));
    p.on("error", reject);
    p.on("exit", (code) => {
      if (code === 0) resolve(text);
      else
        reject(
          Object.assign(
            new Error(`${bin} ${args.join(" ")} exited ${code}\n${text}`),
            { output: text },
          ),
        );
    });
  });
}
for (const [level, preset] of [
  ["catalog", "medical"],
  ["whatsapp", "aesthetic"],
  ["booking", "detailing"],
  ["full", "consulting"],
]) {
  const name = `client-${level}`,
    dir = join(staging, name),
    record = { level, preset, status: "pending", steps: [] };
  report.projects.push(record);
  let server;
  try {
    await run(
      process.execPath,
      [
        join(root, "packages/cli/bin/tampiloka.mjs"),
        "create",
        name,
        "--template",
        "booking",
        "--preset",
        preset,
        "--level",
        level,
        "--layout",
        "minimal-professional",
        "--theme",
        "slate",
        "--yes",
      ],
      staging,
    );
    record.steps.push("Generated outside the monorepo");
    const pkg = JSON.parse(await readFile(join(dir, "package.json"), "utf8"));
    assert.equal(
      Object.values(pkg.dependencies).some((x) => x === "workspace:*"),
      false,
    );
    assert.equal(
      pkg.dependencies["@tampiloka/ui-core"],
      "file:./packages/ui-core",
    );
    // No node_modules links to the source checkout. This is a real independent install.
    await writeFile(
      join(output, `${level}-install.log`),
      await run("pnpm", ["install", "--no-frozen-lockfile"], dir),
    );
    record.steps.push("Fresh independent dependency installation");
    // An installed bin may be reached through a pnpm symlink. A silent exit would skip the release gate.
    await assert.rejects(
      run("pnpm", ["exec", "tampiloka-db", "verify"], dir, { TURSO_DATABASE_URL: "", TURSO_AUTH_TOKEN: "" }),
      /Turso database credentials are missing/,
    );
    record.steps.push("Installed Turso verifier rejects missing credentials");
    await writeFile(
      join(output, `${level}-build.log`),
      await run("pnpm", ["build"], dir),
    );
    record.steps.push("Typecheck and production build");
    await writeFile(
      join(output, `${level}-doctor.log`),
      await run(
        process.execPath,
        [join(root, "packages/cli/bin/tampiloka.mjs"), "doctor", "--dir", dir],
        staging,
      ),
    );
    record.steps.push("CLI doctor");
    const assets = join(dir, "dist/assets");
    for (const file of await readdir(assets)) {
      if (!file.endsWith(".js")) continue;
      const source = await readFile(join(assets, file), "utf8");
      assert.equal(source.includes("Tampiloka demo settings"), false);
      assert.equal(source.includes("Reset session"), false);
    }
    await writeFile(
      join(output, `${level}-migration.log`),
      await run("pnpm", ["db:migrate"], dir),
    );
    record.steps.push("Local SQLite migration");
    const port = 8800 + report.projects.length,
      origin = `http://127.0.0.1:${port}`,
      secret = "standalone-test-password-" + crypto.randomUUID();
    await writeFile(join(dir, ".dev.vars"), `STAFF_OWNER_PASSWORD=${secret}\n`);
    server = spawn(
      process.execPath,
      ["scripts/dev.mjs", "--preview"],
      {
        cwd: dir,
        env: { ...process.env, PORT: String(port) },
        stdio: ["ignore", "ignore", "pipe"],
        detached: process.platform !== "win32",
      },
    );
    let logs = "";
    server.stderr.on("data", (d) => (logs += d));
    let ready = false;
    for (let i = 0; i < 120; i++) {
      try {
        if ((await fetch(origin + "/api/health")).ok) {
          ready = true;
          break;
        }
      } catch {}
      await new Promise((r) => setTimeout(r, 500));
    }
    assert.equal(ready, true, logs);
    let cookie = "";
    async function request(path, method = "GET", data) {
      const response = await fetch(origin + path, {
        method,
        headers: {
          Origin: origin,
          ...(cookie ? { Cookie: cookie } : {}),
          ...(data ? { "Content-Type": "application/json" } : {}),
        },
        ...(data ? { body: JSON.stringify(data) } : {}),
      });
      const set = response.headers.get("Set-Cookie");
      if (set) cookie = set.split(";")[0];
      const body = await response.json();
      return { status: response.status, body };
    }
    const b = await request("/api/bootstrap");
    assert.equal(b.status, 200);
    assert.equal(b.body.demo, false);
    assert.equal(b.body.config.preset, preset);
    assert.equal(b.body.config.level, level);
    assert.equal(b.body.role, "customer");
    assert.equal((await request("/api/staff/snapshot")).status, 401);
    assert.equal(
      (await request("/api/demo/role", "POST", { role: "owner" })).status,
      403,
    );
    assert.equal(
      (await request("/api/demo/config", "POST", { level: "full" })).status,
      403,
    );
    assert.equal(
      (
        await request("/api/staff/login", "POST", {
          role: "owner",
          password: secret,
        })
      ).status,
      200,
    );
    const staff = await request("/api/staff/snapshot");
    assert.equal(staff.status, 200);
    const config = structuredClone(staff.body.config);
    config.brand.name = "Independent " + level;
    assert.equal(
      (
        await request("/api/staff/settings", "PUT", {
          revision: staff.body.revision,
          data: config,
        })
      ).status,
      200,
    );
    assert.equal(
      (await request("/api/bootstrap")).body.config.brand.name,
      config.brand.name,
    );
    record.steps.push(
      "Production identity, CMS persistence and demo-route denial",
    );
    if (level === "booking" || level === "full") {
      const current = (await request("/api/bootstrap")).body,
        service =
          current.services.find((s) => s.price === 0) || current.services[0],
        location = current.locations[0];
      const options = {};
      // Obtain valid domain defaults from this independently generated project, not from the monorepo.
      const { defaultOptions } = await import(
        new URL("file://" + join(dir, "src/domain/adapters.ts"))
      );
      Object.assign(options, defaultOptions(preset));
      if (preset === "detailing") options.vehicleModel = "Example vehicle";
      let available;
      for (let day = 1; day < 10; day++) {
        const date = new Intl.DateTimeFormat("en-CA", {
          timeZone: location.timezone,
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
        }).format(Date.now() + day * 86400000);
        const r = await request("/api/availability", "POST", {
          serviceId: service.id,
          locationId: location.id,
          options,
          date,
        });
        assert.equal(r.status, 200, JSON.stringify(r));
        if (r.body.slots.length) {
          available = r.body;
          break;
        }
      }
      assert.ok(available);
      const input = {
        serviceId: service.id,
        locationId: location.id,
        options,
        startsAt: available.slots[0].startsAt,
        paymentMethod: "location",
        customer: {
          name: "Standalone Example",
          phone: "081234567890",
          email: "",
        },
        expectedTotal: available.quote.total,
        idempotencyKey: crypto.randomUUID(),
      };
      const booking = await request("/api/bookings", "POST", input);
      assert.equal(booking.status, 200, JSON.stringify(booking));
      assert.equal(
        (await request("/api/bookings", "POST", input)).body.id,
        booking.body.id,
      );
      assert.equal((await request("/api/staff/bookings")).body.total, 1);
      record.steps.push(
        "Customer booking, idempotent retry and staff visibility",
      );
    } else
      assert.equal((await request("/api/bookings", "POST", {})).status, 403);
    record.status = "passed";
    console.log(`PASS standalone ${preset}/${level}`);
  } catch (error) {
    record.status = "failed";
    record.error = error.stack;
    console.error(error.stack);
    process.exitCode = 1;
  } finally {
    if (server) {
      try { if (process.platform === "win32") server.kill("SIGTERM"); else process.kill(-server.pid,"SIGTERM"); } catch {}
      server.stderr?.destroy(); server.unref();
    }
    await writeFile(
      join(output, "report.json"),
      JSON.stringify(report, null, 2),
    );
  }
}
// A failed project remains in the runner temp directory for diagnosis; never upload .dev.vars.
if (!process.exitCode) await rm(staging, { recursive: true, force: true });
