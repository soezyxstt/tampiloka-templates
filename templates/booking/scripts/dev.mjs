import { existsSync } from "node:fs";
import { Readable } from "node:stream";
import { createServer, preview } from "vite";
import { localDatabase } from "./sqlite.mjs";
import { assetHeaders, handleRequest } from "../worker/index.ts";

if (existsSync(".dev.vars")) process.loadEnvFile(".dev.vars");
const demo = process.argv.includes("--demo");
const db = localDatabase(demo);
const env = { ...process.env, DEMO_MODE: String(demo), DB: db };
function mountAPI(server) {
  server.middlewares.use(async (req, res, next) => {
    if (!req.url.startsWith("/api/")) return next();
    try {
      const request = new Request(new URL(req.url, `http://${req.headers.host}`), {
        method: req.method,
        headers: req.headers,
        ...(["GET", "HEAD"].includes(req.method) ? {} : { body: Readable.toWeb(req), duplex: "half" }),
      });
      const response = await handleRequest(request, env);
      res.writeHead(response.status, Object.fromEntries(response.headers));
      res.end(Buffer.from(await response.arrayBuffer()));
    } catch (error) {
      next(error);
    }
  });
}
const address = { host: "127.0.0.1", port: Number(process.env.PORT || 5176), strictPort: true };
const options = {
  mode: demo ? "demo" : "development",
  server: address,
  preview: { ...address, headers: assetHeaders },
  plugins: [{ name: "local-booking-api", configureServer: mountAPI, configurePreviewServer: mountAPI }],
};
const server = process.argv.includes("--preview") ? await preview(options) : await createServer(options);
if (server.listen) await server.listen();
server.printUrls();
for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, async () => {
    await server.close();
    db.close();
    process.exit(0);
  });
}
