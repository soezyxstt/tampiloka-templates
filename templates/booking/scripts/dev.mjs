import { spawn } from "node:child_process";
import { mkdir, writeFile, access } from "node:fs/promises";
import { fileURLToPath } from "node:url";
const root = fileURLToPath(new URL("../", import.meta.url));
const demo = process.argv.includes("--demo");
const config = demo ? "wrangler.demo.jsonc" : "wrangler.jsonc";
const children = [];
function run(args, wait = false) {
  return new Promise((resolve, reject) => {
    const child = spawn("pnpm", args, {
      cwd: root,
      stdio: "inherit",
      env: { ...process.env, WRANGLER_SEND_METRICS: "false" },
    });
    children.push(child);
    child.on("error", reject);
    if (wait)
      child.on("exit", (code) =>
        code === 0
          ? resolve(child)
          : reject(new Error(`${args.join(" ")} exited ${code}`)),
      );
    else resolve(child);
  });
}
function close() {
  for (const child of children) child.kill("SIGTERM");
}
process.on("SIGINT", () => {
  close();
  process.exit(0);
});
process.on("SIGTERM", () => {
  close();
  process.exit(0);
});
try {
  await mkdir(new URL("../dist/", import.meta.url), { recursive: true });
  try {
    await access(new URL("../dist/index.html", import.meta.url));
  } catch {
    await writeFile(
      new URL("../dist/index.html", import.meta.url),
      "<p>Use the Vite preview on port 5176.</p>",
    );
  }
  await run(
    [
      "exec",
      "wrangler",
      "d1",
      "migrations",
      "apply",
      "DB",
      "--local",
      "--config",
      config,
    ],
    true,
  );
  await run([
    "exec",
    "wrangler",
    "dev",
    "--local",
    "--config",
    config,
    "--port",
    "8788",
    "--ip",
    "127.0.0.1",
  ]);
  await run(["exec", "vite", "--mode", demo ? "demo" : "development"]);
} catch (error) {
  console.error(error.message);
  close();
  process.exit(1);
}
